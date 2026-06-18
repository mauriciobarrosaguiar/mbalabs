import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { ensureLexEscritorio, getLexSupabaseClient } from "@/lib/lexgestor/data";
import { downloadFromConnectedStorage } from "@/lib/lexgestor/storage-read";
import { isStorageProvider } from "@/lib/lexgestor/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentoId = url.searchParams.get("documento") || "";
  const arquivo = url.searchParams.get("arquivo") === "pdf" ? "pdf" : "original";
  const shouldDownload = url.searchParams.get("download") === "1";

  if (!documentoId) {
    return friendlyPreviewError("Documento não informado.", 400);
  }

  const current = await requireAppAccess("lexgestor", "/lexgestor/documentos");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    return friendlyPreviewError("Escritório não configurado.", 400);
  }

  const result = await client
    .from("lex_documentos")
    .select("*")
    .eq("id", documentoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (result.error || !result.data) {
    return friendlyPreviewError("Documento não encontrado para este escritório.", 404);
  }

  const documento = result.data as Record<string, unknown>;
  const providerValue = text(documento.storage_provider) || (text(documento.dropbox_path_original) ? "dropbox" : "");

  if (!isStorageProvider(providerValue)) {
    return friendlyPreviewError("Documento sem arquivo no armazenamento. Reenvie o arquivo para visualizar.", 404);
  }

  const path = arquivo === "pdf"
    ? text(documento.pdf_storage_path) || text(documento.dropbox_path_pdf_marca_dagua)
    : text(documento.storage_path) || text(documento.dropbox_path_original) || text(documento.pdf_storage_path);
  const fileId = arquivo === "pdf" ? text(documento.pdf_storage_file_id) : text(documento.storage_file_id);

  if (!path && !fileId) {
    return friendlyPreviewError("Arquivo ainda pendente. Reenvie o documento para concluir.", 404);
  }

  const arquivoBaixado = await downloadFromConnectedStorage({
    current,
    provider: providerValue,
    path,
    fileId,
  }).catch(() => null);

  if (!arquivoBaixado) {
    return friendlyPreviewError("Não foi possível abrir o arquivo no armazenamento do escritório.", 404);
  }

  const filename = arquivoBaixado.fileName || text(documento.nome_original) || "documento";
  const body = toArrayBuffer(arquivoBaixado.bytes);

  return new NextResponse(body, {
    headers: {
      "content-type": arquivoBaixado.mimeType || "application/octet-stream",
      "content-disposition": `${shouldDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "private, no-store",
    },
  });
}

function friendlyPreviewError(message: string, status: number) {
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Documento indisponível</title><body style="font-family:Arial,sans-serif;margin:32px;color:#172033"><h1 style="font-size:20px">Documento indisponível</h1><p>${escapeHtml(message)}</p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

function escapeHtml(value: string) {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (char) => map[char] ?? char);
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toArrayBuffer(value: unknown): ArrayBuffer {
  if (value instanceof ArrayBuffer) {
    return value;
  }

  if (ArrayBuffer.isView(value)) {
    const view = value as Uint8Array;
    const copy = new Uint8Array(view.byteLength);
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
    return copy.buffer as ArrayBuffer;
  }

  if (Array.isArray(value)) {
    return new Uint8Array(value).buffer as ArrayBuffer;
  }

  return new TextEncoder().encode(String(value ?? "")).buffer as ArrayBuffer;
}
