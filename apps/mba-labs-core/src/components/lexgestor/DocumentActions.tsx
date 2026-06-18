"use client";

import Link from "next/link";
import { Download, Eye, FileText, FolderOpen, Printer } from "lucide-react";

export function DocumentActions({ url, path, id }: { url: string; path: string; id: string }) {
  const pdfUrl = `/api/lexgestor/pdf/watermark?documento=${encodeURIComponent(id)}`;
  const visualizarUrl = url || pdfUrl;

  function imprimirDocumento() {
    const janela = window.open(pdfUrl, "_blank", "noopener,noreferrer");

    if (!janela) {
      window.location.href = pdfUrl;
    }
  }

  return (
    <div className="button-row">
      <a className="button secondary" href={visualizarUrl} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }}>
        <Eye size={17} aria-hidden />
        Visualizar
      </a>

      {url ? (
        <a className="button secondary" href={url} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }}>
          <Download size={17} aria-hidden />
          Baixar
        </a>
      ) : null}

      <button className="button secondary" type="button" onClick={imprimirDocumento} style={{ cursor: "pointer" }}>
        <Printer size={17} aria-hidden />
        Imprimir
      </button>

      <Link className="button secondary" href={pdfUrl} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }}>
        <FileText size={17} aria-hidden />
        Gerar PDF
      </Link>

      <span className="badge">
        <FolderOpen size={14} aria-hidden /> {path || "Pasta pendente"}
      </span>
    </div>
  );
}
