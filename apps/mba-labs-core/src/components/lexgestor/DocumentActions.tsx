"use client";

import Link from "next/link";
import { Download, Eye, FileText, FolderOpen, Printer } from "lucide-react";

export function DocumentActions({ url, path, id }: { url: string; path: string; id: string }) {
  return (
    <div className="button-row">
      {url ? (
        <a className="button secondary" href={url} target="_blank" rel="noreferrer">
          <Eye size={17} aria-hidden />
          Visualizar
        </a>
      ) : (
        <button className="button secondary" type="button" disabled>
          <Eye size={17} aria-hidden />
          Visualizar
        </button>
      )}
      {url ? (
        <a className="button secondary" href={url} target="_blank" rel="noreferrer">
          <Download size={17} aria-hidden />
          Baixar
        </a>
      ) : null}
      <button className="button secondary" type="button" onClick={() => window.print()}>
        <Printer size={17} aria-hidden />
        Imprimir
      </button>
      <Link className="button secondary" href={`/api/lexgestor/pdf/watermark?documento=${id}`}>
        <FileText size={17} aria-hidden />
        Gerar PDF
      </Link>
      <span className="badge">
        <FolderOpen size={14} aria-hidden /> {path || "Pasta pendente"}
      </span>
    </div>
  );
}
