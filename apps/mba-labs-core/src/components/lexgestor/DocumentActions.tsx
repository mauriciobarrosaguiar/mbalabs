"use client";

import Link from "next/link";
import { excluirDocumentoLexGestor } from "@/app/lexgestor/actions";
import { Download, Eye, FileText, FolderOpen, Printer, Trash2, UploadCloud } from "lucide-react";

type DocumentActionsProps = {
  url: string;
  path: string;
  id: string;
  provider?: string;
  pdfPath?: string;
  pdfUrl?: string;
  pendingWithoutFile?: boolean;
};

export function DocumentActions({ url, path, id, provider, pendingWithoutFile }: DocumentActionsProps) {
  const visualizarUrl = `/lexgestor/documentos/${encodeURIComponent(id)}`;
  const arquivoUrl = `/api/lexgestor/documentos/preview?documento=${encodeURIComponent(id)}`;
  const baixarUrl = `${arquivoUrl}&download=1`;
  const gerarPdfUrl = `/api/lexgestor/pdf/watermark?documento=${encodeURIComponent(id)}`;
  const reenviarUrl = `/lexgestor/documentos?reenviar=${encodeURIComponent(id)}#documentos`;
  const providerName = storageProviderLabel(provider);

  function imprimirDocumento() {
    const janela = window.open(path || url ? arquivoUrl : gerarPdfUrl, "_blank", "noopener,noreferrer");

    if (!janela) {
      window.location.href = path || url ? arquivoUrl : gerarPdfUrl;
    }
  }

  return (
    <div className="button-row document-actions">
      <Link className="button secondary icon-button" href={visualizarUrl} style={{ cursor: "pointer" }} title="Ver no LexGestor" aria-label="Ver no LexGestor">
        <Eye size={17} aria-hidden />
        <span>Ver</span>
      </Link>

      {url || path ? (
        <a className="button secondary icon-button" href={baixarUrl} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }} title="Baixar original" aria-label="Baixar original">
          <Download size={17} aria-hidden />
          <span>Baixar</span>
        </a>
      ) : null}

      {path || url ? (
        <button className="button secondary icon-button" type="button" onClick={imprimirDocumento} style={{ cursor: "pointer" }} title="Imprimir" aria-label="Imprimir">
          <Printer size={17} aria-hidden />
          <span>Imprimir</span>
        </button>
      ) : null}

      {pendingWithoutFile ? (
        <Link className="button icon-button" href={reenviarUrl} style={{ cursor: "pointer" }} title="Reenviar arquivo" aria-label="Reenviar arquivo">
          <UploadCloud size={17} aria-hidden />
          <span>Reenviar</span>
        </Link>
      ) : (
        <Link className="button secondary icon-button" href={gerarPdfUrl} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }} title="Gerar PDF com marca d'água" aria-label="Gerar PDF com marca d'água">
          <FileText size={17} aria-hidden />
          <span>PDF</span>
        </Link>
      )}

      {url ? (
        <a className="button secondary icon-button" href={url} target="_blank" rel="noreferrer" title={`Abrir no ${providerName}`} aria-label={`Abrir no ${providerName}`}>
          <FolderOpen size={17} aria-hidden />
          <span>Local</span>
        </a>
      ) : path ? (
        <span className="badge path-badge" title={path}>
          <FolderOpen size={14} aria-hidden /> {providerName}
        </span>
      ) : null}

      <form
        action={excluirDocumentoLexGestor}
        onSubmit={(event) => {
          if (!window.confirm("Tem certeza que deseja excluir este documento? Esta ação removerá o registro e, se possível, os arquivos no armazenamento conectado.")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="documento_id" value={id} />
        <button className="button secondary icon-button danger-button" type="submit" style={{ cursor: "pointer" }} title="Excluir" aria-label="Excluir">
          <Trash2 size={17} aria-hidden />
          <span>Excluir</span>
        </button>
      </form>
    </div>
  );
}

function storageProviderLabel(provider?: string) {
  if (provider === "google_drive") return "Google Drive";
  if (provider === "dropbox") return "Dropbox";
  return "armazenamento";
}
