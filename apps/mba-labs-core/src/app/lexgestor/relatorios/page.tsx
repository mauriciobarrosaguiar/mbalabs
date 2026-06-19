import { MiniBarChart } from "@/components/lexgestor/MiniBarChart";
import { ReportExportActions } from "@/components/lexgestor/ReportExportActions";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData, type LexCaso, type LexDocumento } from "@/lib/lexgestor/data";

type RelatoriosPageProps = {
  searchParams?: Promise<Record<string, string | undefined>>;
};

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const filters = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/relatorios");
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value) as Array<[string, string]>);
  const casosFiltrados = data.casos.filter((caso) => {
    if (filters.cliente && caso.clienteId !== filters.cliente) return false;
    if (filters.caso && caso.id !== filters.caso) return false;
    if (filters.advogado && caso.advogadoResponsavelId !== filters.advogado) return false;
    if (filters.status && caso.status !== filters.status) return false;
    if (!isWithinPeriod(caso.criadoEm, filters.inicio, filters.fim) && !isWithinPeriod(caso.proximoPrazo, filters.inicio, filters.fim)) return false;
    return true;
  });
  const casoIds = new Set(casosFiltrados.map((caso) => caso.id));
  const clientesFiltrados = data.clientes.filter((cliente) =>
    filters.cliente ? cliente.id === filters.cliente : casosFiltrados.some((caso) => caso.clienteId === cliente.id),
  );
  const documentosFiltrados = data.documentos.filter((documento) => casoIds.has(documento.casoId));

  return (
    <ResponsivePageContainer
      title="Relatórios"
      description="Filtre, imprima, gere PDF ou baixe planilhas com os dados do escritório."
    >
      <section className="card">
        <form className="filter-row reports-filter-row" action="/lexgestor/relatorios">
          <label className="field filter-small">
            Cliente
            <select name="cliente" defaultValue={filters.cliente ?? ""}>
              <option value="">Todos</option>
              {data.clientes.map((cliente) => (
                <option value={cliente.id} key={cliente.id}>{cliente.nome}</option>
              ))}
            </select>
          </label>
          <label className="field filter-small">
            Caso
            <select name="caso" defaultValue={filters.caso ?? ""}>
              <option value="">Todos</option>
              {data.casos
                .filter((caso) => !filters.cliente || caso.clienteId === filters.cliente)
                .map((caso) => (
                  <option value={caso.id} key={caso.id}>{caso.titulo}</option>
                ))}
            </select>
          </label>
          <label className="field filter-small">
            Período inicial
            <input name="inicio" type="date" defaultValue={filters.inicio ?? ""} />
          </label>
          <label className="field filter-small">
            Período final
            <input name="fim" type="date" defaultValue={filters.fim ?? ""} />
          </label>
          <label className="field filter-small">
            Advogado responsável
            <select name="advogado" defaultValue={filters.advogado ?? ""}>
              <option value="">Todos</option>
              {data.advogados.filter((advogado) => advogado.status === "Ativo").map((advogado) => (
                <option value={advogado.id} key={advogado.id}>{advogado.nome}</option>
              ))}
            </select>
          </label>
          <label className="field filter-small">
            Status
            <select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Todos</option>
              {Array.from(new Set(data.casos.map((caso) => caso.status))).map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>
          <div className="button-row reports-filter-actions">
            <button className="button" type="submit">Filtrar</button>
            <a className="button secondary" href="/lexgestor/relatorios">Limpar</a>
          </div>
        </form>
      </section>

      <section className="grid">
        <article className="stat-card">
          <span>Clientes no filtro</span>
          <strong>{clientesFiltrados.length}</strong>
          <small>Registros encontrados</small>
        </article>
        <article className="stat-card">
          <span>Casos no filtro</span>
          <strong>{casosFiltrados.length}</strong>
          <small>Conforme critérios</small>
        </article>
        <article className="stat-card">
          <span>Documentos no filtro</span>
          <strong>{documentosFiltrados.length}</strong>
          <small>Sem anexar conteúdo ao relatório</small>
        </article>
        <article className="stat-card">
          <span>Prazos no filtro</span>
          <strong>{casosFiltrados.filter((caso) => caso.proximoPrazo).length}</strong>
          <small>Com data informada</small>
        </article>
      </section>

      <section className="split">
        <MiniBarChart title="Casos por categoria" rows={countBy(casosFiltrados, "categoria")} />
        <MiniBarChart title="Documentos por status" rows={countBy(documentosFiltrados, "status")} />
      </section>

      <section className="split">
        <MiniBarChart title="Casos por status" rows={countBy(casosFiltrados, "status")} />
        <MiniBarChart title="Produtividade por advogado" rows={produtividadeChart(casosFiltrados)} />
      </section>

      <ReportBlock
        title="Relatório de clientes"
        rows={clientesFiltrados.map((cliente) => [
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
        rows={casosFiltrados.map((caso) => [
          caso.cliente,
          `${caso.categoria} / ${caso.subcategoria}`,
          caso.numeroProcesso || "-",
          caso.status,
          caso.advogadoResponsavel || "-",
          formatReportDate(caso.proximoPrazo),
          String(caso.documentosCount),
        ])}
        headers={["Cliente", "Categoria", "Processo", "Status", "Responsável", "Próximo prazo", "Docs"]}
      />

      <ReportBlock
        title="Relatório de documentos"
        rows={documentosFiltrados.map((documento) => [
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
        rows={casosFiltrados
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
        rows={produtividadeRows(casosFiltrados, documentosFiltrados)}
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
    <section className="table-panel report-panel">
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

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const label = String(row[key] ?? "") || "Sem informação";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

function produtividadeChart(casos: LexCaso[]) {
  return produtividadeRows(casos, []).map(([label, value]) => ({ label, value: Number(value) }));
}

function produtividadeRows(casos: LexCaso[], documentos: LexDocumento[]) {
  const map = new Map<string, { casos: number; documentos: number }>();
  for (const caso of casos) {
    const label = caso.advogadoResponsavel || "Sem responsável";
    const current = map.get(label) ?? { casos: 0, documentos: 0 };
    current.casos += 1;
    current.documentos += documentos.filter((documento) => documento.casoId === caso.id).length;
    map.set(label, current);
  }

  return Array.from(map.entries()).map(([label, value]) => [label, String(value.casos), String(value.documentos)]);
}

function isWithinPeriod(value: string | undefined, inicio?: string, fim?: string) {
  if (!inicio && !fim) return true;
  if (!value) return false;
  const date = value.slice(0, 10);
  if (inicio && date < inicio) return false;
  if (fim && date > fim) return false;
  return true;
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
