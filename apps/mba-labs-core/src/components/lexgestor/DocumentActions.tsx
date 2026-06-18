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
  const resolvedPdfPath = pdfPath || inferPdfPath(path);
  const pdfStorageUrl = resolvedPdfPath ? storageHomeUrl(resolvedPdfPath, provider) : "";
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
  if (!path || provider === "google_drive") return "";
  const clean = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `https://www.dropbox.com/home/${clean}`;
}

function inferPdfPath(path: string) {
  if (!path || !path.includes("/01 - Originais/")) return "";
  const parts = path.split("/");
  const fileName = parts.pop() || "documento";
  const pdfName = `${fileName.replace(/\.[^.]+$/, "") || "documento"}-marca-dagua.pdf`;
  return `${parts.join("/").replace("/01 - Originais", "/02 - PDF com Marca d'agua")}/${pdfName}`;
}
