import { FileText, FolderOpen, PackageCheck } from "lucide-react";
import { atualizarPendentesDocumentosLexGestor } from "@/app/lexgestor/actions";
import { DocumentActions } from "@/components/lexgestor/DocumentActions";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { UploadDocumentos } from "@/components/lexgestor/UploadDocumentos";
import { getLexWorkspaceData, type LexDocumento } from "@/lib/lexgestor/data";
import { getProcessoLex } from "@/lib/lexgestor/processos";

type DocumentosPageProps = {
  searchParams?: Promise<{
    cliente?: string;
    caso?: string;
    processo?: string;
    movimentacao?: string;
    categoria?: string;
    subcategoria?: string;
    documento_status?: string;
    origem?: string;
    tipo?: string;
    observacoes?: string;
    status?: string;
    reenviar?: string;
    erro?: string;
  }>;
};

export default async function DocumentosPage({ searchParams }: DocumentosPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/documentos");
  const escritorioId = String(data.escritorio?.id ?? "");
  const processoContexto = params.processo
    ? await getProcessoLex({ current: data.current, escritorioId, processoId: params.processo }).catch(() => null)
    : null;
  const processoSelecionado = processoContexto?.processo ?? null;
  const movimentacaoSelecionada = processoContexto?.movimentacoes.find((movimentacao: { id: string }) => movimentacao.id === params.movimentacao) ?? null;
  const casoSelecionado = params.caso ? data.casos.find((caso) => caso.id === params.caso) : null;
  const documentoParaReenviar = params.reenviar
    ? data.documentos.find((documento) => documento.id === params.reenviar)
    : null;
  const filtroClienteId = params.cliente ?? documentoParaReenviar?.clienteId ?? casoSelecionado?.clienteId ?? "";
  const filtroCasoId = params.caso ?? documentoParaReenviar?.casoId ?? "";
  const shouldList = Boolean(filtroClienteId || filtroCasoId || params.processo || documentoParaReenviar?.id);
  const documentosFiltrados = shouldList
    ? data.documentos.filter((documento) => {
        if (filtroClienteId && documento.clienteId !== filtroClienteId) return false;
        if (filtroCasoId && documento.casoId !== filtroCasoId) return false;
        if (params.processo && documento.processoId !== params.processo) return false;
        if (params.movimentacao && documento.movimentacaoId !== params.movimentacao) return false;
        if (params.documento_status && documento.status !== params.documento_status) return false;
        return true;
      })
    : [];
  const documentosVisiveis = dedupeDocumentos(documentosFiltrados);
  const documentosPendentes = dedupeDocumentos(data.documentos.filter(isPendingWithoutFile));
  const shouldShowPendingReview = params.status === "pendentes-atualizados" || params.status === "sem-pendentes";
  const dossieCasoId = filtroCasoId || (documentosVisiveis.length > 0 && documentosVisiveis.every((doc) => doc.casoId === documentosVisiveis[0].casoId) ? documentosVisiveis[0].casoId : "");
  const defaultTipoDocumento = documentoParaReenviar?.tipo ?? params.tipo ?? (params.processo ? "Documento do processo" : "");
  const defaultObservacoes = documentoParaReenviar?.observacoes ?? params.observacoes ?? (
    processoSelecionado && movimentacaoSelecionada
      ? `Documento anexado a partir do evento ${movimentacaoSelecionada.eventoNumero || movimentacaoSelecionada.codigoMovimento || "-"} do processo ${processoSelecionado.numeroCnj}.`
      : ""
  );

  return (
    <ResponsivePageContainer title="Documentos">
      <div className="button-row">
        <a className="button" href="#documentos">Novo upload</a>
        <a className="button secondary" href="#lista-documentos">Ver documentos</a>
      </div>

      {params.erro ? <p className="notice danger" role="alert">{feedbackMessage(params.erro)}</p> : null}
      {params.status ? <p className="notice success" role="status">{feedbackMessage(params.status)}</p> : null}
      {data.error ? <p className="notice danger">{data.error}</p> : null}
      {documentoParaReenviar ? (
        <p className="notice warning" role="status">
          Reenvio: <strong>{documentoParaReenviar.nome}</strong>
        </p>
      ) : null}

      {processoSelecionado ? (
        <section className="form-card compact-stack">
          <div className="section-title">
            <div>
              <h2>Processo {processoSelecionado.numeroCnj}</h2>
              {movimentacaoSelecionada ? (
                <p>Evento {movimentacaoSelecionada.eventoNumero || movimentacaoSelecionada.codigoMovimento || "-"}</p>
              ) : null}
            </div>
            <span className="badge">Tribunal</span>
          </div>
        </section>
      ) : null}

      <UploadDocumentos
        clientes={data.clientes}
        casos={data.casos}
        categorias={data.categorias}
        connections={data.storageConnections}
        defaultClienteId={filtroClienteId}
        defaultCasoId={filtroCasoId}
        defaultCategoria={documentoParaReenviar?.categoria ?? params.categoria ?? casoSelecionado?.categoria ?? ""}
        defaultSubcategoria={documentoParaReenviar?.subcategoria ?? params.subcategoria ?? casoSelecionado?.subcategoria ?? ""}
        defaultTipoDocumento={defaultTipoDocumento}
        defaultObservacoes={defaultObservacoes}
        defaultOrigem={params.origem ?? (params.processo ? "Tribunal/eproc" : "Upload")}
        defaultOrigemSistema={params.processo ? "tribunal" : ""}
        replaceDocumentId={documentoParaReenviar?.id ?? ""}
        defaultProcessoId={params.processo ?? documentoParaReenviar?.processoId ?? ""}
        defaultMovimentacaoId={params.movimentacao ?? documentoParaReenviar?.movimentacaoId ?? ""}
      />

      <details className="form-card stack" id="lista-documentos" open={shouldList}>
        <summary className="advanced-summary">Buscar documentos</summary>
        <form className="field-grid compact-fields" action="/lexgestor/documentos">
          {params.processo ? <input type="hidden" name="processo" value={params.processo} /> : null}
          {params.movimentacao ? <input type="hidden" name="movimentacao" value={params.movimentacao} /> : null}
          <label className="field">
            Cliente
            <select name="cliente" defaultValue={filtroClienteId}>
              <option value="">Selecione</option>
              {data.clientes.map((cliente) => (
                <option value={cliente.id} key={cliente.id}>{cliente.nome}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Caso
            <select name="caso" defaultValue={filtroCasoId}>
              <option value="">Todos</option>
              {data.casos
                .filter((caso) => !filtroClienteId || caso.clienteId === filtroClienteId)
                .map((caso) => (
                  <option value={caso.id} key={caso.id}>{caso.titulo}</option>
                ))}
            </select>
          </label>
          <label className="field">
            Status
            <select name="documento_status" defaultValue={params.documento_status ?? ""}>
              <option value="">Todos</option>
              <option value="Pendente">Pendente</option>
              <option value="Enviado ao Dropbox">Enviado ao Dropbox</option>
              <option value="Enviado ao Drive">Enviado ao Drive</option>
              <option value="PDF gerado">PDF gerado</option>
              <option value="Falha no envio">Falha no envio</option>
              <option value="Precisa reenviar arquivo">Precisa reenviar arquivo</option>
            </select>
          </label>
          <div className="button-row">
            <button className="button secondary" type="submit">Filtrar</button>
            <a className="button secondary" href="/lexgestor/documentos">Limpar</a>
          </div>
        </form>
      </details>

      {!shouldList ? (
        <article className="empty-state">
          <strong>Selecione um cliente ou caso para visualizar os documentos.</strong>
        </article>
      ) : (
        <>
          <section className="document-list-toolbar">
            <form id="dossie-form" action="/api/lexgestor/relatorios/pdf">
              <input type="hidden" name="tipo" value="dossie" />
              {dossieCasoId ? <input type="hidden" name="caso" value={dossieCasoId} /> : null}
              <button className="button secondary" type="submit" disabled={!dossieCasoId || documentosVisiveis.length === 0}>
                <PackageCheck size={17} aria-hidden />
                Gerar dossiê
              </button>
            </form>
          </section>

          {documentosVisiveis.length === 0 ? (
            <article className="empty-state">
              <strong>Nenhum documento encontrado.</strong>
            </article>
          ) : null}

          <section className="document-line-list desktop-only">
            {documentosVisiveis.map((documento) => (
              <article className="document-line" key={documento.id}>
                <label className="document-select" title="Incluir no dossiê">
                  <input form="dossie-form" name="documento" type="checkbox" value={documento.id} />
                </label>
                <FileText size={19} color="var(--primary)" aria-hidden />
                <div className="document-line-main">
                  <strong>{documento.tipo}</strong>
                  <span>{documento.nome}</span>
                  <small>{documento.cliente} / {documento.caso}</small>
                </div>
                <div className="document-line-meta">
                  <span>{documento.categoria} / {documento.subcategoria}</span>
                  {documento.storagePath ? <button className="badge path-badge" type="button" title={documento.storagePath}>Local</button> : null}
                </div>
                <span className="status-pill">{documento.status}</span>
                <DocumentActions
                  url={documento.storageUrl}
                  path={documento.storagePath}
                  id={documento.id}
                  provider={documento.provider}
                  pdfPath={documento.pdfPath}
                  pdfUrl={documento.pdfUrl}
                  pendingWithoutFile={isPendingWithoutFile(documento)}
                />
              </article>
            ))}
          </section>

          <section className="mobile-card-list mobile-only">
            {documentosVisiveis.map((documento) => (
              <details className="card stack document-mobile-card" key={documento.id}>
                <summary>
                  <span>
                    <strong>{documento.tipo}</strong>
                    <small>{documento.nome}</small>
                  </span>
                  <span className="status-pill">{documento.status}</span>
                </summary>
                <div className="document-mobile-meta">
                  <span>{documento.cliente}</span>
                  <span>{documento.caso}</span>
                  <span>{documento.categoria} / {documento.subcategoria}</span>
                </div>
                <label className="check-option">
                  <input form="dossie-form" name="documento" type="checkbox" value={documento.id} />
                  <span>Incluir no dossiê</span>
                </label>
                {isPendingWithoutFile(documento) ? (
                  <p className="notice compact danger">Reenviar arquivo.</p>
                ) : null}
                <DocumentActions
                  url={documento.storageUrl}
                  path={documento.storagePath}
                  id={documento.id}
                  provider={documento.provider}
                  pdfPath={documento.pdfPath}
                  pdfUrl={documento.pdfUrl}
                  pendingWithoutFile={isPendingWithoutFile(documento)}
                />
              </details>
            ))}
          </section>
        </>
      )}

      <details className="form-card stack advanced-area" open={shouldShowPendingReview}>
        <summary className="advanced-summary">Avançado</summary>
        <div className="button-row">
          <form action={atualizarPendentesDocumentosLexGestor}>
            <button className="button secondary" type="submit">Revisar pendentes</button>
          </form>
          <a className="button secondary" href="/lexgestor/configuracoes#armazenamento">
            <FolderOpen size={17} aria-hidden />
            Pasta raiz
          </a>
        </div>
        <span className="badge">{documentosPendentes.length} pendente(s)</span>
        {documentosPendentes.length > 0 ? (
          <div className="compact-stack">
            {documentosPendentes.map((documento) => (
              <article className="list-row pending-document-row" key={documento.id}>
                <strong>{documento.tipo}: {documento.nome}</strong>
                <span>{documento.cliente} / {documento.caso}</span>
                <a className="button secondary" href={`/lexgestor/documentos?reenviar=${documento.id}#documentos`}>
                  Reenviar
                </a>
              </article>
            ))}
          </div>
        ) : null}
      </details>
    </ResponsivePageContainer>
  );
}

function dedupeDocumentos(documentos: LexDocumento[]) {
  const unique = new Map<string, LexDocumento>();

  for (const documento of documentos) {
    if (["Substituido", "Substituido/Reenviado"].includes(documento.status)) continue;

    const key = [
      documento.clienteId,
      documento.casoId,
      documento.processoId,
      documento.movimentacaoId,
      documento.tipo,
      documento.nome,
      documento.categoria,
      documento.subcategoria,
    ].map(normalizeKey).join("|");
    const current = unique.get(key);

    if (!current || documentScore(documento) >= documentScore(current)) {
      unique.set(key, documento);
    }
  }

  return Array.from(unique.values());
}

function isPendingWithoutFile(documento: LexDocumento) {
  return ["Pendente", "Original indisponível", "Original indisponivel", "Precisa reenviar arquivo", "Falha no envio"].includes(documento.status) &&
    !documento.storagePath &&
    !documento.storageUrl;
}

function documentScore(documento: LexDocumento) {
  const hasFile = documento.storagePath || documento.storageUrl || documento.pdfPath || documento.pdfUrl ? 1 : 0;
  const date = Date.parse(documento.criadoEm || "");
  return hasFile * 1_000_000_000_000 + (Number.isFinite(date) ? date : 0);
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function feedbackMessage(value: string) {
  const messages: Record<string, string> = {
    "pendentes-atualizados": "Pendentes revisados.",
    "sem-pendentes": "Nenhum pendente encontrado.",
    "documento-salvo": "Documento salvo.",
    "documento-removido": "Documento removido.",
    "documento-reenviado": "Documento reenviado.",
  };
  return messages[value] ?? value;
}
