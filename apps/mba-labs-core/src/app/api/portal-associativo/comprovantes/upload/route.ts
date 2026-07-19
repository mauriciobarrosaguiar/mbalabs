import { NextResponse } from "next/server";
import { buildPortalStorageFolder, getPortalStorageConnection, isPortalStorageProvider, uploadToPortalStorage } from "@/lib/portal-associativo-storage";
import { getPortalContext } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Map([
  ["pdf", new Set(["application/pdf"])],
  ["jpg", new Set(["image/jpeg"])],
  ["jpeg", new Set(["image/jpeg"])],
  ["png", new Set(["image/png"])],
  ["webp", new Set(["image/webp"])]
]);

export async function POST(request: Request) {
  const returnTo = "/portal-associativo/painel-associado";
  try {
    const context = await getPortalContext(returnTo);
    if (!context.empresaId || !context.pessoaId) throw new Error("Seu usuário não está vinculado a uma pessoa desta entidade.");

    const formData = await request.formData();
    const cobrancaId = text(formData.get("cobranca_id"));
    const file = formData.get("arquivo");
    if (!cobrancaId || !(file instanceof File) || file.size === 0) throw new Error("Selecione o comprovante.");
    validateFile(file);

    const charge = await context.client
      .from("assoc_cobrancas")
      .select("id,unidade_id,pessoa_responsavel_id,status,ano_referencia,mes_referencia")
      .eq("id", cobrancaId)
      .eq("empresa_id", context.empresaId)
      .maybeSingle();
    if (charge.error || !charge.data) throw new Error("Cobrança não encontrada nesta entidade.");
    if (!["aberta", "vencida", "negociada", "aguardando_pagamento", "recusada"].includes(String(charge.data.status))) {
      throw new Error("Esta cobrança não aceita envio de comprovante no status atual.");
    }

    const ownsDirectly = String(charge.data.pessoa_responsavel_id ?? "") === context.pessoaId;
    const link = await context.client
      .from("assoc_vinculos_unidade_pessoa")
      .select("id")
      .eq("empresa_id", context.empresaId)
      .eq("unidade_id", charge.data.unidade_id)
      .eq("pessoa_id", context.pessoaId)
      .eq("status_vinculo", "ativo")
      .is("data_fim", null)
      .limit(1)
      .maybeSingle();
    if (!ownsDirectly && !link.data?.id) throw new Error("Você não pode enviar comprovante desta cobrança.");

    const connection = await getPortalStorageConnection(context.current);
    if (!connection || !isPortalStorageProvider(String(connection.provedor ?? ""))) {
      throw new Error("A administração precisa conectar o Dropbox ou Google Drive da entidade antes do envio.");
    }
    const provider = connection.provedor as "dropbox" | "google_drive";
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadToPortalStorage({
      current: context.current,
      provider,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      folderPath: buildPortalStorageFolder({
        root: String(connection.root_folder_path ?? "/Portal Associativo"),
        area: "financeiro",
        cobrancaAno: Number(charge.data.ano_referencia || new Date().getFullYear()),
        cobrancaMes: Number(charge.data.mes_referencia || new Date().getMonth() + 1),
        categoria: "Comprovantes"
      })
    });
    if (!uploaded) throw new Error("Não foi possível salvar o comprovante.");

    const arquivo = await context.client.from("assoc_arquivos").insert({
      empresa_id: context.empresaId,
      pessoa_id: context.pessoaId,
      unidade_id: charge.data.unidade_id,
      cobranca_id: cobrancaId,
      provedor: provider,
      file_id: uploaded.fileId || null,
      file_name: file.name,
      mime_type: file.type,
      size: file.size,
      path: uploaded.path,
      shared_url: uploaded.url || null,
      visibility: "interno",
      liberado_associado: false,
      categoria: "comprovante",
      descricao: "Comprovante de pagamento enviado pelo associado",
      criado_por: context.current.usuario.id,
      atualizado_por: context.current.usuario.id
    }).select("id").single();
    if (arquivo.error) throw arquivo.error;

    const comprovante = await context.client.from("assoc_comprovantes_pagamento").insert({
      empresa_id: context.empresaId,
      cobranca_id: cobrancaId,
      pessoa_id: context.pessoaId,
      unidade_id: charge.data.unidade_id,
      arquivo_id: arquivo.data.id,
      comprovante_url: uploaded.url || uploaded.path,
      provedor_storage: provider,
      valor_informado: nullableNumber(formData.get("valor_informado")),
      data_pagamento_informada: text(formData.get("data_pagamento_informada")) || null,
      observacao_associado: text(formData.get("observacao_associado")) || null,
      status: "enviado",
      enviado_por: context.current.usuario.id
    }).select("id").single();
    if (comprovante.error) throw comprovante.error;

    const update = await context.client.from("assoc_cobrancas").update({
      status: "aguardando_aprovacao",
      motivo_recusa: null,
      comprovante_pendente_url: uploaded.url || uploaded.path,
      atualizado_em: new Date().toISOString()
    }).eq("id", cobrancaId).eq("empresa_id", context.empresaId);
    if (update.error) throw update.error;

    await context.client.from("assoc_auditoria_logs").insert({
      empresa_id: context.empresaId,
      usuario_id: context.current.usuario.id,
      acao: "enviar_comprovante",
      entidade: "assoc_cobrancas",
      entidade_id: cobrancaId,
      dados_novos: { comprovante_id: comprovante.data.id, provedor: provider }
    });
    return redirect(request, returnTo, "ok", "Comprovante enviado. A administração irá conferir e aprovar o pagamento.");
  } catch (error) {
    return redirect(request, returnTo, "error", error instanceof Error ? error.message : "Erro ao enviar comprovante.");
  }
}

function validateFile(file: File) {
  if (file.size > MAX_FILE_SIZE) throw new Error("O comprovante deve ter no máximo 10 MB.");
  const extension = file.name.toLowerCase().split(".").pop() || "";
  const mimeTypes = ALLOWED.get(extension);
  if (!mimeTypes || !mimeTypes.has(file.type.toLowerCase())) throw new Error("Envie um arquivo PDF, JPG, PNG ou WEBP válido.");
}

function nullableNumber(value: FormDataEntryValue | null) {
  const parsed = Number(text(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function redirect(request: Request, path: string, kind: "ok" | "error", message: string) {
  return NextResponse.redirect(new URL(`${path}?${kind}=${encodeURIComponent(message)}`, request.url), 303);
}
