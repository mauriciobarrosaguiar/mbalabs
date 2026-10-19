import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

type Db = ReturnType<typeof createSupabaseAdminClient>;
type DeliveryStatus = "pending" | "sent" | "delivered" | "read" | "played" | "failed";
type StatusUpdate = { messageId?: string; phone?: string; status: DeliveryStatus };
type EnvioStatusRow = { id: string; delivery_status: string | null; provider_message_id: string | null };
type EvolutionConfig = {
  id: string;
  api_url?: string | null;
  api_token?: string | null;
  phone_number_id?: string | null;
  numero_oficial?: string | null;
  webhook_secret?: string | null;
};

export async function configureEvolutionStatusWebhook(webhookUrl: string) {
  const supabase = createSupabaseAdminClient();
  const config = await getConfig(supabase);
  if (!config?.api_url) throw new Error("Evolution API ativa não encontrada.");

  const secret = config.webhook_secret || randomBytes(32).toString("hex");
  if (!config.webhook_secret) {
    const { error } = await supabase.from("cot_whatsapp_global_config").update({ webhook_secret: secret }).eq("id", config.id);
    if (error) throw error;
  }

  const instance = config.phone_number_id || config.numero_oficial || "mba-cotacoes";
  const endpoint = `${baseUrl(config.api_url)}/webhook/set/${encodeURIComponent(instance)}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.api_token) { headers.apikey = config.api_token; headers["x-api-key"] = config.api_token; }
  const hookHeaders = { "x-mba-webhook-secret": secret };
  const payloads = [
    { webhook: { enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: false, headers: hookHeaders, events: ["MESSAGES_UPDATE", "SEND_MESSAGE_UPDATE"] } },
    { webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: false, headers: hookHeaders, events: ["messages.update", "send.message.update"] } },
    { enabled: true, url: webhookUrl, byEvents: false, base64: false, headers: hookHeaders, events: ["messages.update", "send.message.update"] },
  ];

  let lastError = "Falha ao configurar webhook da Evolution.";
  for (const body of payloads) {
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
    const text = await response.text();
    if (response.ok) {
      await supabase.from("cot_whatsapp_global_config").update({ webhook_enabled: true, webhook_url: webhookUrl, webhook_updated_at: new Date().toISOString(), webhook_last_error: null }).eq("id", config.id);
      return { ok: true, instance, webhookUrl };
    }
    lastError = `Evolution retornou ${response.status}: ${text.slice(0, 300)}`;
    if (![400, 404, 405, 422].includes(response.status)) break;
  }
  await supabase.from("cot_whatsapp_global_config").update({ webhook_enabled: false, webhook_url: webhookUrl, webhook_updated_at: new Date().toISOString(), webhook_last_error: lastError }).eq("id", config.id);
  throw new Error(lastError);
}

export async function processEvolutionStatusWebhook(input: { secret?: string | null; payload: unknown }) {
  const supabase = createSupabaseAdminClient();
  const config = await getConfig(supabase);
  if (!config?.webhook_secret || !input.secret || !sameSecret(config.webhook_secret, input.secret)) return { ok: false as const, status: 401, error: "Webhook não autorizado." };

  const payload = record(input.payload);
  const instance = text(payload.instance ?? payload.instanceName);
  const expected = config.phone_number_id || config.numero_oficial || "mba-cotacoes";
  if (instance && instance !== expected) return { ok: false as const, status: 403, error: "Instância não autorizada." };
  const event = normalizeEvent(payload.event ?? payload.type);
  if (event && !["messages.update", "send.message.update"].includes(event)) return { ok: true as const, status: 200, processed: 0, ignored: true };

  const updates = extractUpdates(payload);
  let processed = 0;
  for (const update of updates) if (await applyUpdate(supabase, update)) processed += 1;
  return { ok: true as const, status: 200, processed, received: updates.length };
}

async function getConfig(supabase: Db): Promise<EvolutionConfig | null> {
  const { data, error } = await supabase.from("cot_whatsapp_global_config").select("id, api_url, api_token, phone_number_id, numero_oficial, webhook_secret").eq("ativo", true).eq("provider", "evolution_api").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as unknown as EvolutionConfig | null;
}

async function applyUpdate(supabase: Db, update: StatusUpdate) {
  let row: EnvioStatusRow | null = null;
  if (update.messageId) {
    const { data } = await supabase.from("cot_whatsapp_envios").select("id, delivery_status, provider_message_id").eq("provider_message_id", update.messageId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    row = toEnvioRow(data);
  }
  if (!row && update.phone) {
    const since = new Date(Date.now() - 86400000).toISOString();
    const { data } = await supabase.from("cot_whatsapp_envios").select("id, delivery_status, provider_message_id").eq("telefone", normalizePhone(update.phone)).eq("enviado_por", "evolution_api").in("status", ["enviado", "pendente"]).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    row = toEnvioRow(data);
  }
  if (!row || rank(update.status) < rank(normalizeStatus(row.delivery_status))) return false;

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { delivery_status: update.status, status_atualizado_em: now };
  if (update.messageId && !row.provider_message_id) patch.provider_message_id = update.messageId;
  if (["delivered", "read", "played"].includes(update.status)) patch.entregue_em = now;
  if (["read", "played"].includes(update.status)) patch.lido_em = now;
  if (update.status === "failed") { patch.status = "falhou"; patch.erro = "A Evolution informou falha na entrega da mensagem."; }
  else { patch.status = "enviado"; patch.erro = null; }
  const { error } = await supabase.from("cot_whatsapp_envios").update(patch).eq("id", row.id);
  if (error) throw error;
  return true;
}

function extractUpdates(payload: Record<string, unknown>) {
  const base: unknown[] = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [payload];
  const expanded: unknown[] = [];
  for (const item of base) { const value = record(item); Array.isArray(value.statuses) ? expanded.push(...value.statuses) : expanded.push(item); }
  const result: StatusUpdate[] = [];
  for (const item of expanded) {
    const value = record(item); const key = record(value.key); const update = record(value.update); const updateKey = record(update.key); const message = record(value.message); const messageKey = record(message.key);
    const status = normalizeStatus(update.status ?? value.status ?? message.status ?? value.deliveryStatus ?? value.delivery_status);
    if (!status) continue;
    const messageId = text(key.id ?? updateKey.id ?? messageKey.id ?? value.id ?? value.messageId ?? value.message_id);
    const phone = normalizePhone(text(key.remoteJid ?? updateKey.remoteJid ?? messageKey.remoteJid ?? value.remoteJid ?? value.recipient_id ?? value.recipientId));
    result.push({ messageId: messageId || undefined, phone: phone || undefined, status });
  }
  const unique = new Map<string, StatusUpdate>();
  for (const item of result) { const key = `${item.messageId ?? ""}:${item.phone ?? ""}`; const old = unique.get(key); if (!old || rank(item.status) >= rank(old.status)) unique.set(key, item); }
  return [...unique.values()];
}

function normalizeStatus(value: unknown): DeliveryStatus | null {
  if (typeof value === "number") return value <= 0 ? "failed" : value === 1 ? "pending" : value === 2 ? "sent" : value === 3 ? "delivered" : value === 4 ? "read" : "played";
  const raw = String(value ?? "").trim().toUpperCase().replace(/[ .-]+/g, "_");
  if (["ERROR", "FAILED", "FAILURE"].includes(raw)) return "failed";
  if (["PENDING", "PENDENTE"].includes(raw)) return "pending";
  if (["SERVER_ACK", "SENT", "ENVIADO"].includes(raw)) return "sent";
  if (["DELIVERY_ACK", "DELIVERED", "ENTREGUE"].includes(raw)) return "delivered";
  if (["READ", "READ_ACK", "LIDO"].includes(raw)) return "read";
  if (["PLAYED", "REPRODUZIDO"].includes(raw)) return "played";
  return null;
}

function rank(value: DeliveryStatus | null) { return value === "failed" ? 0 : value === "pending" ? 1 : value === "sent" ? 2 : value === "delivered" ? 3 : value === "read" ? 4 : value === "played" ? 5 : -1; }
function normalizeEvent(value: unknown) { return String(value ?? "").trim().toLowerCase().replaceAll("_", "."); }
function normalizePhone(value?: string | null) { let digits = String(value ?? "").replace(/\D/g, ""); while (digits.startsWith("0")) digits = digits.slice(1); if (digits.length === 10 || digits.length === 11) digits = `55${digits}`; return digits; }
function baseUrl(value: string) { const base = value.trim().replace(/\/+$/, ""); const index = base.indexOf("/message/sendText"); return index >= 0 ? base.slice(0, index) : base; }
function sameSecret(a: string, b: string) { const x = createHash("sha256").update(a).digest(); const y = createHash("sha256").update(b).digest(); return timingSafeEqual(x, y); }
function record(value: unknown): Record<string, any> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {}; }
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function toEnvioRow(value: unknown): EnvioStatusRow | null { if (!value || typeof value !== "object") return null; const row = value as Record<string, unknown>; if (!row.id) return null; return { id: String(row.id), delivery_status: typeof row.delivery_status === "string" ? row.delivery_status : null, provider_message_id: typeof row.provider_message_id === "string" ? row.provider_message_id : null }; }
