import { FileText } from "lucide-react";
import { atualizarPendentesDocumentosLexGestor } from "@/app/lexgestor/actions";
import { DocumentActions } from "@/components/lexgestor/DocumentActions";
import { PdfPreview } from "@/components/lexgestor/PdfPreview";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { UploadDocumentos } from "@/components/lexgestor/UploadDocumentos";
import { getLexWorkspaceData, type LexDocumento } from "@/lib/lexgestor/data";

type DocumentosPageProps = {
  searchParams?: Promise<{ cliente?: string; caso?: string; reenviar?: string; erro?: string; status?: string }>;
};

export default async function DocumentosPage({ searchParams }: DocumentosPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/documentos");
  const casoSelecionado = params.caso ? data.casos.find((caso) => caso.id === params.caso) : null;
  const documentoParaReenviar = params.reenviar
    ? data.documentos.find((documento) => documento.id === params.reenviar)
    : null;
  const documentosFiltrados = data.documentos.filter((documento) => {
    if (params.caso && documento.casoId !== params.caso) return false;
    if (params.cliente && documento.clienteId !== params.cliente) return false;
    return true;
  });
  const documentosVisiveis = dedupeDocumentos(documentosFiltrados);

  return (
    <ResponsivePageContainer
      title="Documentos"
      description="Originais ficam no Dropbox ou Google Drive do escritório. O LexGestor guarda apenas os dados necessários para organizar os arquivos."
    >
      <div className="button-row">
        <form action={atualizarPendentesDocumentosLexGestor}>
          <button className="button secondary" type="submit">Atualizar pendentes</button>
        </form>
        <a className="button secondary" href="/lexgestor/relatorios">Gerar dossiê</a>
        <a className="button secondary" href="/api/lexgestor/relatorios/pdf?tipo=documentos" target="_blank" rel="noreferrer">Imprimir</a>
      </div>
      {params.erro ? <p className="notice danger" role="alert">{feedbackMessage(params.erro)}</p> : null}
      {params.status ? <p className="notice success" role="status">{feedbackMessage(params.status)}</p> : null}
      {data.error ? <p className="notice">Documentos ainda indisponíveis: {data.error}</p> : null}
      {documentoParaReenviar ? (
        <p className="notice warning" role="status">
          Reenvio preparado para <strong>{documentoParaReenviar.nome}</strong>. Escolha o arquivo e envie para atualizar o registro antigo.
        </p>
      ) : null}
      <UploadDocumentos
        clientes={data.clientes}
        casos={data.casos}
        categorias={data.categorias}
        connections={data.storageConnections}
        defaultClienteId={documentoParaReenviar?.clienteId ?? params.cliente ?? casoSelecionado?.clienteId ?? ""}
        defaultCasoId={documentoParaReenviar?.casoId ?? params.caso ?? ""}
        defaultCategoria={documentoParaReenviar?.categoria ?? casoSelecionado?.categoria ?? ""}
        defaultSubcategoria={documentoParaReenviar?.subcategoria ?? casoSelecionado?.subcategoria ?? ""}
        defaultTipoDocumento={documentoParaReenviar?.tipo ?? ""}
        defaultObservacoes={documentoParaReenviar?.observacoes ?? ""}
        replaceDocumentId={documentoParaReenviar?.id ?? ""}
      />

      <section className="table-panel desktop-only">
        <table className="responsive-table documents-table">
          <colgroup>
            <col style={{ width: "30%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "21%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Documento</th>
              <th>Cliente/Caso</th>
              <th>Categoria</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {documentosVisiveis.length === 0 ? (
              <tr>
                <td colSpan={5}>Nenhum documento cadastrado.</td>
              </tr>
            ) : (
              documentosVisiveis.map((documento) => (
                <tr key={documento.id}>
                  <td>
                    <div className="document-title">
                      <FileText size={17} aria-hidden />
                      <strong>{documento.tipo}</strong>
                      <span>{documento.nome}</span>
                    </div>
                    {isPendingWithoutFile(documento) ? (
                      <p className="notice compact danger">
                        Este documento foi cadastrado antes da conexão com o armazenamento. Reenvie o arquivo para salvar no provedor do escritório.
                      </p>
                    ) : null}
                  </td>
                  <td>
                    {documento.cliente}
                    <br />
                    <span className="muted">{documento.caso}</span>
                  </td>
                  <td>{documento.categoria} / {documento.subcategoria}</td>
                  <td>
                    <span className="status-pill">{documento.status}</span>
                  </td>
                  <td>
                    <DocumentActions
                      url={documento.storageUrl}
                      path={documento.storagePath}
                      id={documento.id}
                      provider={documento.provider}
                      pendingWithoutFile={isPendingWithoutFile(documento)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="mobile-card-list mobile-only">
        {documentosVisiveis.length === 0 ? (
          <article className="empty-state">
            <strong>Nenhum documento cadastrado</strong>
            <p>Anexe o primeiro documento do caso.</p>
          </article>
        ) : (
          documentosVisiveis.map((documento) => (
            <article className="card stack document-mobile-card" key={documento.id}>
              <h2>{documento.tipo}</h2>
              <p>{documento.nome}</p>
              <div className="document-mobile-meta">
                <span>{documento.cliente}</span>
                <span>{documento.caso}</span>
                <span>{documento.categoria} / {documento.subcategoria}</span>
              </div>
              <div className="button-row">
                <span className="status-pill">{documento.status}</span>
                {documento.provider ? <span className="badge">{storageProviderLabel(documento.provider)}</span> : null}
              </div>
              {isPendingWithoutFile(documento) ? (
                <p className="notice compact danger">
                  Este documento foi cadastrado antes da conexão com o armazenamento. Reenvie o arquivo para salvar no provedor do escritório.
                </p>
              ) : null}
              <DocumentActions
                url={documento.storageUrl}
                path={documento.storagePath}
                id={documento.id}
                provider={documento.provider}
                pendingWithoutFile={isPendingWithoutFile(documento)}
              />
            </article>
          ))
        )}
      </section>
      <PdfPreview documentoId={documentosVisiveis[0]?.id} />
    </ResponsivePageContainer>
  );
}

function storageProviderLabel(provider: string) {
  if (provider === "google_drive") return "Google Drive";
  if (provider === "dropbox") return "Dropbox";
  return "Armazenamento";
}

function dedupeDocumentos(documentos: LexDocumento[]) {
  const unique = new Map<string, LexDocumento>();

  for (const documento of documentos) {
    if (["Substituído", "Substituído/Reenviado"].includes(documento.status)) continue;

    const key = [
      documento.clienteId,
      documento.casoId,
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
  return ["Pendente", "Pendente de reenvio", "Precisa reenviar", "Precisa reenviar arquivo", "Erro no envio"].includes(documento.status) &&
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
    "pendentes-atualizados": "Documentos pendentes revisados. Os arquivos sem original foram marcados para reenvio.",
    "sem-pendentes": "Nenhum documento pendente precisava de atualização.",
    "configure-escritorio": "Configure o escritório antes de atualizar documentos.",
  };

  return messages[value] ?? value;
}
