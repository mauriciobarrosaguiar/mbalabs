import Link from "next/link";
import { Download, FileQuestion, FileText, UploadCloud } from "lucide-react";
import { EmptyState } from "@/components/lexgestor/EmptyState";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData, type LexDocumento } from "@/lib/lexgestor/data";

type DocumentoViewerPageProps = {
  params: Promise<{ documentoId: string }>;
};

export default async function DocumentoViewerPage({ params }: DocumentoViewerPageProps) {
  const { documentoId } = await params;
  const data = await getLexWorkspaceData(`/lexgestor/documentos/${documentoId}`);
  const documento = data.documentos.find((item) => item.id === documentoId);

  if (!documento) {
    return (
      <ResponsivePageContainer title="Documento não encontrado">
        <EmptyState title="Registro indisponível" description="Verifique se o documento existe ou se o acesso está liberado." />
      </ResponsivePageContainer>
    );
  }

  const hasOriginalFile = Boolean(documento.storagePath || documento.storageUrl);
  const previewUrl = `/api/lexgestor/documentos/preview?documento=${encodeURIComponent(documento.id)}`;
  const downloadUrl = `${previewUrl}&download=1`;
  const reuploadUrl = `/lexgestor/documentos?reenviar=${encodeURIComponent(documento.id)}#documentos`;

  return (
    <ResponsivePageContainer
      title={documento.tipo || "Documento"}
      description={`${documento.cliente} - ${documento.caso}`}
      action={
        <Link className="button secondary" href={`/lexgestor/documentos?cliente=${documento.clienteId}&caso=${documento.casoId}`}>
          Voltar aos documentos
        </Link>
      }
    >
      <section className="card stack document-viewer-card">
        <div className="section-title">
          <div>
            <h2>{documento.nome}</h2>
            <p>{documento.categoria} / {documento.subcategoria}</p>
          </div>
          <span className="status-pill">{documento.status}</span>
        </div>

        {!hasOriginalFile ? (
          <div className="empty-state">
            <FileQuestion size={32} color="var(--primary)" aria-hidden />
            <strong>Arquivo original não encontrado.</strong>
            <p>Reenvie o arquivo para salvar no armazenamento do escritório e liberar visualização, download e PDF.</p>
            <Link className="button" href={reuploadUrl}>
              <UploadCloud size={17} aria-hidden />
              Reenviar arquivo
            </Link>
          </div>
        ) : (
          <>
            <DocumentPreview documento={documento} previewUrl={previewUrl} />
            <div className="button-row">
              <a className="button" href={downloadUrl}>
                <Download size={17} aria-hidden />
                Baixar arquivo
              </a>
              <a className="button secondary" href={`/api/lexgestor/pdf/watermark?documento=${documento.id}`}>
                <FileText size={17} aria-hidden />
                Gerar PDF com marca d'água
              </a>
              {documento.storagePath ? (
                <span className="badge path-badge" title={documento.storagePath}>
                  Local no {storageProviderLabel(documento.provider)}
                </span>
              ) : null}
            </div>
          </>
        )}
      </section>
    </ResponsivePageContainer>
  );
}

function storageProviderLabel(provider: string) {
  if (provider === "google_drive") return "Google Drive";
  if (provider === "dropbox") return "Dropbox";
  return "armazenamento";
}

function DocumentPreview({ documento, previewUrl }: { documento: LexDocumento; previewUrl: string }) {
  const lowerName = documento.nome.toLowerCase();
  const mimeType = documento.mimeType.toLowerCase();
  const isImage = mimeType.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lowerName);
  const isPdf = mimeType.includes("pdf") || lowerName.endsWith(".pdf");

  if (isImage) {
    return (
      <div className="document-preview-frame image-preview-frame">
        <img src={previewUrl} alt={`Visualização de ${documento.nome}`} />
      </div>
    );
  }

  if (isPdf) {
    return (
      <iframe
        className="document-preview-frame"
        title={`Visualização de ${documento.nome}`}
        src={previewUrl}
      />
    );
  }

  return (
    <div className="empty-state">
      <FileText size={32} color="var(--primary)" aria-hidden />
      <strong>Pré-visualização indisponível para este tipo de arquivo.</strong>
      <p>Use o botão de baixar para abrir o arquivo no aplicativo compatível.</p>
    </div>
  );
}
