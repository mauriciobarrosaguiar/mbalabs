import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireAppAccess, type CurrentUserProfile } from "@/lib/core-data";
import { registrarAuditoriaLexGestor } from "@/lib/lexgestor/audit";
import { obterUsuarioLexGestorAtual } from "@/lib/lexgestor/auth";
import { ensureLexEscritorio, getLexSupabaseClient } from "@/lib/lexgestor/data";
import { slugSeguro } from "@/lib/lexgestor/formatters";
import { resolvePdfBranding } from "@/lib/lexgestor/pdf-branding";
import {
  isStorageProvider,
  montarPastaRaizEscritorio,
  type StorageProvider,
  uploadToConnectedStorage,
} from "@/lib/lexgestor/storage";
import { createWatermarkedPdf } from "@/lib/lexgestor/watermark-pdf";
import { possuiPermissao } from "@/lib/lexgestor/permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx"]);

type UploadContext = {
  current: CurrentUserProfile;
  client: any;
  request: Request;
  escritorio: Record<string, unknown>;
  escritorioId: string;
  formData: FormData;
  provider: StorageProvider;
  clienteId: string;
  casoId: string;
  categoria: string;
  subcategoria: string;
  origem: string;
  gerarPdf: boolean;
  documentoId: string;
  processoId: string;
  movimentacaoId: string;
  observacoes: string;
  checklistMeta: {
    area: string;
    subarea: string;
    ordem: number;
    titulo: string;
  };
  cliente: Record<string, unknown>;
  caso: Record<string, unknown>;
  processo: Record<string, unknown> | null;
  movimentacao: Record<string, unknown> | null;
  folders: ReturnType<typeof buildStorageFolders>;
  checklistTemplateId: string;
  usedNames: Set<string>;
};

type SingleUploadResult = {
  ok: boolean;
  id?: string;
  fileName: string;
  message: string;
  status?: string;
};

export async function POST(request: Request) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/documentos");
  const usuarioLex = await obterUsuarioLexGestorAtual("/lexgestor/documentos");
  if (!possuiPermissao(usuarioLex, "lex:documentos:upload")) {
    return NextResponse.json({ error: "Seu perfil não permite anexar documentos." }, { status: 403 });
  }
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");

  if (!escritorioId || !escritorio) {
    return NextResponse.json({ error: "Configure o escritório antes de anexar documentos." }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const files = formData
      .getAll("arquivo")
      .filter((file): file is File => file instanceof File && file.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "Selecione um ou mais arquivos." }, { status: 400 });
    }

    const documentoId = text(formData.get("documento_id"));
    if (documentoId && files.length > 1) {
      return NextResponse.json({ error: "Para reenviar um documento pendente, selecione apenas um arquivo." }, { status: 400 });
    }

    const providerValue = text(formData.get("provider")) || "dropbox";
    const provider = isStorageProvider(providerValue) ? providerValue : "dropbox";
    const clienteId = required(formData, "cliente_id");
    const casoId = required(formData, "caso_id");
    const categoria = required(formData, "categoria");
    const subcategoria = required(formData, "subcategoria");
    const processoId = text(formData.get("processo_id"));
    const movimentacaoId = text(formData.get("movimentacao_id"));
    const checklistMeta = {
      area: text(formData.get("checklist_area")),
      subarea: text(formData.get("checklist_subarea")),
      ordem: Number(text(formData.get("checklist_ordem")) || 0),
      titulo: text(formData.get("checklist_titulo")),
    };

    const [clienteResult, casoResult] = await Promise.all([
      client.from("lex_clientes").select("id,nome,cpf_cnpj").eq("id", clienteId).eq("escritorio_id", escritorioId).maybeSingle(),
      client.from("lex_casos").select("id,titulo,cliente_id").eq("id", casoId).eq("escritorio_id", escritorioId).maybeSingle(),
    ]);
    if (clienteResult.error) throw clienteResult.error;
    if (casoResult.error) throw casoResult.error;

    const cliente = (clienteResult.data ?? {}) as Record<string, unknown>;
    const caso = (casoResult.data ?? {}) as Record<string, unknown>;
    if (!cliente.id || !caso.id || text(caso.cliente_id) !== clienteId) {
      return NextResponse.json({ error: "Cliente ou caso não pertence a este escritório." }, { status: 403 });
    }

    const processo = processoId ? await resolveProcesso(client, escritorioId, processoId) : null;
    if (processo && (text(processo.cliente_id) !== clienteId || (text(processo.caso_id) && text(processo.caso_id) !== casoId))) {
      return NextResponse.json({ error: "Processo não pertence ao cliente/caso selecionado." }, { status: 403 });
    }

    const movimentacao = movimentacaoId ? await resolveMovimentacao(client, escritorioId, processoId, movimentacaoId) : null;
    const checklistTemplateId = await resolveChecklistTemplateId(client, checklistMeta);
    const folders = buildStorageFolders({
      escritorioNome: text(escritorio.nome),
      cliente,
      caso,
      processo,
      movimentacao,
    });

    const context: UploadContext = {
      current,
      client,
      request,
      escritorio,
      escritorioId,
      formData,
      provider,
      clienteId,
      casoId,
      categoria,
      subcategoria,
      origem: text(formData.get("origem")) || "Upload",
      gerarPdf: text(formData.get("gerar_pdf")) === "sim",
      documentoId,
      processoId,
      movimentacaoId,
      observacoes: text(formData.get("observacoes")),
      checklistMeta,
      cliente,
      caso,
      processo,
      movimentacao,
      folders,
      checklistTemplateId,
      usedNames: new Set<string>(),
    };

    const results: SingleUploadResult[] = [];
    for (let index = 0; index < files.length; index += 1) {
      results.push(await processSingleFile(context, files[index], index));
    }

    const successCount = results.filter((item) => item.ok).length;
    const failureCount = results.length - successCount;
    const message = `${successCount} documento(s) enviado(s) com sucesso. ${failureCount} falharam.`;

    return NextResponse.json(
      {
        ok: successCount > 0,
        successCount,
        failureCount,
        message,
        results,
      },
      { status: successCount > 0 ? 200 : 400 },
    );
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

async function processSingleFile(context: UploadContext, file: File, index: number): Promise<SingleUploadResult> {
  if (!isAllowedFile(file)) {
    return {
      ok: false,
      fileName: file.name,
      message: "Formato não permitido. Envie jpg, jpeg, png, webp, pdf, doc ou docx.",
    };
  }

  const tipoDocumento =
    text(context.formData.get(`tipo_documento_${index}`)) ||
    text(context.formData.get("tipo_documento")) ||
    "Documento";
  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const storageFileName = await buildUniqueStorageFileName({
    client: context.client,
    escritorioId: context.escritorioId,
    folderPath: context.folders.originalFolder,
    tipoDocumento,
    originalName: file.name,
    usedNames: context.usedNames,
  });

  let uploadResult: Awaited<ReturnType<typeof uploadToConnectedStorage>> | null = null;
  let pdfResult: Awaited<ReturnType<typeof uploadToConnectedStorage>> | null = null;
  let uploadError = "";
  let pdfError = "";

  try {
    uploadResult = await uploadToConnectedStorage({
      current: context.current,
      provider: context.provider,
      fileName: storageFileName,
      mimeType: file.type || "application/octet-stream",
      bytes,
      folderPath: context.folders.originalFolder,
    });

    if (!uploadResult) {
      throw new Error("Configure o Dropbox ou Google Drive do escritório antes de salvar documentos jurídicos.");
    }
  } catch (error) {
    uploadError = errorMessage(error);
  }

  if (uploadResult && context.gerarPdf) {
    try {
      const branding = await resolvePdfBranding(context.escritorio, context.request.url, context.current);
      const pdf = await createWatermarkedPdf({
        originalBytes: bytes,
        originalMimeType: file.type || "application/octet-stream",
        originalName: file.name,
        branding,
      });

      pdfResult = await uploadToConnectedStorage({
        current: context.current,
        provider: context.provider,
        fileName: buildPdfFileName(storageFileName),
        mimeType: "application/pdf",
        bytes: pdf,
        folderPath: context.folders.pdfFolder,
      });
    } catch (error) {
      pdfError = errorMessage(error);
    }
  }

  const status = pdfResult ? "pdf_gerado" : uploadResult ? "enviado" : "erro_envio";
  const metadata = {
    empresa_id: context.current.empresaId,
    escritorio_id: context.escritorioId,
    advogado_id: null,
    cliente_id: context.clienteId,
    caso_id: context.casoId,
    processo_id: context.processoId || null,
    movimentacao_id: context.movimentacaoId || null,
    nome_documento: storageFileName,
    nome_original: file.name,
    nome_arquivo_sistema: storageFileName,
    nome_storage: storageFileName,
    tipo_documento: tipoDocumento,
    mime_type: file.type || "application/octet-stream",
    tamanho_bytes: file.size,
    categoria: context.categoria,
    subcategoria: context.subcategoria,
    categoria_nome: context.categoria,
    subcategoria_nome: context.subcategoria,
    origem: context.origem,
    observacoes: context.observacoes || null,
    provider: uploadResult ? context.provider : null,
    storage_provider: uploadResult ? context.provider : null,
    storage_file_id: uploadResult?.fileId ?? null,
    storage_folder_id: uploadResult?.folderId ?? null,
    storage_path: uploadResult?.path ?? null,
    storage_url: uploadResult?.url ?? null,
    caminho_original: uploadResult?.path ?? null,
    dropbox_file_id: context.provider === "dropbox" ? uploadResult?.fileId ?? null : null,
    dropbox_folder_path: context.folders.originalFolder,
    pdf_storage_file_id: pdfResult?.fileId ?? null,
    pdf_storage_path: pdfResult?.path ?? null,
    pdf_storage_url: pdfResult?.url ?? null,
    caminho_pdf: pdfResult?.path ?? null,
    possui_marca_dagua: Boolean(pdfResult),
    checklist_item_id: context.checklistTemplateId || null,
    status,
    hash_arquivo: hash,
    hash_sha256: hash,
    criado_por: context.current.usuario.id,
    enviado_por: context.current.usuario.id,
    updated_at: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };

  const saved = context.documentoId
    ? await context.client
        .from("lex_documentos")
        .update(metadata)
        .eq("id", context.documentoId)
        .eq("escritorio_id", context.escritorioId)
        .select("id")
        .single()
    : await context.client.from("lex_documentos").insert(metadata).select("id").single();

  if (saved.error) {
    return {
      ok: false,
      fileName: file.name,
      message: saved.error.message,
      status,
    };
  }

  const savedId = String(saved.data.id ?? "");

  if (context.checklistTemplateId && savedId) {
    await marcarChecklistRecebido({
      client: context.client,
      escritorioId: context.escritorioId,
      casoId: context.casoId,
      checklistTemplateId: context.checklistTemplateId,
      documentoId: savedId,
      observacao: context.observacoes || context.checklistMeta.titulo,
      recebido: Boolean(uploadResult),
    });
  }

  if (context.movimentacaoId && uploadResult) {
    await context.client
      .from("lex_movimentacoes")
      .update({ tem_documento: true, documento_status: "documento_salvo" })
      .eq("id", context.movimentacaoId)
      .eq("escritorio_id", context.escritorioId);
  }

  await registrarAuditoriaLexGestor({
    current: context.current,
    acao: context.documentoId ? "documento.reenviado" : "documento.upload",
    entidade: "lex_documentos",
    entidadeId: savedId,
    detalhes: {
      status,
      provider: uploadResult ? context.provider : null,
      nome: storageFileName,
      processoId: context.processoId,
      movimentacaoId: context.movimentacaoId,
      erroUpload: uploadError || null,
      erroPdf: pdfError || null,
    },
  });

  const ok = Boolean(uploadResult);
  const message = ok
    ? context.documentoId
      ? "Documento reenviado e registro atualizado."
      : pdfError
        ? "Original enviado. O PDF com marca d'água não foi gerado para este arquivo."
        : pdfResult
          ? "Documento enviado e PDF com marca d'água gerado."
          : context.provider === "google_drive"
            ? "Documento enviado ao Google Drive."
            : "Documento enviado ao Dropbox."
    : uploadError || "Falha no envio.";

  return {
    ok,
    id: savedId,
    fileName: storageFileName,
    status,
    message,
  };
}

async function resolveProcesso(client: any, escritorioId: string, processoId: string) {
  const result = await client
    .from("lex_processos")
    .select("id,numero_cnj,cliente_id,caso_id")
    .eq("id", processoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (result.error || !result.data?.id) {
    throw new Error("Processo não pertence a este escritório.");
  }

  return result.data as Record<string, unknown>;
}

async function resolveMovimentacao(client: any, escritorioId: string, processoId: string, movimentacaoId: string) {
  const result = await client
    .from("lex_movimentacoes")
    .select("id,processo_id,evento_numero")
    .eq("id", movimentacaoId)
    .eq("escritorio_id", escritorioId)
    .maybeSingle();

  if (result.error || !result.data?.id || (processoId && text(result.data.processo_id) !== processoId)) {
    throw new Error("Movimentação não pertence a este processo.");
  }

  return result.data as Record<string, unknown>;
}

function buildStorageFolders({
  escritorioNome,
  cliente,
  caso,
  processo,
  movimentacao,
}: {
  escritorioNome: string;
  cliente: Record<string, unknown>;
  caso: Record<string, unknown>;
  processo: Record<string, unknown> | null;
  movimentacao: Record<string, unknown> | null;
}) {
  const root = montarPastaRaizEscritorio(escritorioNome || "Escritório");
  const caseFolder = [
    root,
    "Clientes",
    `${slugSeguro(text(cliente.nome) || "Cliente")} - ${slugSeguro(text(cliente.cpf_cnpj) || "sem-documento")}`,
    "Casos",
    slugSeguro(text(caso.titulo) || "Caso"),
  ].join("/");

  const folderBase = processo
    ? [
        caseFolder,
        "Processos",
        slugSeguro(text(processo.numero_cnj) || "Processo"),
        movimentacao ? `Evento ${slugSeguro(text(movimentacao.evento_numero) || "sem-numero")}` : "Documentos",
      ].join("/")
    : caseFolder;

  return {
    originalFolder: `${folderBase}/01 - Originais`,
    pdfFolder: `${folderBase}/02 - PDF com Marca d'agua`,
  };
}

async function buildUniqueStorageFileName({
  client,
  escritorioId,
  folderPath,
  tipoDocumento,
  originalName,
  usedNames,
}: {
  client: any;
  escritorioId: string;
  folderPath: string;
  tipoDocumento: string;
  originalName: string;
  usedNames: Set<string>;
}) {
  const extension = extensionFromName(originalName);
  const originalBase = sanitizeFileName(originalName.replace(/\.[^.]+$/i, "")) || "arquivo";
  const typeBase = sanitizeFileName(tipoDocumento || "Documento");
  const baseName = `${typeBase} - ${originalBase}`.slice(0, 170);
  let fileName = `${baseName}${extension}`;
  let path = `${folderPath}/${fileName}`;

  if (usedNames.has(path) || (await storagePathExists(client, escritorioId, path))) {
    fileName = `${baseName} - ${timestampForFileName()}${extension}`;
    path = `${folderPath}/${fileName}`;
  }

  usedNames.add(path);
  return fileName;
}

async function storagePathExists(client: any, escritorioId: string, path: string) {
  const result = await client
    .from("lex_documentos")
    .select("id")
    .eq("escritorio_id", escritorioId)
    .or(`storage_path.eq.${escapeSupabaseFilter(path)},caminho_original.eq.${escapeSupabaseFilter(path)},dropbox_path_original.eq.${escapeSupabaseFilter(path)}`)
    .limit(1);

  return !result.error && Array.isArray(result.data) && result.data.length > 0;
}

function escapeSupabaseFilter(value: string) {
  return value.replace(/[,()]/g, " ");
}

function buildPdfFileName(originalFileName: string) {
  return `${originalFileName.replace(/\.[^.]+$/i, "")} - marca d'agua.pdf`;
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim() || "documento";
}

function extensionFromName(fileName: string) {
  const match = fileName.match(/\.([a-z0-9]{1,8})$/i);
  return match ? `.${match[1].toLowerCase()}` : "";
}

function timestampForFileName() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join("");
}

function isAllowedFile(file: File) {
  const ext = extensionFromName(file.name).replace(".", "");
  return allowedExtensions.has(ext);
}

async function resolveChecklistTemplateId(
  client: any,
  meta: { area: string; subarea: string; ordem: number; titulo: string },
) {
  if (!meta.area || !meta.subarea) return "";

  let query = client
    .from("lex_checklist_templates")
    .select("id")
    .eq("area", meta.area)
    .eq("subarea", meta.subarea)
    .eq("ativo", true)
    .limit(1);

  if (Number.isFinite(meta.ordem) && meta.ordem > 0) {
    query = query.eq("ordem", meta.ordem);
  } else if (meta.titulo) {
    query = query.eq("titulo", meta.titulo);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return "";
  return String(data.id ?? "");
}

async function marcarChecklistRecebido({
  client,
  escritorioId,
  casoId,
  checklistTemplateId,
  documentoId,
  observacao,
  recebido,
}: {
  client: any;
  escritorioId: string;
  casoId: string;
  checklistTemplateId: string;
  documentoId: string;
  observacao: string;
  recebido: boolean;
}) {
  const existing = await client
    .from("lex_checklist_respostas")
    .select("id")
    .eq("escritorio_id", escritorioId)
    .eq("caso_id", casoId)
    .eq("checklist_template_id", checklistTemplateId)
    .maybeSingle();

  const payload = {
    escritorio_id: escritorioId,
    caso_id: casoId,
    checklist_template_id: checklistTemplateId,
    status: recebido ? "recebido" : "pendente",
    observacao: observacao || null,
    documento_id: documentoId,
    atualizado_em: new Date().toISOString(),
  };

  if (existing.data?.id) {
    await client.from("lex_checklist_respostas").update(payload).eq("id", existing.data.id);
    return;
  }

  await client.from("lex_checklist_respostas").insert(payload);
}

function required(formData: FormData, key: string) {
  const value = text(formData.get(key));
  if (!value) throw new Error(`Campo obrigatório: ${key}`);
  return value;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao enviar documento.";
}
