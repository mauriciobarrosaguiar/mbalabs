import { NextResponse } from "next/server";
import { obterUsuarioLexGestorAtual } from "@/lib/lexgestor/auth";
import { getLexSupabaseClient, getLexWorkspaceData } from "@/lib/lexgestor/data";
import { resolvePdfBranding } from "@/lib/lexgestor/pdf-branding";
import { possuiPermissao } from "@/lib/lexgestor/permissions";
import { downloadFromConnectedStorage } from "@/lib/lexgestor/storage-read";
import { isStorageProvider, uploadToConnectedStorage } from "@/lib/lexgestor/storage";
import { createWatermarkedPdf } from "@/lib/lexgestor/watermark-pdf";

export const dynamic = "force-dynamic";

type WorkspaceData = Awaited<ReturnType<typeof getLexWorkspaceData>>;
type WorkspaceDocumento = WorkspaceData["documentos"][number];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentoId = url.searchParams.get("documento") || "";
  const usuarioLex = await obterUsuarioLexGestorAtual("/lexgestor/documentos");
  if (!possuiPermissao(usuarioLex, "lex:pdf:gerar")) {
    return friendlyPdfError("Seu perfil não permite gerar PDF com marca d'água.", 403);
  }
  const data = await getLexWorkspaceData("/lexgestor/documentos");
  const documento = data.documentos.find((item) => item.id === documentoId);

  if (!documento) {
    return friendlyPdfError("Documento não encontrado.", 404);
  }

  const original = await baixarOriginalSePossivel(data.current, documento).catch(() => null);
  if (!original) {
    return friendlyPdfError("Arquivo original não encontrado. Reenvie para salvar no armazenamento do escritório.", 409);
  }

  const branding = await resolvePdfBranding(data.escritorio, request.url, data.current);

  let pdf: Buffer;
  try {
    pdf = await createWatermarkedPdf({
      originalBytes: original.bytes,
      originalMimeType: original.mimeType,
      originalName: original.fileName,
      branding,
    });
  } catch (error) {
    return friendlyPdfError(errorMessage(error), 415);
  }

  const uploaded = await salvarPdfGeradoNoStorage(data, documento, pdf).catch(() => null);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${safePdfFileName(documento, uploaded?.path)}"`,
    },
  });
}

async function baixarOriginalSePossivel(current: WorkspaceData["current"], documento: WorkspaceDocumento) {
  if (!isStorageProvider(documento.provider) || (!documento.storagePath && !documento.storageFileId)) return null;
  return downloadFromConnectedStorage({
    current,
    provider: documento.provider,
    path: documento.storagePath,
    fileId: documento.storageFileId,
  });
}

async function salvarPdfGeradoNoStorage(data: WorkspaceData, documento: WorkspaceDocumento, pdf: Buffer) {
  if (!isStorageProvider(documento.provider)) return null;

  const result = await uploadToConnectedStorage({
    current: data.current,
    provider: documento.provider,
    fileName: safePdfFileName(documento),
    mimeType: "application/pdf",
    bytes: pdf,
    folderPath: pdfFolderPath(documento),
  });

  if (!result) return null;

  const client = await getLexSupabaseClient();
  const escritorioId = String(data.escritorio?.id ?? "");
  await client
    .from("lex_documentos")
    .update({
      pdf_storage_file_id: result.fileId,
      pdf_storage_path: result.path,
      pdf_storage_url: result.url ?? null,
      caminho_pdf: result.path,
      possui_marca_dagua: true,
      status: "pdf_gerado",
      updated_at: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", documento.id)
    .eq("escritorio_id", escritorioId);

  return result;
}

function pdfFolderPath(documento: WorkspaceDocumento) {
  const path = documento.storagePath || documento.dropboxFolderPath || "/LexGestor/PDF com Marca Dagua";
  const normalized = path.replace(/\\/g, "/");
  const originalMarker = "/01 - Originais/";
  if (normalized.includes(originalMarker)) {
    return normalized.split(originalMarker)[0] + "/02 - PDF com Marca d'agua";
  }

  const slash = normalized.lastIndexOf("/");
  const base = slash > 0 ? normalized.slice(0, slash) : normalized;
  return `${base}/PDF com Marca Dagua`;
}

function safePdfFileName(documento: WorkspaceDocumento, fallbackPath = "") {
  if (fallbackPath) {
    const name = fallbackPath.split("/").filter(Boolean).pop();
    if (name) return sanitizeFileName(name);
  }

  const base = [
    documento.tipo || "Documento",
    documento.nome || documento.cliente || "Cliente",
    "marca d'agua",
  ].join(" - ");

  return `${sanitizeFileName(base).replace(/\.pdf$/i, "")}.pdf`;
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 170) || "documento.pdf";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao gerar PDF com marca d'água.";
}

function friendlyPdfError(message: string, status: number) {
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>PDF indisponível</title><body style="font-family:Arial,sans-serif;margin:32px;color:#172033"><h1 style="font-size:20px">PDF indisponível</h1><p>${escapeHtml(message)}</p></body></html>`;
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
