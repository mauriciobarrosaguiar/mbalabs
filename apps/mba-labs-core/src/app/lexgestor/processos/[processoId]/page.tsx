import { FileUp, RefreshCw, SquareArrowOutUpRight } from "lucide-react";
import { marcarMovimentacoesVistasLexGestor, sincronizarProcessoLexGestor } from "@/app/lexgestor/actions";
import { EmptyState } from "@/components/lexgestor/EmptyState";
import { ProcessoTribunalActions } from "@/components/lexgestor/ProcessoTribunalActions";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData, type LexDocumento } from "@/lib/lexgestor/data";
import {
  getProcessoLex,
  listConectoresTribunais,
  type LexConectorTribunal,
  type LexMovimentacao,
  type LexProcesso,
} from "@/lib/lexgestor/processos";

type ProcessoDetalhePageProps = {
  params: Promise<{ processoId: string }>;
  searchParams?: Promise<{ erro?: string; status?: string }>;
};

export default async function ProcessoDetalhePage({ params, searchParams }: ProcessoDetalhePageProps) {
  const { processoId } = await params;
  const query = (await searchParams) ?? {};
  const data = await getLexWorkspaceData(`/lexgestor/processos/${processoId}`);
  const escritorioId = String(data.escritorio?.id ?? "");
  const [result, conectores] = await Promise.all([
    getProcessoLex({ current: data.current, escritorioId, processoId }),
    listConectoresTribunais({ current: data.current, escritorioId, filters: { status: "ativo" } }),
  ]);

  if (!result) {
    return (
      <ResponsivePageContainer title="Processo não encontrado">
        <EmptyState title="Registro indisponível" description="Verifique se o processo existe ou se pertence ao seu escritório." />
      </ResponsivePageContainer>
    );
  }

  const { processo, movimentacoes } = result;
  const sistemaJudicial = processo.sistemaJudicial || "eproc";
  const conector = findConector(conectores, sistemaJudicial, processo.tribunal);
  const tribunalUrl = processo.urlEproc || conector?.urlBase || "";
  const documentosDoProcesso = data.documentos.filter((documento) => documento.processoId === processo.id);
  const docsByMovimentacao = new Map<string, LexDocumento[]>();
  for (const documento of documentosDoProcesso) {
    const movimentacaoId = documento.movimentacaoId;
    if (!movimentacaoId) continue;
    docsByMovimentacao.set(movimentacaoId, [...(docsByMovimentacao.get(movimentacaoId) ?? []), documento]);
  }
  const anexosSalvos = documentosDoProcesso.filter((documento) => documento.storagePath || documento.storageUrl || documento.pdfPath || documento.pdfUrl).length;

  return (
    <ResponsivePageContainer
      title={processo.numeroCnj}
      description={`${processo.clienteNome} ${processo.casoTitulo ? `- ${processo.casoTitulo}` : ""}`}
    >
      {query.erro ? <p className="notice danger" role="alert">{feedbackMessage(query.erro)}</p> : null}
      {query.status ? <p className="notice success" role="status">{feedbackMessage(query.status)}</p> : null}

      <p className="notice">
        O LexGestor consulta movimentações públicas pelo DataJud/CNJ. PDFs e anexos internos do eproc/PJe/Projudi devem ser acessados pelo advogado no sistema oficial e anexados aqui. O LexGestor não salva senha de tribunais.
      </p>

      {!processo.casoId ? (
        <p className="notice warning">
          Este processo ainda não está vinculado a um caso. Crie ou vincule um caso para manter os documentos organizados antes de anexar PDFs do tribunal.
        </p>
      ) : null}

      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>Dados principais</h2>
            <p>Atualize eventos públicos e organize anexos salvos pelo escritório.</p>
          </div>
          {processo.possuiNovaMovimentacao ? <span className="badge warning">Nova movimentação</span> : null}
        </div>

        <div className="detail-grid">
          <Info label="Cliente" value={processo.clienteNome} />
          <Info label="Caso vinculado" value={processo.casoTitulo || "Sem caso vinculado"} />
          <Info label="Tribunal" value={processo.tribunal} />
          <Info label="Sistema judicial" value={sistemaJudicialLabel(sistemaJudicial)} />
          <Info label="Grau" value={processo.grau} />
          <Info label="Classe" value={processo.classeNome || "Não sincronizada"} />
          <Info label="Assuntos" value={processo.categoria || "-"} />
          <Info label="Órgão julgador" value={processo.orgaoJulgadorNome || "Não sincronizado"} />
          <Info label="Eventos sincronizados" value={`${movimentacoes.length} evento(s)`} />
          <Info label="Anexos salvos" value={`${anexosSalvos} anexo(s)`} />
          <Info label="Última atualização" value={formatDate(processo.dataUltimaAtualizacaoDatajud) || "Não sincronizada"} />
          <Info label="Última sincronização" value={formatDate(processo.ultimaSincronizacao) || "Nunca"} />
        </div>

        <div className="button-row">
          <form action={sincronizarProcessoLexGestor}>
            <input type="hidden" name="processo_id" value={processo.id} />
            <button className="button" type="submit">
              <RefreshCw size={16} aria-hidden />
              Atualizar eventos
            </button>
          </form>
          <span className="muted">Busca movimentações públicas no DataJud/CNJ.</span>
          {tribunalUrl ? (
            <a className="button secondary" href={tribunalUrl} target="_blank" rel="noreferrer">
              <SquareArrowOutUpRight size={16} aria-hidden />
              Abrir no tribunal
            </a>
          ) : (
            <button className="button secondary" type="button" disabled title="Link do tribunal não informado neste processo.">
              Abrir no tribunal
            </button>
          )}
          {processo.casoId ? (
            <a className="button secondary" href={documentosHref(processo, null)}>
              <FileUp size={16} aria-hidden />
              Anexar PDF baixado do tribunal
            </a>
          ) : (
            <a className="button secondary" href={criarCasoHref(processo)}>
              Criar caso para este processo
            </a>
          )}
          <form action={marcarMovimentacoesVistasLexGestor}>
            <input type="hidden" name="processo_id" value={processo.id} />
            <button className="button secondary" type="submit">Marcar movimentações como vistas</button>
          </form>
        </div>
      </section>

      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>Fluxo assistido do tribunal</h2>
            <p>Use o login local do advogado no sistema oficial. Nenhuma credencial fica salva no LexGestor.</p>
          </div>
          <span className={`status-pill${conector ? " success" : " warning"}`}>
            {conector ? "Conector configurado" : "Conector não configurado"}
          </span>
        </div>
        <ProcessoTribunalActions
          processoId={processo.id}
          numeroCnj={processo.numeroCnj}
          chaveProcesso={processo.chaveEprocOpcional}
          tribunalUrl={tribunalUrl}
          anexarUrl={processo.casoId ? documentosHref(processo, null) : criarCasoHref(processo)}
          canAttach={Boolean(processo.casoId)}
          hasConnector={Boolean(conector)}
        />
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
            <strong>Nenhuma movimentação salva</strong>
            <p>Clique em Atualizar eventos para consultar o DataJud/CNJ.</p>
          </article>
        ) : (
          <div className="timeline-list">
            {movimentacoes.map((movimentacao: LexMovimentacao) => (
              <TimelineEvent
                key={movimentacao.id}
                processo={processo}
                movimentacao={movimentacao}
                documentos={docsByMovimentacao.get(movimentacao.id) ?? []}
                documentosUrl={documentosHref(processo, movimentacao)}
                tribunalUrl={tribunalUrl}
              />
            ))}
          </div>
        )}
      </section>
    </ResponsivePageContainer>
  );
}

function TimelineEvent({
  processo,
  movimentacao,
  documentos,
  documentosUrl,
  tribunalUrl,
}: {
  processo: LexProcesso;
  movimentacao: LexMovimentacao;
  documentos: LexDocumento[];
  documentosUrl: string;
  tribunalUrl: string;
}) {
  const hasDocument = documentos.length > 0 || movimentacao.temDocumento;
  const status = documentStatus(documentos, hasDocument);
  const canAttach = Boolean(processo.casoId);

  return (
    <article className="timeline-item">
      <div className="timeline-dot" aria-hidden />
      <div className="timeline-content">
        <div className="timeline-heading">
          <div>
            <strong>{movimentacao.nomeMovimento || "Movimentação"}</strong>
            <span>{formatDate(movimentacao.dataMovimento) || "Data não informada"}</span>
          </div>
          <span className={`status-pill${hasDocument ? " success" : " warning"}`}>
            {status}
          </span>
        </div>
        <div className="detail-grid compact-detail">
          <Info label="Tipo do evento" value={movimentacao.nomeMovimento || "-"} />
          <Info label="Data/hora" value={formatDate(movimentacao.dataMovimento) || "-"} />
          <Info label="Código" value={movimentacao.codigoMovimento || "-"} />
          <Info label="Número do evento" value={movimentacao.eventoNumero || "-"} />
          <Info label="Anexos salvos" value={`${documentos.length || (movimentacao.temDocumento ? 1 : 0)} anexo(s)`} />
        </div>
        {movimentacao.descricao ? <p><strong>Descrição:</strong> {movimentacao.descricao}</p> : null}
        <div className="button-row">
          {tribunalUrl ? (
            <a className="button secondary" href={tribunalUrl} target="_blank" rel="noreferrer">Abrir no tribunal</a>
          ) : (
            <button className="button secondary" type="button" disabled title="Link do tribunal não informado neste processo.">
              Abrir no tribunal
            </button>
          )}
          {canAttach ? (
            <a className="button secondary" href={documentosUrl}>Anexar PDF</a>
          ) : (
            <a className="button secondary" href={`/lexgestor/casos/novo?cliente=${encodeURIComponent(processo.clienteId)}`}>
              Criar caso para este processo
            </a>
          )}
          <a className="button secondary" href={documentosUrl}>Ver anexos salvos</a>
        </div>
      </div>
    </article>
  );
}

function criarCasoHref(processo: LexProcesso) {
  const params = new URLSearchParams();
  if (processo.clienteId) params.set("cliente", processo.clienteId);
  return `/lexgestor/casos/novo${params.toString() ? `?${params.toString()}` : ""}`;
}

function documentosHref(processo: LexProcesso, movimentacao: LexMovimentacao | null) {
  const params = new URLSearchParams();
  if (processo.clienteId) params.set("cliente", processo.clienteId);
  if (processo.casoId) params.set("caso", processo.casoId);
  params.set("processo", processo.id);
  if (movimentacao?.id) {
    params.set("movimentacao", movimentacao.id);
    params.set("observacoes", `Documento anexado a partir do evento ${movimentacao.eventoNumero || movimentacao.codigoMovimento || "-"} do processo ${processo.numeroCnj}.`);
  }
  if (processo.categoria) params.set("categoria", processo.categoria);
  if (processo.subcategoria) params.set("subcategoria", processo.subcategoria);
  params.set("origem", "Tribunal/eproc");
  params.set("tipo", "Documento do processo");
  return `/lexgestor/documentos?${params.toString()}#documentos`;
}

function documentStatus(documentos: LexDocumento[], hasDocument: boolean) {
  if (!hasDocument) return "Sem anexo salvo";
  if (documentos.some((documento) => documento.provider === "google_drive" && (documento.pdfPath || documento.pdfUrl || documento.storagePath || documento.storageUrl))) {
    return "PDF salvo no Google Drive";
  }
  if (documentos.some((documento) => documento.provider === "dropbox" && (documento.pdfPath || documento.pdfUrl || documento.storagePath || documento.storageUrl))) {
    return "PDF salvo no Dropbox";
  }
  return "Anexo salvo no LexGestor";
}

function findConector(conectores: LexConectorTribunal[], sistema: string, tribunal: string) {
  const normalizedSistema = normalize(sistema);
  const normalizedTribunal = normalize(tribunal);
  return conectores.find((conector) =>
    normalize(conector.sistema) === normalizedSistema &&
    (!normalizedTribunal || normalize(conector.tribunal) === normalizedTribunal),
  ) ?? conectores.find((conector) => normalize(conector.sistema) === normalizedSistema);
}

function sistemaJudicialLabel(value: string) {
  const normalized = normalize(value);
  if (normalized === "pje") return "PJe";
  if (normalized === "projudi") return "Projudi";
  if (normalized === "esaj") return "ESAJ";
  if (normalized === "eproc") return "eproc";
  return value || "Outro";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
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
    "processo-salvo": "Processo salvo. Agora você pode atualizar eventos pelo DataJud/CNJ.",
    "movimentacoes-vistas": "Movimentações marcadas como vistas.",
    "processo-duplicado": "Este processo já está cadastrado neste escritório.",
  };
  return messages[value] ?? value;
}
