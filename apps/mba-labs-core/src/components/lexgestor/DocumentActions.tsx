"use client";

import Link from "next/link";
import { Download, Eye, FileText, FolderOpen, Printer } from "lucide-react";

type DocumentActionsProps = {
  url: string;
  path: string;
  id: string;
  provider?: string;
  pdfPath?: string;
  pdfUrl?: string;
};

export function DocumentActions({ url, path, id, provider = "", pdfPath = "", pdfUrl = "" }: DocumentActionsProps) {
  const apiPdfUrl = `/api/lexgestor/pdf/watermark?documento=${encodeURIComponent(id)}`;
  const originalStorageUrl = path ? storageHomeUrl(path, provider) : "";
  const pdfStorageUrl = pdfPath ? storageHomeUrl(pdfPath, provider) : "";
  const visualizarUrl = url || originalStorageUrl || pdfUrl || pdfStorageUrl || apiPdfUrl;
  const gerarPdfUrl = pdfUrl || pdfStorageUrl || apiPdfUrl;

  function imprimirDocumento() {
    const janela = window.open(gerarPdfUrl, "_blank", "noopener,noreferrer");

    if (!janela) {
      window.location.href = gerarPdfUrl;
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

      <Link className="button secondary" href={gerarPdfUrl} target="_blank" rel="noreferrer" style={{ cursor: "pointer" }}>
        <FileText size={17} aria-hidden />
        Gerar PDF
      </Link>

      <span className={`badge${path ? "" : " warning"}`}>
        <FolderOpen size={14} aria-hidden /> {path || "Pasta pendente - reenvie o arquivo"}
      </span>
    </div>
  );
}

function storageHomeUrl(path: string, provider: string) {
  const clean = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  if (provider === "google_drive") return "";
  return `https://www.dropbox.com/home/${clean}`;
}
