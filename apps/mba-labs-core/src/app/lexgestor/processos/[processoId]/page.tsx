import { FileUp, RefreshCw, SquareArrowOutUpRight } from "lucide-react";
import { marcarMovimentacoesVistasLexGestor, sincronizarProcessoLexGestor } from "@/app/lexgestor/actions";
import { EmptyState } from "@/components/lexgestor/EmptyState";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";
import { getProcessoLex, type LexMovimentacao } from "@/lib/lexgestor/processos";

type ProcessoDetalhePageProps = {
  params: Promise<{ processoId: string }>;
  searchParams?: Promise<{ erro?: string; status?: string }>;
};

export default async function ProcessoDetalhePage({ params, searchParams }: ProcessoDetalhePageProps) {
  const { processoId } = await params;
  const query = (await searchParams) ?? {};
  const data = await getLexWorkspaceData(`/lexgestor/processos/${processoId}`);
  const escritorioId = String(data.escritorio?.id ?? "");
  const result = await getProcessoLex({ current: data.current, escritorioId, processoId });

  if (!result) {
    return (
      <ResponsivePageContainer title="Processo nao encontrado">
        <EmptyState title="Registro indisponivel" description="Verifique se o processo existe ou se pertence ao seu escritorio." />
      </ResponsivePageContainer>
    );
  }

  const { processo, movimentacoes } = result;
  const documentosDoProcesso = data.documentos.filter((documento) => (documento as any).processoId === processo.id);
  const docsByMovimentacao = new Map<string, number>();
  for (const documento of documentosDoProcesso) {
    const movimentacaoId = String((documento as any).movimentacaoId ?? "");
    if (movimentacaoId) docsByMovimentacao.set(movimentacaoId, (docsByMovimentacao.get(movimentacaoId) ?? 0) + 1);
  }

  return (
    <ResponsivePageContainer
      title={processo.numeroCnj}
      description={`${processo.clienteNome} ${processo.casoTitulo ? `- ${processo.casoTitulo}` : ""}`}
    >
      {query.erro ? <p className="notice danger" role="alert">{feedbackMessage(query.erro)}</p> : null}
      {query.status ? <p className="notice success" role="status">{feedbackMessage(query.status)}</p> : null}

      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>Dados principais</h2>
            <p>As movimentacoes sao consultadas por metadados publicos do DataJud/CNJ. Documentos do eproc podem exigir login do advogado no sistema oficial.</p>
          </div>
          {processo.possuiNovaMovimentacao ? <span className="badge warning">Nova movimentacao</span> : null}
        </div>

        <div className="detail-grid">
          <Info label="Cliente" value={processo.clienteNome} />
          <Info label="Caso vinculado" value={processo.casoTitulo || "Sem caso vinculado"} />
          <Info label="Tribunal" value={processo.tribunal} />
          <Info label="Grau" value={processo.grau} />
          <Info label="Classe" value={processo.classeNome || "Nao sincronizada"} />
          <Info label="Assuntos" value={processo.categoria || "-"} />
          <Info label="Orgao julgador" value={processo.orgaoJulgadorNome || "Nao sincronizado"} />
          <Info label="Status" value={processo.status} />
          <Info label="Ultima atualizacao" value={formatDate(processo.dataUltimaAtualizacaoDatajud) || "Nao sincronizada"} />
          <Info label="Ultima sincronizacao" value={formatDate(processo.ultimaSincronizacao) || "Nunca"} />
        </div>

        <div className="button-row">
          <form action={sincronizarProcessoLexGestor}>
            <input type="hidden" name="processo_id" value={processo.id} />
            <button className="button" type="submit">
              <RefreshCw size={16} aria-hidden />
              Atualizar eventos
            </button>
          </form>
          {processo.urlEproc ? (
            <a className="button secondary" href={processo.urlEproc} target="_blank" rel="noreferrer">
              <SquareArrowOutUpRight size={16} aria-hidden />
              Abrir no eproc
            </a>
          ) : null}
          <a className="button secondary" href={documentosHref(processo, "")}>
            <FileUp size={16} aria-hidden />
            Anexar documento geral
          </a>
          <form action={marcarMovimentacoesVistasLexGestor}>
            <input type="hidden" name="processo_id" value={processo.id} />
            <button className="button secondary" type="submit">Marcar movimentacoes como vistas</button>
          </form>
        </div>
      </section>

      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>Linha do tempo</h2>
            <p>{movimentacoes.length} evento(s) salvos para este processo.</p>
          </div>
        </div>

        {movimentacoes.length === 0 ? (
          <article className="empty-state">
            <strong>Nenhuma movimentacao salva</strong>
            <p>Clique em Atualizar eventos para consultar o DataJud/CNJ.</p>
          </article>
        ) : (
          <div className="timeline-list">
            {movimentacoes.map((movimentacao: LexMovimentacao) => (
              <TimelineEvent
                key={movimentacao.id}
                movimentacao={movimentacao}
                documentoCount={docsByMovimentacao.get(movimentacao.id) ?? 0}
                documentosUrl={documentosHref(processo, movimentacao.id)}
                eprocUrl={processo.urlEproc}
              />
            ))}
          </div>
        )}
      </section>
    </ResponsivePageContainer>
  );
}

function TimelineEvent({
  movimentacao,
  documentoCount,
  documentosUrl,
  eprocUrl,
}: {
  movimentacao: LexMovimentacao;
  documentoCount: number;
  documentosUrl: string;
  eprocUrl: string;
}) {
  const hasDocument = documentoCount > 0 || movimentacao.temDocumento;

  return (
    <article className="timeline-item">
      <div className="timeline-dot" aria-hidden />
      <div className="timeline-content">
        <div className="timeline-heading">
          <div>
            <strong>{movimentacao.nomeMovimento || "Movimentacao"}</strong>
            <span>{formatDate(movimentacao.dataMovimento) || "Data nao informada"}</span>
          </div>
          <span className={`status-pill${hasDocument ? " success" : " warning"}`}>
            {hasDocument ? "Documento salvo" : "Sem documento anexado"}
          </span>
        </div>
        <div className="detail-grid compact-detail">
          <Info label="Codigo" value={movimentacao.codigoMovimento || "-"} />
          <Info label="Evento" value={movimentacao.eventoNumero || "-"} />
        </div>
        {movimentacao.descricao ? <p>{movimentacao.descricao}</p> : null}
        <div className="button-row">
          <a className="button secondary" href={documentosUrl}>Anexar documento baixado do eproc</a>
          <a className="button secondary" href={documentosUrl}>Ver documentos</a>
          {eprocUrl ? <a className="button secondary" href={eprocUrl} target="_blank" rel="noreferrer">Abrir no eproc</a> : null}
        </div>
      </div>
    </article>
  );
}

function documentosHref(
  processo: { clienteId: string; casoId: string; id: string },
  movimentacaoId: string,
) {
  const params = new URLSearchParams();
  if (processo.clienteId) params.set("cliente", processo.clienteId);
  if (processo.casoId) params.set("caso", processo.casoId);
  params.set("processo", processo.id);
  if (movimentacaoId) params.set("movimentacao", movimentacaoId);
  return `/lexgestor/documentos?${params.toString()}#documentos`;
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
    "processo-salvo": "Processo salvo. Agora voce pode atualizar eventos pelo DataJud/CNJ.",
    "movimentacoes-vistas": "Movimentacoes marcadas como vistas.",
  };
  return messages[value] ?? value;
}
