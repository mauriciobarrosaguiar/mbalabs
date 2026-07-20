import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";
import { createPortalReceiptPdf } from "@/lib/portal-associativo-pdf";
import { buildPortalStorageFolder, getPortalStorageConnection, uploadToPortalStorage } from "@/lib/portal-associativo-storage";
import { ensurePortalStorageEnvAliases } from "../../_storage-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  ensurePortalStorageEnvAliases();
  const { id } = await params;
  const context = await getPortalContext("/portal-associativo/painel-associado");
  const charge = await context.client
    .from("assoc_cobrancas")
    .select("id,empresa_id,unidade_id,pessoa_responsavel_id,descricao,mes_referencia,ano_referencia,data_vencimento,valor_original,valor_juros,valor_multa,valor_desconto,valor_total,valor_pago,status,forma_pagamento,data_pagamento,recibo_file_id,assoc_unidades(codigo_unidade,numero_unidade),assoc_pessoas(nome_completo),assoc_loteamentos(nome)")
    .eq("id", id)
    .eq("empresa_id", context.empresaId)
    .maybeSingle();

  if (charge.error || !charge.data?.id) {
    return NextResponse.json({ error: "Cobranca nao encontrada." }, { status: 404 });
  }

  if (String(charge.data.status) !== "paga") {
    return NextResponse.json({ error: "Recibo disponivel apenas para cobranca paga." }, { status: 400 });
  }

  if (!canPortalAccess(context.perfil, "financeiro") && !(await canCurrentUserReadCharge(context, charge.data as Record<string, unknown>))) {
    return NextResponse.json({ error: "Seu perfil nao permite acessar este recibo." }, { status: 403 });
  }

  const config = await context.client
    .from("assoc_configuracoes")
    .select("nome_publico_entidade,logo_url,assinatura_entidade,assinatura_tipo,assinatura_pessoa_id,responsavel_pessoa_id")
    .eq("empresa_id", context.empresaId)
    .maybeSingle();
  const entityName = text(config.data?.nome_publico_entidade) || context.companyName;
  const signature = await resolveSignature(context, (config.data ?? {}) as Record<string, unknown>, entityName);
  const unidade = unitLabel(charge.data.assoc_unidades);
  const pdf = await createPortalReceiptPdf({
    entidade: entityName,
    logoUrl: text(config.data?.logo_url),
    assinatura: signature,
    associado: relationName(charge.data.assoc_pessoas),
    unidade,
    descricao: text(charge.data.descricao) || "Cobranca",
    valorOriginal: Number(charge.data.valor_original ?? 0),
    juros: Number(charge.data.valor_juros ?? 0),
    multa: Number(charge.data.valor_multa ?? 0),
    desconto: Number(charge.data.valor_desconto ?? 0),
    valorPago: Number(charge.data.valor_pago ?? charge.data.valor_total ?? 0),
    vencimento: text(charge.data.data_vencimento),
    pagamento: text(charge.data.data_pagamento),
    formaPagamento: text(charge.data.forma_pagamento) || "manual",
    cobrancaId: id
  });

  if (!charge.data.recibo_file_id) {
    await trySaveReceipt(context, charge.data as Record<string, unknown>, pdf, entityName, unidade);
  }

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recibo-${id}.pdf"`
    }
  });
}

async function resolveSignature(context: Awaited<ReturnType<typeof getPortalContext>>, config: Record<string, unknown>, entityName: string) {
  const type = text(config.assinatura_tipo) || "entidade";
  if (type === "entidade") return entityName;
  const directId = type === "responsavel" ? text(config.responsavel_pessoa_id) : type === "pessoa" ? text(config.assinatura_pessoa_id) : "";
  let pessoaId = directId;
  if (!pessoaId && ["presidente", "tesoureiro", "secretario"].includes(type)) {
    const profile = await context.client.from("assoc_perfis_usuarios").select("pessoa_id").eq("empresa_id", context.empresaId).eq("perfil", type).eq("status", "ativo").limit(1).maybeSingle();
    pessoaId = text(profile.data?.pessoa_id);
  }
  if (pessoaId) {
    const person = await context.client.from("assoc_pessoas").select("nome_completo").eq("empresa_id", context.empresaId).eq("id", pessoaId).maybeSingle();
    if (person.data?.nome_completo) return text(person.data.nome_completo);
  }
  return text(config.assinatura_entidade) || entityName;
}

async function trySaveReceipt(
  context: Awaited<ReturnType<typeof getPortalContext>>,
  charge: Record<string, unknown>,
  pdf: Buffer,
  entityName: string,
  unidade: string
) {
  try {
    const connection = await getPortalStorageConnection(context.current);
    if (!connection) return;
    const provider = text(connection.provedor);
    const year = Number(charge.ano_referencia || new Date().getFullYear());
    const month = Number(charge.mes_referencia || new Date().getMonth() + 1);
    const folderPath = buildPortalStorageFolder({
      root: text(connection.root_folder_path) || "/Portal Associativo",
      area: "financeiro",
      cobrancaAno: year,
      cobrancaMes: month,
      categoria: "Recibos"
    });
    const fileName = `Recibo - ${safeName(unidade)} - ${text(charge.id).slice(0, 8)}.pdf`;
    const uploaded = await uploadToPortalStorage({
      current: context.current,
      fileName,
      mimeType: "application/pdf",
      bytes: pdf,
      folderPath
    });
    if (!uploaded) return;

    const file = await context.client.from("assoc_arquivos").insert({
      empresa_id: context.empresaId,
      pessoa_id: charge.pessoa_responsavel_id || null,
      unidade_id: charge.unidade_id || null,
      cobranca_id: charge.id,
      provedor: provider,
      file_id: uploaded.fileId || null,
      file_name: fileName,
      mime_type: "application/pdf",
      size: pdf.length,
      path: uploaded.path,
      shared_url: uploaded.url || null,
      visibility: "liberado_associado",
      liberado_associado: true,
      categoria: "recibo",
      descricao: `Recibo emitido por ${entityName}`,
      criado_por: context.current.usuario.id,
      atualizado_por: context.current.usuario.id
    }).select("id").single();

    await context.client
      .from("assoc_cobrancas")
      .update({
        recibo_url: uploaded.url || uploaded.path,
        recibo_file_id: uploaded.fileId || String(file.data?.id ?? ""),
        recibo_emitido_em: new Date().toISOString(),
        recibo_metadados: { arquivo_id: file.data?.id ?? null, provedor: provider, path: uploaded.path },
        atualizado_em: new Date().toISOString()
      })
      .eq("id", charge.id)
      .eq("empresa_id", context.empresaId);

    await context.client.from("assoc_auditoria_logs").insert({
      empresa_id: context.empresaId,
      usuario_id: context.current.usuario.id,
      acao: "gerar_recibo",
      entidade: "assoc_cobrancas",
      entidade_id: charge.id,
      dados_novos: { provedor: provider, path: uploaded.path }
    });
  } catch {
    // PDF delivery should not fail only because external storage is unavailable.
  }
}

async function canCurrentUserReadCharge(context: Awaited<ReturnType<typeof getPortalContext>>, charge: Record<string, unknown>) {
  const pessoaId = context.pessoaId || await resolvePessoaIdByUsuario(context);
  if (!pessoaId) return false;
  if (String(charge.pessoa_responsavel_id ?? "") === pessoaId) return true;

  const { data } = await context.client
    .from("assoc_vinculos_unidade_pessoa")
    .select("id")
    .eq("empresa_id", context.empresaId)
    .eq("pessoa_id", pessoaId)
    .eq("unidade_id", charge.unidade_id)
    .eq("status_vinculo", "ativo")
    .is("data_fim", null)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

async function resolvePessoaIdByUsuario(context: Awaited<ReturnType<typeof getPortalContext>>) {
  const { data } = await context.client
    .from("assoc_pessoas")
    .select("id")
    .eq("empresa_id", context.empresaId)
    .eq("core_usuario_id", context.current.usuario.id)
    .maybeSingle();
  return text(data?.id);
}

function relationName(value: unknown) {
  const relation = relationObject(value);
  return text(relation?.nome_completo ?? relation?.nome);
}

function unitLabel(value: unknown) {
  const unit = relationObject(value);
  if (unit?.codigo_unidade && unit?.numero_unidade && String(unit.codigo_unidade) === String(unit.numero_unidade)) return `Unidade ${unit.numero_unidade}`;
  return [unit?.codigo_unidade, unit?.numero_unidade].filter(Boolean).join(" - ") || "-";
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "cobranca";
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
