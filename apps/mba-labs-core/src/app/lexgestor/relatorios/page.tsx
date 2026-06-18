import { MiniBarChart } from "@/components/lexgestor/MiniBarChart";
import { ReportExportActions } from "@/components/lexgestor/ReportExportActions";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

type RelatoriosPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const filters = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/relatorios");
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as Array<[string, string]>);

  return (
    <ResponsivePageContainer
      title="Relatórios"
      description="Filtre, imprima, gere PDF ou baixe planilhas com os dados do escritório."
    >
      <section className="card">
        <form className="filter-row" action="/lexgestor/relatorios">
          <label className="field filter-small">
            Período inicial
            <input name="inicio" type="date" defaultValue={filters.inicio ?? ""} />
          </label>
          <label className="field filter-small">
            Período final
            <input name="fim" type="date" defaultValue={filters.fim ?? ""} />
          </label>
          <label className="field filter-small">
            Categoria
            <select name="categoria" defaultValue={filters.categoria ?? ""}>
              <option value="">Todas</option>
              {data.categorias.map((categoria) => (
                <option value={categoria.nome} key={categoria.nome}>
                  {categoria.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field filter-small">
            Status
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Todos</option>
              {Array.from(new Set(data.casos.map((caso) => caso.status))).map((status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="check-option">
            <input name="sem_processo" type="checkbox" value="sim" defaultChecked={filters.sem_processo === "sim"} />
            <span>Sem número de processo</span>
          </label>
          <label className="check-option">
            <input name="pendentes" type="checkbox" value="sim" defaultChecked={filters.pendentes === "sim"} />
            <span>Com documentos pendentes</span>
          </label>
          <button className="button" type="submit">
            Filtrar
          </button>
        </form>
      </section>

      <section className="grid">
        {data.metrics.map((metric) => (
          <article className="stat-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </section>

      <section className="split">
        <MiniBarChart title="Casos por categoria" rows={data.casosPorCategoria} />
        <MiniBarChart title="Documentos por status" rows={data.documentosPorStatus} />
      </section>

      <section className="split">
        <MiniBarChart title="Casos por status" rows={data.casosPorStatus} />
        <MiniBarChart title="Produtividade por advogado" rows={data.produtividadePorAdvogado} />
      </section>

      <ReportBlock
        title="Relatório de clientes"
        rows={data.clientes.map((cliente) => [
          cliente.nome,
          cliente.cpfCnpj,
          cliente.whatsapp || cliente.telefone,
          `${cliente.casosCount} caso(s)`,
          formatReportDate(cliente.ultimoAtendimento),
          cliente.status,
        ])}
        headers={["Nome", "CPF/CNPJ", "Contato", "Casos", "Último atendimento", "Status"]}
      />

      <ReportBlock
        title="Relatório de casos"
        rows={data.casos.map((caso) => [
          caso.cliente,
          `${caso.categoria} / ${caso.subcategoria}`,
          caso.numeroProcesso || "-",
          caso.status,
          formatReportDate(caso.criadoEm),
          formatReportDate(caso.proximoPrazo),
          String(caso.documentosCount),
        ])}
        headers={["Cliente", "Categoria", "Processo", "Status", "Abertura", "Próximo prazo", "Docs"]}
      />

      <ReportBlock
        title="Relatório de documentos"
        rows={data.documentos.map((documento) => [
          documento.cliente,
          documento.caso,
          documento.tipo,
          documento.status,
          formatReportDate(documento.criadoEm),
          formatStorageLocal(documento.storagePath || documento.storageUrl),
        ])}
        headers={["Cliente", "Caso", "Tipo", "Status", "Envio", "Local"]}
      />

      <ReportBlock
        title="Relatório de prazos"
        rows={data.casos
          .filter((caso) => caso.proximoPrazo)
          .map((caso) => [
            formatReportDate(caso.proximoPrazo),
            caso.tipoPrazo || "-",
            caso.cliente,
            caso.titulo,
            caso.advogadoResponsavel,
            caso.status,
          ])}
        headers={["Prazo", "Tipo", "Cliente", "Caso", "Responsável", "Status"]}
      />

      <ReportBlock
        title="Relatório de produtividade"
        rows={data.produtividadePorAdvogado.map((row) => [
          row.label,
          String(row.value),
          `${data.documentos.filter((documento) =>
            data.casos.some((caso) => caso.advogadoResponsavel === row.label && caso.id === documento.casoId),
          ).length}`,
        ])}
        headers={["Advogado", "Casos", "Documentos vinculados"]}
      />

      <section className="card">
        <ReportExportActions query={query.toString()} />
      </section>
    </ResponsivePageContainer>
  );
}

function ReportBlock({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <section className="table-panel">
      <div className="table-title">
        <h2>{title}</h2>
      </div>
      <table className="responsive-table reports-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length}>Sem registros.</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr key={`${title}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td className={cell.length > 38 ? "long-text" : undefined} key={`${title}-${index}-${cellIndex}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function formatReportDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  const options: Intl.DateTimeFormatOptions = value.includes("T")
    ? { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }
    : { dateStyle: "short", timeZone: "America/Sao_Paulo" };

  return new Intl.DateTimeFormat("pt-BR", options).format(date);
}

function formatStorageLocal(value: string) {
  if (!value) return "Pendente";
  if (/^https?:\/\//i.test(value)) return "Link externo";

  const parts = value.split("/").filter(Boolean);
  if (parts.length <= 5) return value;

  return `.../${parts.slice(-4).join("/")}`;
}
