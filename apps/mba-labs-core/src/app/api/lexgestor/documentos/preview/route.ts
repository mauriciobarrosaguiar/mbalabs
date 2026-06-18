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
    return NextResponse.json({ error: "Documento não informado." }, { status: 400 });
  }

  const current = await requireAppAccess("lexgestor", "/lexgestor/documentos");
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId) {
    return NextResponse.json({ error: "Escritório não configurado." }, { status: 400 });
  }

  const result = await client
    .from("lex_documentos")
    .select("*")
    .eq("id", documentoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (result.error || !result.data) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const documento = result.data as Record<string, unknown>;
  const providerValue = text(documento.storage_provider) || (text(documento.dropbox_path_original) ? "dropbox" : "");

  if (!isStorageProvider(providerValue)) {
    return NextResponse.json({ error: "Documento sem armazenamento conectado." }, { status: 404 });
  }

  const path = arquivo === "pdf"
    ? text(documento.pdf_storage_path) || text(documento.dropbox_path_pdf_marca_dagua)
    : text(documento.storage_path) || text(documento.dropbox_path_original) || text(documento.pdf_storage_path);
  const fileId = arquivo === "pdf" ? text(documento.pdf_storage_file_id) : text(documento.storage_file_id);

  if (!path && !fileId) {
    return NextResponse.json({ error: "Arquivo ainda pendente. Reenvie o documento." }, { status: 404 });
  }

  const arquivoBaixado = await downloadFromConnectedStorage({
    current,
    provider: providerValue,
    path,
    fileId,
  });

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
