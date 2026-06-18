"use client";

import Link from "next/link";
import { Download, Eye, FileText, FolderOpen, Printer, UploadCloud } from "lucide-react";

type DocumentActionsProps = {
  url: string;
  path: string;
  id: string;
  provider?: string;
  pdfPath?: string;
  pdfUrl?: string;
  pendingWithoutFile?: boolean;
};

export function DocumentActions({ url, path, id, pendingWithoutFile }: DocumentActionsProps) {
  const visualizarUrl = `/lexgestor/documentos/${encodeURIComponent(id)}`;
  const arquivoUrl = `/api/lexgestor/documentos/preview?documento=${encodeURIComponent(id)}`;
  const baixarUrl = `${arquivoUrl}&download=1`;
  const gerarPdfUrl = `/api/lexgestor/pdf/watermark?documento=${encodeURIComponent(id)}`;
  const reenviarUrl = `/lexgestor/documentos?reenviar=${encodeURIComponent(id)}#documentos`;

  function imprimirDocumento() {
    const janela = window.open(path || url ? arquivoUrl : gerarPdfUrl, "_blank", "noopener,noreferrer");

    if (!janela) {
      window.location.href = path || url ? arquivoUrl : gerarPdfUrl;
    }
  }

  return (
    <div className="button-row">
      <a className="button secondary" href={visualizarUrl} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }}>
        <Eye size={17} aria-hidden />
        Ver no LexGestor
      </a>

      {url || path ? (
        <a className="button secondary" href={baixarUrl} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }}>
          <Download size={17} aria-hidden />
          Baixar
        </a>
      ) : null}

      {path || url ? (
        <button className="button secondary" type="button" onClick={imprimirDocumento} style={{ cursor: "pointer" }}>
          <Printer size={17} aria-hidden />
          Imprimir
        </button>
      ) : null}

      {pendingWithoutFile ? (
        <Link className="button" href={reenviarUrl} style={{ cursor: "pointer" }}>
          <UploadCloud size={17} aria-hidden />
          Reenviar arquivo
        </Link>
      ) : (
        <Link className="button secondary" href={gerarPdfUrl} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }}>
          <FileText size={17} aria-hidden />
          Gerar PDF
        </Link>
      )}

      {path ? (
        <span className="badge path-badge" title={path}>
          <FolderOpen size={14} aria-hidden /> Pasta no Dropbox: {path}
        </span>
      ) : null}
    </div>
  );
}
