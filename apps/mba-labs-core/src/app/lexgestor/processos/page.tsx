import { RefreshCw, Search, SquareArrowOutUpRight } from "lucide-react";
import { sincronizarProcessoLexGestor } from "@/app/lexgestor/actions";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";
import { listProcessosLex, listTribunaisDataJud } from "@/lib/lexgestor/processos";

type ProcessosPageProps = {
  searchParams?: Promise<{
    q?: string;
    cliente?: string;
    caso?: string;
    tribunal?: string;
    grau?: string;
    status?: string;
    erro?: string;
  }>;
};

export default async function ProcessosPage({ searchParams }: ProcessosPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/processos");
  const escritorioId = String(data.escritorio?.id ?? "");
  const [tribunais, processos] = await Promise.all([
    listTribunaisDataJud(),
    listProcessosLex({
      current: data.current,
      escritorioId,
      filters: {
        numero: params.q,
        clienteId: params.cliente,
        casoId: params.caso,
        tribunal: params.tribunal,
        grau: params.grau,
        status: params.status,
      },
    }).catch(() => []),
  ]);

  return (
    <ResponsivePageContainer
      title="Processos judiciais"
      description="Cadastre processos, acompanhe movimentações públicas pelo DataJud/CNJ e anexe PDFs baixados do tribunal."
    >
      <div className="button-row">
        <a className="button" href="/lexgestor/processos/novo">Novo processo</a>
        <a className="button secondary" href="/lexgestor/documentos">Documentos</a>
      </div>

      {params.erro ? <p className="notice danger" role="alert">{feedbackMessage(params.erro)}</p> : null}

      <form className="form-card stack" action="/lexgestor/processos">
        <div className="section-title">
          <div>
            <h2>Filtros</h2>
            <p>Localize por CNJ, cliente, caso, tribunal, grau ou status.</p>
          </div>
          <Search size={20} aria-hidden />
        </div>
        <div className="field-grid compact-fields">
          <label className="field">
            Número CNJ
            <input name="q" defaultValue={params.q ?? ""} placeholder="0000000-00.0000.0.00.0000" />
          </label>
          <label className="field">
            Cliente
            <select name="cliente" defaultValue={params.cliente ?? ""}>
              <option value="">Todos</option>
              {data.clientes.map((cliente) => (
                <option value={cliente.id} key={cliente.id}>{cliente.nome}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Caso
            <select name="caso" defaultValue={params.caso ?? ""}>
              <option value="">Todos</option>
              {data.casos.map((caso) => (
                <option value={caso.id} key={caso.id}>{caso.cliente} - {caso.titulo}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Tribunal
            <select name="tribunal" defaultValue={params.tribunal ?? ""}>
              <option value="">Todos</option>
              {tribunais.map((tribunal) => (
                <option value={tribunal.sigla} key={tribunal.sigla}>{tribunal.sigla}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Grau
            <select name="grau" defaultValue={params.grau ?? ""}>
              <option value="">Todos</option>
              <option value="1 grau">1 grau</option>
              <option value="2 grau">2 grau</option>
            </select>
          </label>
          <label className="field">
            Status
            <select name="status" defaultValue={params.status ?? ""}>
              <option value="">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="arquivado">Arquivado</option>
              <option value="suspenso">Suspenso</option>
            </select>
          </label>
        </div>
        <div className="button-row">
          <button className="button secondary" type="submit">Filtrar</button>
          <a className="button secondary" href="/lexgestor/processos">Limpar</a>
        </div>
      </form>

      <section className="accordion-list">
        {processos.length === 0 ? (
          <article className="empty-state">
            <strong>Nenhum processo cadastrado</strong>
            <p>Cadastre o primeiro processo para consultar movimentações públicas pelo DataJud/CNJ.</p>
          </article>
        ) : (
          processos.map((processo) => (
            <details className="accordion-card processo-card" key={processo.id}>
              <summary>
                <span className="summary-main">
                  {processo.numeroCnj}
                  {processo.possuiNovaMovimentacao ? <span className="badge warning">Nova movimentação</span> : null}
                </span>
                <span>{processo.clienteNome}</span>
                <span>{processo.tribunal} / {processo.grau || "-"}</span>
                <span className="status-pill">{processo.status}</span>
                <span className="summary-action">Ver eventos</span>
              </summary>
              <div className="accordion-content">
                <div className="detail-grid">
                  <Info label="Caso vinculado" value={processo.casoTitulo || "Sem caso vinculado"} />
                  <Info label="Classe" value={processo.classeNome || "Não sincronizada"} />
                  <Info label="Órgão julgador" value={processo.orgaoJulgadorNome || "Não sincronizado"} />
                  <Info label="Última movimentação" value={processo.ultimaMovimentacao || "Sem eventos salvos"} />
                  <Info label="Última atualização" value={formatDate(processo.ultimaSincronizacao) || "Nunca"} />
                  <Info label="Quantidade de eventos" value={`${processo.movimentacoesCount} evento(s)`} />
                </div>
                <div className="button-row">
                  <a className="button" href={`/lexgestor/processos/${processo.id}`}>Ver eventos</a>
                  <form action={sincronizarProcessoLexGestor}>
                    <input type="hidden" name="processo_id" value={processo.id} />
                    <button className="button secondary" type="submit">
                      <RefreshCw size={16} aria-hidden />
                      Atualizar
                    </button>
                    <span className="muted">Busca movimentações públicas no DataJud/CNJ.</span>
                  </form>
                  {processo.urlEproc ? (
                    <a className="button secondary" href={processo.urlEproc} target="_blank" rel="noreferrer">
                      <SquareArrowOutUpRight size={16} aria-hidden />
                      Abrir no tribunal
                    </a>
                  ) : null}
                </div>
              </div>
            </details>
          ))
        )}
      </section>
    </ResponsivePageContainer>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="detail-box">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function feedbackMessage(value: string) {
  const messages: Record<string, string> = {
    "processo-invalido": "Processo indisponível para este escritório.",
  };
  return messages[value] ?? value;
}
