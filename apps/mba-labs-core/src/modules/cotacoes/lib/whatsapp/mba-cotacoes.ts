/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/modules/cotacoes/lib/supabase/server";
import type { PurchaseOrder } from "@/modules/cotacoes/lib/types";

export type WhatsappTipoEnvio = "link_cotacao" | "resultado_cotacao";
export type WhatsappStatus = "pendente" | "enviado" | "falhou";
export type WhatsappProvider = "evolution_api" | "zapi" | "meta_cloud_api" | "outro";

type Db = ReturnType<typeof createSupabaseAdminClient>;

type Config = {
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

export type WhatsappAdminConfig = Omit<Config, "api_token"> & { api_token_configurado: boolean };
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
export type SendWhatsAppResult = { vendedorId: string; telefone: string; status: WhatsappStatus; erro?: string; skipped?: boolean };
export type WhatsappBatchResult = { total: number; enviado: number; falhou: number; pendente: number; ignorado: number; results: SendWhatsAppResult[] };

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

type SendInput = {
  empresaId: string;
  cotacaoId: string;
  vendedorId: string;
  telefone?: string | null;
  mensagem: string;
  tipoEnvio: WhatsappTipoEnvio;
  linkEnviado: string;
  forceResend?: boolean;
};

function ready() {
  return hasSupabaseConfig() && hasSupabaseAdminConfig();
}

function db(): Db {
  return createSupabaseAdminClient();
}

function requireDb() {
  if (!ready()) throw new Error("Supabase não configurado para o WhatsApp MBA Cotações.");
  return db();
}

export function normalizeWhatsappPhone(value?: string | null) {
  let digits = String(value ?? "").replace(/\D/g, "");
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

export async function getWhatsappGlobalConfigForAdmin(): Promise<WhatsappAdminConfig | null> {
  if (!ready()) return null;
  const config = await getLatestConfig();
  if (!config) return null;
  const { api_token, ...safe } = config;
  return { ...safe, api_token_configurado: Boolean(api_token) };
}

export async function saveWhatsappGlobalConfig(input: SaveWhatsappConfigInput) {
  const supabase = requireDb();
  const existing = await getLatestConfig();
  const payload = clean({
    provider: input.provider,
    api_url: input.api_url || null,
    api_token: input.api_token || existing?.api_token || null,
    phone_number_id: input.phone_number_id || null,
    numero_oficial: normalizeWhatsappPhone(input.numero_oficial) || null,
    nome_exibicao: input.nome_exibicao || "MBA Cotações",
    status_conexao: input.status_conexao || (input.ativo ? "configurado" : "inativo"),
    ativo: input.ativo,
    updated_at: new Date().toISOString(),
  });

  if (existing?.id) {
    const { error } = await supabase.from("cot_whatsapp_global_config").update(payload).eq("id", existing.id);
    if (error) throw error;
    return true;
  }
  const { error } = await supabase.from("cot_whatsapp_global_config").insert(payload);
  if (error) throw error;
  return true;
}

export async function testWhatsappGlobalConfig() {
  const config = await getLatestConfig();
  validateConfig(config);
  if (config?.id) {
    await db().from("cot_whatsapp_global_config").update({ status_conexao: config.ativo ? "configurado" : "inativo" }).eq("id", config.id);
  }
  return true;
}

export async function sendWhatsappGlobalTestMessage(telefone: string, mensagem: string) {
  const config = await getLatestConfig();
  validateConfig(config);
  const phone = normalizeWhatsappPhone(telefone);
  if (!validPhone(phone)) throw new Error("WhatsApp de teste inválido. Use DDI + DDD + número.");
  await callProvider(config!, phone, mensagem || "Mensagem de teste do MBA Cotações.");
  if (config?.id) await db().from("cot_whatsapp_global_config").update({ status_conexao: "conectado" }).eq("id", config.id);
  return true;
}

export async function listWhatsappEnvios(input: { quotationId: string; tipoEnvio: WhatsappTipoEnvio; vendedorId?: string }) {
  if (!ready() || !input.quotationId) return [] as WhatsappEnvio[];
  let query = db().from("cot_whatsapp_envios").select("*").eq("cotacao_id", input.quotationId).eq("tipo_envio", input.tipoEnvio).order("created_at", { ascending: false });
  if (input.vendedorId) query = query.eq("vendedor_id", input.vendedorId);
  const { data, error } = await query;
  if (error) return [];
  const seen = new Set<string>();
  return (data ?? []).map(mapEnvio).filter((envio) => {
    const key = `${envio.vendedorId}:${envio.tipoEnvio}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function sendWhatsAppMbaCotacoes(input: SendInput): Promise<SendWhatsAppResult> {
  if (!ready()) return { vendedorId: input.vendedorId, telefone: normalizeWhatsappPhone(input.telefone), status: "falhou", erro: "Supabase não configurado." };
  const supabase = db();
  const telefone = normalizeWhatsappPhone(input.telefone);
  const existing = await existingEnvio(supabase, input);
  if (existing && !input.forceResend) {
    if (existing.status === "enviado") return { vendedorId: input.vendedorId, telefone, status: "enviado", skipped: true };
    if (existing.status === "falhou") return { vendedorId: input.vendedorId, telefone, status: "falhou", erro: existing.erro, skipped: true };
  }

  const envioId = await upsertEnvio(supabase, input, telefone, "pendente");
  try {
    if (!validPhone(telefone)) throw new Error("Vendedor sem WhatsApp válido cadastrado.");
    const config = await getActiveConfig();
    validateConfig(config);
    if (!config?.ativo) throw new Error("Envio automático desativado.");
    await callProvider(config, telefone, input.mensagem);
    await updateEnvio(supabase, input, envioId, "enviado", null);
    return { vendedorId: input.vendedorId, telefone, status: "enviado" };
  } catch (error) {
    const erro = error instanceof Error ? error.message : "Falha ao enviar WhatsApp.";
    await updateEnvio(supabase, input, envioId, "falhou", erro);
    return { vendedorId: input.vendedorId, telefone, status: "falhou", erro };
  }
}

export async function sendQuotationLinksByQuotation(input: { quotationId: string; origin: string; forceResend?: boolean }) {
  if (!ready()) return emptyBatch();
  const supabase = db();
  const quotation = await quotationRow(supabase, input.quotationId);
  if (!quotation) return emptyBatch();
  const companyName = await buyerName(supabase, quotation);
  const { data: sessions } = await supabase.from("supplier_quote_sessions").select("*").eq("quotation_id", input.quotationId).neq("status", "canceled");
  const prefix = quotation.module_type === "bidding" ? "licitacao" : "cotacao";
  const results = await Promise.all((sessions ?? []).map((session: Record<string, any>) => {
    const link = `${input.origin}/${prefix}/responder/${session.public_token}`;
    const name = session.seller_name || session.seller_company || "vendedor";
    const mensagem = `Olá ${name}, a farmácia ${companyName} enviou uma nova cotação pelo MBA Cotações.\n\nPara responder, acesse:\n${link}\n\nNão responda esta mensagem. A resposta da cotação deve ser feita pelo link acima.`;
    return sendWhatsAppMbaCotacoes({ empresaId: quotation.tenant_id, cotacaoId: quotation.id, vendedorId: session.supplier_id || session.id, telefone: session.seller_whatsapp, mensagem, tipoEnvio: "link_cotacao", linkEnviado: link, forceResend: input.forceResend });
  }));
  return summarize(results);
}

export async function sendWinnerOrderLinksByQuotation(input: { quotationId: string; origin: string; orders: PurchaseOrder[]; forceResend?: boolean; vendedorId?: string }) {
  if (!ready()) return emptyBatch();
  const supabase = db();
  const quotation = await quotationRow(supabase, input.quotationId);
  if (!quotation) return emptyBatch();
  const companyName = await buyerName(supabase, quotation);
  const orders = input.vendedorId ? input.orders.filter((order) => vendorId(order) === input.vendedorId) : input.orders;
  const results = await Promise.all(orders.map((order) => {
    const link = `${input.origin}/${order.moduleType === "bidding" ? "licitacao" : "cotacao"}/pedido/${order.publicToken}`;
    const name = order.supplierContactName || order.supplierName || order.supplierCompany || "vendedor";
    const mensagem = `Olá ${name}, a cotação da farmácia ${companyName} foi finalizada pelo MBA Cotações.\n\nVocê possui itens vencedores.\n\nAcesse o link abaixo para ver o pedido:\n${link}\n\nNão responda esta mensagem. O pedido deve ser visualizado pelo link acima.`;
    return sendWhatsAppMbaCotacoes({ empresaId: order.tenantId, cotacaoId: order.quotationId, vendedorId: vendorId(order), telefone: order.supplierWhatsapp, mensagem, tipoEnvio: "resultado_cotacao", linkEnviado: link, forceResend: input.forceResend });
  }));
  return summarize(results);
}

async function callProvider(config: Config, phone: string, message: string) {
  const base = String(config.api_url ?? "").replace(/\/$/, "");
  if (!base) throw new Error("API URL do WhatsApp não configurada.");
  const instance = config.phone_number_id || config.numero_oficial || "mba-cotacoes";
  const url = config.provider === "evolution_api" && !base.includes("/message/sendText") ? `${base}/message/sendText/${instance}` : base;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.api_token) {
    headers.apikey = config.api_token;
    headers["x-api-key"] = config.api_token;
  }
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify({ number: phone, phone, to: phone, text: message, message }) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Provider retornou ${response.status}: ${text.slice(0, 200)}`);
}

async function getActiveConfig() { const { data, error } = await db().from("cot_whatsapp_global_config").select("*").eq("ativo", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data ? mapConfig(data) : null; }
async function getLatestConfig() { const { data, error } = await db().from("cot_whatsapp_global_config").select("*").order("ativo", { ascending: false }).order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data ? mapConfig(data) : null; }
function validateConfig(config: Config | null) { if (!config) throw new Error("WhatsApp MBA Cotações não configurado pelo Admin Master."); if (!config.provider) throw new Error("Provider não configurado."); if (!config.api_url) throw new Error("API URL não configurada."); }
function validPhone(phone: string) { return /^\d{12,15}$/.test(phone); }
function mapConfig(row: Record<string, any>): Config { return { id: row.id, provider: row.provider, api_url: row.api_url, api_token: row.api_token, phone_number_id: row.phone_number_id, numero_oficial: row.numero_oficial, nome_exibicao: row.nome_exibicao, status_conexao: row.status_conexao, ativo: Boolean(row.ativo) }; }
function mapEnvio(row: Record<string, any>): WhatsappEnvio { return { id: row.id, empresaId: row.empresa_id, cotacaoId: row.cotacao_id, vendedorId: row.vendedor_id, telefone: row.telefone ?? "", tipoEnvio: row.tipo_envio, mensagem: row.mensagem ?? "", linkEnviado: row.link_enviado ?? "", status: row.status, erro: row.erro ?? undefined, enviadoPor: row.enviado_por ?? "mba_cotacoes", enviadoEm: row.enviado_em ?? undefined, createdAt: row.created_at }; }
async function existingEnvio(supabase: Db, input: SendInput) { const { data } = await supabase.from("cot_whatsapp_envios").select("*").eq("empresa_id", input.empresaId).eq("cotacao_id", input.cotacaoId).eq("vendedor_id", input.vendedorId).eq("tipo_envio", input.tipoEnvio).maybeSingle(); return data ? mapEnvio(data) : null; }
async function upsertEnvio(supabase: Db, input: SendInput, telefone: string, status: WhatsappStatus) { const existing = await existingEnvio(supabase, input); const payload = { empresa_id: input.empresaId, cotacao_id: input.cotacaoId, vendedor_id: input.vendedorId, telefone, tipo_envio: input.tipoEnvio, mensagem: input.mensagem, link_enviado: input.linkEnviado, status, erro: null, enviado_por: "mba_cotacoes" }; if (existing?.id) { await supabase.from("cot_whatsapp_envios").update(payload).eq("id", existing.id); return existing.id; } const { data } = await supabase.from("cot_whatsapp_envios").insert(payload).select("id").single(); return data?.id as string | undefined; }
async function updateEnvio(supabase: Db, input: SendInput, envioId: string | undefined, status: WhatsappStatus, erro: string | null) { const payload = { status, erro, enviado_em: status === "enviado" ? new Date().toISOString() : null }; if (envioId) await supabase.from("cot_whatsapp_envios").update(payload).eq("id", envioId); else await supabase.from("cot_whatsapp_envios").update(payload).eq("empresa_id", input.empresaId).eq("cotacao_id", input.cotacaoId).eq("vendedor_id", input.vendedorId).eq("tipo_envio", input.tipoEnvio); }
async function quotationRow(supabase: Db, quotationId: string) { const { data } = await supabase.from("quotations").select("id, tenant_id, module_type, pharmacy_id, buyer_company_name").eq("id", quotationId).maybeSingle(); return data as Record<string, any> | null; }
async function buyerName(supabase: Db, quotation: Record<string, any>) { const [{ data: tenant }, { data: pharmacy }] = await Promise.all([supabase.from("tenants").select("nome_fantasia, razao_social").eq("id", quotation.tenant_id).maybeSingle(), quotation.pharmacy_id ? supabase.from("pharmacies").select("nome_fantasia, razao_social").eq("id", quotation.pharmacy_id).maybeSingle() : Promise.resolve({ data: null })]); return pharmacy?.nome_fantasia || pharmacy?.razao_social || quotation.buyer_company_name || tenant?.nome_fantasia || tenant?.razao_social || "Farmácia"; }
function vendorId(order: PurchaseOrder) { return order.supplierId || order.id; }
function summarize(results: SendWhatsAppResult[]): WhatsappBatchResult { return { total: results.length, enviado: results.filter((r) => r.status === "enviado").length, falhou: results.filter((r) => r.status === "falhou").length, pendente: results.filter((r) => r.status === "pendente").length, ignorado: results.filter((r) => r.skipped).length, results }; }
function emptyBatch() { return summarize([]); }
function clean<T extends Record<string, unknown>>(input: T) { return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)); }
