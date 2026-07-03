/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/supabase/server";
import type { ModuleType, PurchaseOrder } from "@/lib/types";

export type WhatsappProvider = "evolution_api" | "zapi" | "meta_cloud_api" | "outro";
export type WhatsappTipoEnvio = "link_cotacao" | "resultado_cotacao";
export type WhatsappStatus = "pendente" | "enviado" | "falhou";

type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

type WhatsappConfig = {
  id?: string;
  provider: WhatsappProvider;
  api_url?: string | null;
  api_token?: string | null;
  phone_number_id?: string | null;
  numero_oficial?: string | null;
  nome_exibicao?: string | null;
  status_conexao?: string | null;
  ativo: boolean;
};

export type WhatsappAdminConfig = Omit<WhatsappConfig, "api_token"> & {
  api_token_configurado: boolean;
};

export type WhatsappEnvio = {
  id: string;
  empresaId: string;
  cotacaoId: string;
  vendedorId: string;
  telefone: string;
  tipoEnvio: WhatsappTipoEnvio;
  mensagem: string;
  linkEnviado: string;
  status: WhatsappStatus;
  erro?: string;
  enviadoPor: string;
  enviadoEm?: string;
  createdAt: string;
};

export type SendWhatsAppInput = {
  empresaId: string;
  cotacaoId: string;
  vendedorId: string;
  telefone?: string | null;
  mensagem: string;
  tipoEnvio: WhatsappTipoEnvio;
  linkEnviado: string;
  forceResend?: boolean;
};

export type SendWhatsAppResult = {
  vendedorId: string;
  telefone: string;
  status: WhatsappStatus;
  erro?: string;
  skipped?: boolean;
};

export type WhatsappBatchResult = {
  total: number;
  enviado: number;
  falhou: number;
  pendente: number;
  ignorado: number;
  results: SendWhatsAppResult[];
};

export type SaveWhatsappConfigInput = {
  provider: WhatsappProvider;
  api_url?: string | null;
  api_token?: string | null;
  phone_number_id?: string | null;
  numero_oficial?: string | null;
  nome_exibicao?: string | null;
  status_conexao?: string | null;
  ativo: boolean;
};

function canUseWhatsappDatabase() {
  return hasSupabaseConfig() && hasSupabaseAdminConfig();
}

function db(): SupabaseClient {
  return createSupabaseAdminClient();
}

function requireWhatsappDatabase() {
  if (!canUseWhatsappDatabase()) {
    throw new Error("Supabase não configurado para o WhatsApp MBA Cotações.");
  }

  return db();
}

export function normalizeWhatsappPhone(value?: string | null) {
  let digits = String(value ?? "").replace(/\D/g, "");
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

export async function getWhatsappGlobalConfigForAdmin(): Promise<WhatsappAdminConfig | null> {
  if (!canUseWhatsappDatabase()) return null;

  try {
    const config = await getActiveOrLatestConfig();
    if (!config) return null;
    const { api_token: apiToken, ...safeConfig } = config;
    return {
      ...safeConfig,
      api_token_configurado: Boolean(apiToken),
    };
  } catch (error) {
    console.warn("[WhatsApp MBA Cotações] Falha ao carregar configuração administrativa.", error);
    return null;
  }
}

export async function saveWhatsappGlobalConfig(input: SaveWhatsappConfigInput) {
  const supabase = requireWhatsappDatabase();
  const existing = await getActiveOrLatestConfig();
  const now = new Date().toISOString();
  const payload = stripUndefined({
    provider: input.provider,
    api_url: input.api_url || null,
    api_token: input.api_token || existing?.api_token || null,
    phone_number_id: input.phone_number_id || null,
    numero_oficial: normalizeWhatsappPhone(input.numero_oficial) || input.numero_oficial || null,
    nome_exibicao: input.nome_exibicao || "MBA Cotações",
    status_conexao: input.status_conexao || (input.ativo ? "configurado" : "inativo"),
    ativo: input.ativo,
    updated_at: now,
  });

  if (existing?.id) {
    const { error } = await supabase
      .from("cot_whatsapp_global_config")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
    return true;
  }

  const { error } = await supabase
    .from("cot_whatsapp_global_config")
    .insert({ ...payload, created_at: now });
  if (error) throw error;
  return true;
}

export async function testWhatsappGlobalConfig() {
  const supabase = requireWhatsappDatabase();
  const config = await getActiveOrLatestConfig();
  validateConfig(config);

  const { error } = await supabase
    .from("cot_whatsapp_global_config")
    .update({ status_conexao: config?.ativo ? "configurado" : "inativo", updated_at: new Date().toISOString() })
    .eq("id", config?.id);
  if (error) throw error;

  return {
    ok: true,
    status: config?.ativo ? "configurado" : "inativo",
  };
}

export async function sendWhatsappGlobalTestMessage(telefone: string, mensagem: string) {
  const supabase = requireWhatsappDatabase();
  const config = await getActiveOrLatestConfig();
  validateConfig(config);
  const phone = normalizeWhatsappPhone(telefone);
  if (!isValidWhatsappPhone(phone)) throw new Error("WhatsApp de teste inválido. Use DDI + DDD + número.");

  await dispatchProviderMessage(config!, phone, mensagem || "Mensagem de teste do MBA Cotações.");

  await supabase
    .from("cot_whatsapp_global_config")
    .update({ status_conexao: "conectado", updated_at: new Date().toISOString() })
    .eq("id", config?.id);

  return true;
}

export async function listWhatsappEnvios(input: {
  quotationId: string;
  tipoEnvio: WhatsappTipoEnvio;
  vendedorId?: string;
}) {
  if (!canUseWhatsappDatabase() || !input.quotationId) return [] as WhatsappEnvio[];

  try {
    const supabase = db();
    let query = supabase
      .from("cot_whatsapp_envios")
      .select("*")
      .eq("cotacao_id", input.quotationId)
      .eq("tipo_envio", input.tipoEnvio)
      .order("created_at", { ascending: false });

    if (input.vendedorId) query = query.eq("vendedor_id", input.vendedorId);

    const { data, error } = await query;
    if (error) throw error;

    const seen = new Set<string>();
    return (data ?? [])
      .map(mapWhatsappEnvio)
      .filter((envio) => {
        const key = `${envio.vendedorId}:${envio.tipoEnvio}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } catch (error) {
    console.warn("[WhatsApp MBA Cotações] Falha ao listar histórico de envios.", error);
    return [] as WhatsappEnvio[];
  }
}

export async function sendWhatsAppMbaCotacoes(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  if (!canUseWhatsappDatabase()) {
    return {
      vendedorId: input.vendedorId,
      telefone: normalizeWhatsappPhone(input.telefone),
      status: "falhou",
      erro: "Supabase não configurado para registrar/envio do WhatsApp.",
    };
  }

  const supabase = db();
  const telefone = normalizeWhatsappPhone(input.telefone);
  const existing = await findExistingEnvio(supabase, input);

  if (existing && !input.forceResend) {
    if (existing.status === "enviado") {
      return { vendedorId: input.vendedorId, telefone, status: "enviado", skipped: true };
    }
    if (existing.status === "falhou") {
      return {
        vendedorId: input.vendedorId,
        telefone,
        status: "falhou",
        erro: existing.erro || "Envio anterior falhou. Use Reenviar WhatsApp.",
        skipped: true,
      };
    }
  }

  const envioId = await upsertEnvio(supabase, input, telefone, "pendente");

  try {
    if (!isValidWhatsappPhone(telefone)) {
      throw new Error("Vendedor sem WhatsApp válido cadastrado.");
    }

    const config = await getActiveConfig();
    validateConfig(config);
    if (!config?.ativo) throw new Error("Envio automático do WhatsApp MBA Cotações está desativado.");

    await dispatchProviderMessage(config, telefone, input.mensagem);
    await updateEnvioStatus(supabase, input, envioId, "enviado", null);
    return { vendedorId: input.vendedorId, telefone, status: "enviado" };
  } catch (error) {
    const message = getErrorMessage(error, "Falha ao enviar WhatsApp.");
    await updateEnvioStatus(supabase, input, envioId, "falhou", message);
    return { vendedorId: input.vendedorId, telefone, status: "falhou", erro: message };
  }
}

export async function sendQuotationLinksByQuotation(input: {
  quotationId: string;
  origin: string;
  forceResend?: boolean;
}) {
  if (!canUseWhatsappDatabase()) return emptyBatch();
  const supabase = db();
  const quotation = await getQuotationRow(supabase, input.quotationId);
  if (!quotation) return emptyBatch();

  const [{ data: sessions }, companyName] = await Promise.all([
    supabase
      .from("supplier_quote_sessions")
      .select("id, tenant_id, quotation_id, supplier_id, seller_name, seller_company, seller_whatsapp, public_token, status")
      .eq("quotation_id", input.quotationId)
      .neq("status", "canceled"),
    getBuyerCompanyName(supabase, quotation),
  ]);

  const prefix = getPublicPrefix(quotation.module_type);
  const results = await Promise.all((sessions ?? []).map((session: Record<string, any>) => {
    const link = `${input.origin}/${prefix}/responder/${session.public_token}`;
    const sellerName = session.seller_name || session.seller_company || "vendedor";
    const mensagem = `Olá ${sellerName}, a farmácia ${companyName} enviou uma nova cotação pelo MBA Cotações.\n\nPara responder, acesse:\n${link}\n\nNão responda esta mensagem. A resposta da cotação deve ser feita pelo link acima.`;

    return sendWhatsAppMbaCotacoes({
      empresaId: quotation.tenant_id,
      cotacaoId: quotation.id,
      vendedorId: session.supplier_id || session.id,
      telefone: session.seller_whatsapp,
      mensagem,
      tipoEnvio: "link_cotacao",
      linkEnviado: link,
      forceResend: input.forceResend,
    });
  }));

  return summarizeBatch(results);
}

export async function sendWinnerOrderLinksByQuotation(input: {
  quotationId: string;
  origin: string;
  orders: PurchaseOrder[];
  forceResend?: boolean;
  vendedorId?: string;
}) {
  if (!canUseWhatsappDatabase()) return emptyBatch();
  const supabase = db();
  const quotation = await getQuotationRow(supabase, input.quotationId);
  if (!quotation) return emptyBatch();
  const companyName = await getBuyerCompanyName(supabase, quotation);

  const targetOrders = input.vendedorId
    ? input.orders.filter((order) => getOrderVendorId(order) === input.vendedorId)
    : input.orders;

  const results = await Promise.all(targetOrders.map((order) => {
    const link = `${input.origin}/${getPublicPrefix(order.moduleType)}/pedido/${order.publicToken}`;
    const sellerName = order.supplierContactName || order.supplierName || order.supplierCompany || "vendedor";
    const mensagem = `Olá ${sellerName}, a cotação da farmácia ${companyName} foi finalizada pelo MBA Cotações.\n\nVocê possui itens vencedores.\n\nAcesse o link abaixo para ver o pedido:\n${link}\n\nNão responda esta mensagem. O pedido deve ser visualizado pelo link acima.`;

    return sendWhatsAppMbaCotacoes({
      empresaId: order.tenantId,
      cotacaoId: order.quotationId,
      vendedorId: getOrderVendorId(order),
      telefone: order.supplierWhatsapp,
      mensagem,
      tipoEnvio: "resultado_cotacao",
      linkEnviado: link,
      forceResend: input.forceResend,
    });
  }));

  return summarizeBatch(results);
}

async function getActiveConfig(): Promise<WhatsappConfig | null> {
  if (!canUseWhatsappDatabase()) return null;
  const supabase = db();
  const { data, error } = await supabase
    .from("cot_whatsapp_global_config")
    .select("*")
    .eq("ativo", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapConfig(data) : null;
}

async function getActiveOrLatestConfig(): Promise<WhatsappConfig | null> {
  if (!canUseWhatsappDatabase()) return null;
  const supabase = db();
  const { data, error } = await supabase
    .from("cot_whatsapp_global_config")
    .select("*")
    .order("ativo", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapConfig(data) : null;
}

function validateConfig(config: WhatsappConfig | null) {
  if (!config) throw new Error("WhatsApp MBA Cotações não configurado pelo Admin Master.");
  if (!config.provider) throw new Error("Provider do WhatsApp não configurado.");
  if (!config.api_token && config.provider !== "zapi") throw new Error("Token/API key do WhatsApp não configurado.");
  if (!config.api_url && config.provider !== "meta_cloud_api") throw new Error("API URL do WhatsApp não configurada.");
  if (config.provider === "meta_cloud_api" && !config.phone_number_id) {
    throw new Error("phone_number_id obrigatório para Meta Cloud API.");
  }
}

async function dispatchProviderMessage(config: WhatsappConfig, phone: string, message: string) {
  const token = config.api_token ?? "";
  const baseUrl = String(config.api_url ?? "").replace(/\/$/, "");
  let url = baseUrl;
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, any> = {};

  if (config.provider === "meta_cloud_api") {
    const graphBase = baseUrl || "https://graph.facebook.com/v20.0";
    url = `${graphBase}/${config.phone_number_id}/messages`;
    headers = { ...headers, Authorization: `Bearer ${token}` };
    body = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { preview_url: false, body: message },
    };
  } else if (config.provider === "evolution_api") {
    const instance = config.phone_number_id || config.numero_oficial || "mba-cotacoes";
    url = baseUrl.includes("/message/sendText") ? baseUrl : `${baseUrl}/message/sendText/${instance}`;
    headers = { ...headers, apikey: token, Authorization: `Bearer ${token}` };
    body = { number: phone, text: message };
  } else if (config.provider === "zapi") {
    const instance = config.phone_number_id || config.numero_oficial || "";
    url = baseUrl.includes("/send-text") ? baseUrl : `${baseUrl}/instances/${instance}/token/${token}/send-text`;
    headers = { ...headers, "Client-Token": token, Authorization: `Bearer ${token}` };
    body = { phone, message };
  } else {
    url = baseUrl;
    headers = { ...headers, Authorization: `Bearer ${token}` };
    body = { phone, telefone: phone, to: phone, message, mensagem: message, text: message };
  }

  if (!url) throw new Error("API URL do WhatsApp não configurada.");

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Provider retornou ${response.status}: ${responseText.slice(0, 240)}`);
  }

  return responseText;
}

async function findExistingEnvio(supabase: SupabaseClient, input: SendWhatsAppInput) {
  try {
    const { data } = await supabase
      .from("cot_whatsapp_envios")
      .select("*")
      .eq("empresa_id", input.empresaId)
      .eq("cotacao_id", input.cotacaoId)
      .eq("vendedor_id", input.vendedorId)
      .eq("tipo_envio", input.tipoEnvio)
      .maybeSingle();
    return data ? mapWhatsappEnvio(data) : null;
  } catch {
    return null;
  }
}

async function upsertEnvio(
  supabase: SupabaseClient,
  input: SendWhatsAppInput,
  telefone: string,
  status: WhatsappStatus,
) {
  const existing = await findExistingEnvio(supabase, input);
  const payload = {
    empresa_id: input.empresaId,
    cotacao_id: input.cotacaoId,
    vendedor_id: input.vendedorId,
    telefone,
    tipo_envio: input.tipoEnvio,
    mensagem: input.mensagem,
    link_enviado: input.linkEnviado,
    status,
    erro: null,
    enviado_por: "mba_cotacoes",
  };

  try {
    if (existing?.id) {
      const { error } = await supabase
        .from("cot_whatsapp_envios")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
      return existing.id;
    }

    const { data, error } = await supabase
      .from("cot_whatsapp_envios")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return data?.id as string | undefined;
  } catch (error) {
    console.warn("[WhatsApp MBA Cotações] Falha ao registrar envio pendente.", error);
    return existing?.id as string | undefined;
  }
}

async function updateEnvioStatus(
  supabase: SupabaseClient,
  input: SendWhatsAppInput,
  envioId: string | undefined,
  status: WhatsappStatus,
  erro: string | null,
) {
  const payload = {
    status,
    erro,
    enviado_em: status === "enviado" ? new Date().toISOString() : null,
  };

  try {
    let query = supabase.from("cot_whatsapp_envios").update(payload);
    if (envioId) {
      query = query.eq("id", envioId);
    } else {
      query = query
        .eq("empresa_id", input.empresaId)
        .eq("cotacao_id", input.cotacaoId)
        .eq("vendedor_id", input.vendedorId)
        .eq("tipo_envio", input.tipoEnvio);
    }
    const { error } = await query;
    if (error) throw error;
  } catch (error) {
    console.warn("[WhatsApp MBA Cotações] Falha ao atualizar histórico do envio.", error);
  }
}

async function getQuotationRow(supabase: SupabaseClient, quotationId: string) {
  const { data, error } = await supabase
    .from("quotations")
    .select("id, tenant_id, module_type, name, pharmacy_id, buyer_company_name")
    .eq("id", quotationId)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, any> | null;
}

async function getBuyerCompanyName(supabase: SupabaseClient, quotation: Record<string, any>) {
  const [{ data: tenant }, { data: pharmacy }] = await Promise.all([
    supabase.from("tenants").select("nome_fantasia, razao_social").eq("id", quotation.tenant_id).maybeSingle(),
    quotation.pharmacy_id
      ? supabase.from("pharmacies").select("nome_fantasia, razao_social").eq("id", quotation.pharmacy_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    pharmacy?.nome_fantasia ||
    pharmacy?.razao_social ||
    quotation.buyer_company_name ||
    tenant?.nome_fantasia ||
    tenant?.razao_social ||
    "Farmácia"
  );
}

function getOrderVendorId(order: PurchaseOrder) {
  return order.supplierId || order.id;
}

function getPublicPrefix(moduleType: ModuleType | string) {
  return moduleType === "bidding" ? "licitacao" : "cotacao";
}

function summarizeBatch(results: SendWhatsAppResult[]): WhatsappBatchResult {
  return {
    total: results.length,
    enviado: results.filter((result) => result.status === "enviado").length,
    falhou: results.filter((result) => result.status === "falhou").length,
    pendente: results.filter((result) => result.status === "pendente").length,
    ignorado: results.filter((result) => result.skipped).length,
    results,
  };
}

function emptyBatch(): WhatsappBatchResult {
  return summarizeBatch([]);
}

function isValidWhatsappPhone(phone: string) {
  return /^\d{12,15}$/.test(phone);
}

function mapConfig(row: Record<string, any>): WhatsappConfig {
  return {
    id: row.id,
    provider: row.provider,
    api_url: row.api_url,
    api_token: row.api_token,
    phone_number_id: row.phone_number_id,
    numero_oficial: row.numero_oficial,
    nome_exibicao: row.nome_exibicao,
    status_conexao: row.status_conexao,
    ativo: Boolean(row.ativo),
  };
}

function mapWhatsappEnvio(row: Record<string, any>): WhatsappEnvio {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    cotacaoId: row.cotacao_id,
    vendedorId: row.vendedor_id,
    telefone: row.telefone ?? "",
    tipoEnvio: row.tipo_envio,
    mensagem: row.mensagem ?? "",
    linkEnviado: row.link_enviado ?? "",
    status: row.status,
    erro: row.erro ?? undefined,
    enviadoPor: row.enviado_por ?? "mba_cotacoes",
    enviadoEm: row.enviado_em ?? undefined,
    createdAt: row.created_at,
  };
}

function stripUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (parts.length > 0) return parts.join(" ");
  }
  return fallback;
}
