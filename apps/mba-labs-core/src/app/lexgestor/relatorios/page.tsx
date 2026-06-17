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
      title="Relatorios"
      description="Filtre, imprima, gere PDF ou baixe planilhas com os dados do escritorio."
    >
      <section className="card">
        <form className="filter-row" action="/lexgestor/relatorios">
          <label className="field filter-small">
            Periodo inicial
            <input name="inicio" type="date" defaultValue={filters.inicio ?? ""} />
          </label>
          <label className="field filter-small">
            Periodo final
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
            <span>Sem numero de processo</span>
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

      <ReportBlock
        title="Relatorio de clientes"
        rows={data.clientes.map((cliente) => [
          cliente.nome,
          cliente.cpfCnpj,
          cliente.whatsapp || cliente.telefone,
          `${cliente.casosCount} caso(s)`,
          cliente.ultimoAtendimento || "-",
          cliente.status,
        ])}
        headers={["Nome", "CPF/CNPJ", "Contato", "Casos", "Ultimo atendimento", "Status"]}
      />

      <ReportBlock
        title="Relatorio de casos"
        rows={data.casos.map((caso) => [
          caso.cliente,
          `${caso.categoria} / ${caso.subcategoria}`,
          caso.numeroProcesso || "-",
          caso.status,
          caso.criadoEm || "-",
          caso.proximoPrazo || "-",
          String(caso.documentosCount),
        ])}
        headers={["Cliente", "Categoria", "Processo", "Status", "Abertura", "Proximo prazo", "Docs"]}
      />

      <ReportBlock
        title="Relatorio de documentos"
        rows={data.documentos.map((documento) => [
          documento.cliente,
          documento.caso,
          documento.tipo,
          documento.status,
          documento.criadoEm || "-",
          documento.storagePath || documento.storageUrl || "Pendente",
        ])}
        headers={["Cliente", "Caso", "Tipo", "Status", "Envio", "Local"]}
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
      <table className="responsive-table">
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
                  <td key={`${title}-${index}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
