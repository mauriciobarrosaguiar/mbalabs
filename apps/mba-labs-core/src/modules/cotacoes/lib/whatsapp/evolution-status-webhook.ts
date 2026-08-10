import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

type Db = ReturnType<typeof createSupabaseAdminClient>;

type EvolutionConfig = {
  id: string;
  provider: string;
  api_url?: string | null;
  api_token?: string | null;
  phone_number_id?: string | null;
  numero_oficial?: string | null;
  webhook_secret?: string | null;
};

type DeliveryStatus = "pending" | "sent" | "delivered" | "read" | "played" | "failed";

type StatusUpdate = {
  messageId?: string;
  phone?: string;
  status: DeliveryStatus;
};

export async function configureEvolutionStatusWebhook(webhookUrl: string) {
  const supabase = createSupabaseAdminClient();
  const config = await getActiveEvolutionConfig(supabase);
  if (!config) throw new Error("Evolution API ativa não encontrada.");
  if (!config.api_url) throw new Error("URL da Evolution API não configurada.");

  const secret = config.webhook_secret || randomBytes(32).toString("hex");
  if (!config.webhook_secret) {
    const { error } = await supabase
      .from("cot_whatsapp_global_config")
      .update({ webhook_secret: secret })
      .eq("id", config.id);
    if (error) throw error;
  }

  const base = evolutionBase(config.api_url);
  const instance = config.phone_number_id || config.numero_oficial || "mba-cotacoes";
  const endpoint = `${base}/webhook/set/${encodeURIComponent(instance)}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.api_token) {
    headers.apikey = config.api_token;
    headers["x-api-key"] = config.api_token;
  }

  const webhookHeaders = { "x-mba-webhook-secret": secret };
  const payloads = [
    {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: false,
        headers: webhookHeaders,
        events: ["MESSAGES_UPDATE", "SEND_MESSAGE_UPDATE"],
      },
    },
    {
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: false,
        base64: false,
        headers: webhookHeaders,
        events: ["messages.update", "send.message.update"],
      },
    },
    {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: false,
      headers: webhookHeaders,
      events: ["messages.update", "send.message.update"],
    },
  ];

  let lastError = "Não foi possível configurar o webhook da Evolution.";
  for (const payload of payloads) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const text = await response.text();
    if (response.ok) {
      await supabase
        .from("cot_whatsapp_global_config")
        .update({
          webhook_enabled: true,
          webhook_url: webhookUrl,
          webhook_updated_at: new Date().toISOString(),
          webhook_last_error: null,
        })
        .eq("id", config.id);
      return { ok: true, instance, webhookUrl };
    }
    lastError = `Evolution retornou ${response.status}: ${text.slice(0, 300)}`;
    if (![400, 404, 405, 422].includes(response.status)) break;
  }

  await supabase
    .from("cot_whatsapp_global_config")
    .update({
      webhook_enabled: false,
      webhook_url: webhookUrl,
      webhook_updated_at: new Date().toISOString(),
      webhook_last_error: lastError,
    })
    .eq("id", config.id);
  throw new Error(lastError);
}

export async function processEvolutionStatusWebhook(input: { secret?: string | null; payload: unknown }) {
  const supabase = createSupabaseAdminClient();
  const config = await getActiveEvolutionConfig(supabase);
  if (!config?.webhook_secret || !input.secret || !safeEqual(config.webhook_secret, input.secret)) {
    return { ok: false as const, status: 401, error: "Webhook não autorizado." };
  }

  const payload = asRecord(input.payload);
  const instance = stringValue(payload.instance ?? payload.instanceName);
  const expectedInstance = config.phone_number_id || config.numero_oficial || "mba-cotacoes";
  if (instance && instance !== expectedInstance) {
    return { ok: false as const, status: 403, error: "Instância Evolution não autorizada." };
  }

  const event = normalizeEvent(payload.event ?? payload.type);
  if (event && !["messages.update", "send.message.update"].includes(event)) {
    return { ok: true as const, status: 200, processed: 0, ignored: true };
  }

  const updates = extractStatusUpdates(payload);
  let processed = 0;
  for (const update of updates) {
    if (await applyStatusUpdate(supabase, update)) processed += 1;
  }

  return { ok: true as const, status: 200, processed, received: updates.length };
}

async function getActiveEvolutionConfig(supabase: Db): Promise<EvolutionConfig | null> {
  const { data, error } = await supabase
    .from("cot_whatsapp_global_config")
    .select("id, provider, api_url, api_token, phone_number_id, numero_oficial, webhook_secret")
    .eq("ativo", true)
    .eq("provider", "evolution_api")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as EvolutionConfig | null;
}

async function applyStatusUpdate(supabase: Db, update: StatusUpdate) {
  const now = new Date().toISOString();
  let row: { id: string; delivery_status?: string | null; provider_message_id?: string | null } | null = null;

  if (update.messageId) {
    const { data } = await supabase
      .from("cot_whatsapp_envios")
      .select("id, delivery_status, provider_message_id")
      .eq("provider_message_id", update.messageId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data as typeof row;
  }

  if (!row && update.phone) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("cot_whatsapp_envios")
      .select("id, delivery_status, provider_message_id")
      .eq("telefone", normalizePhone(update.phone))
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    row = data as typeof row;
  }

  if (!row) return false;
  if (deliveryRank(update.status) < deliveryRank(normalizeDeliveryStatus(row.delivery_status))) return false;

  const patch: Record<string, unknown> = {
    delivery_status: update.status,
    status_atualizado_em: now,
  };
  if (update.messageId && !row.provider_message_id) patch.provider_message_id = update.messageId;
  if (["delivered", "read", "played"].includes(update.status)) patch.entregue_em = now;
  if (["read", "played"].includes(update.status)) patch.lido_em = now;
  if (update.status === "failed") {
    patch.status = "falhou";
    patch.erro = "A Evolution informou falha na entrega da mensagem.";
  } else {
    patch.status = "enviado";
    patch.erro = null;
  }

  const { error } = await supabase.from("cot_whatsapp_envios").update(patch).eq("id", row.id);
  if (error) throw error;
  return true;
}

function extractStatusUpdates(payload: Record<string, unknown>): StatusUpdate[] {
  const data = payload.data;
  const candidates: unknown[] = [];
  if (Array.isArray(data)) candidates.push(...data);
  else if (data) candidates.push(data);
  if (Array.isArray(payload.statuses)) candidates.push(...payload.statuses);

  const expanded: unknown[] = [];
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (Array.isArray(record.statuses)) expanded.push(...record.statuses);
    else expanded.push(candidate);
  }
  if (expanded.length === 0) expanded.push(payload);

  const updates: StatusUpdate[] = [];
  for (const candidate of expanded) {
    const record = asRecord(candidate);
    const key = asRecord(record.key);
    const nestedUpdate = asRecord(record.update);
    const nestedKey = asRecord(nestedUpdate.key);
    const message = asRecord(record.message);
    const messageKey = asRecord(message.key);
    const status = normalizeDeliveryStatus(
      nestedUpdate.status ?? record.status ?? message.status ?? record.deliveryStatus ?? record.delivery_status,
    );
    if (!status) continue;

    const messageId = stringValue(
      key.id ?? nestedKey.id ?? messageKey.id ?? record.id ?? record.messageId ?? record.message_id,
    );
    const phone = normalizePhone(stringValue(
      key.remoteJid ?? nestedKey.remoteJid ?? messageKey.remoteJid ?? record.remoteJid ?? record.recipient_id ?? record.recipientId,
    ));
    updates.push({ messageId: messageId || undefined, phone: phone || undefined, status });
  }
  return dedupeUpdates(updates);
}

function normalizeDeliveryStatus(value: unknown): DeliveryStatus | null {
  if (typeof value === "number") {
    if (value <= 0) return "failed";
    if (value === 1) return "pending";
    if (value === 2) return "sent";
    if (value === 3) return "delivered";
    if (value === 4) return "read";
    if (value >= 5) return "played";
  }
  const raw = String(value ?? "").trim().toUpperCase().replace(/[ .-]+/g, "_");
  if (!raw) return null;
  if (["ERROR", "FAILED", "FAILURE"].includes(raw)) return "failed";
  if (["PENDING", "PENDENTE"].includes(raw)) return "pending";
  if (["SERVER_ACK", "SENT", "ENVIADO"].includes(raw)) return "sent";
  if (["DELIVERY_ACK", "DELIVERED", "ENTREGUE"].includes(raw)) return "delivered";
  if (["READ", "READ_ACK", "LIDO"].includes(raw)) return "read";
  if (["PLAYED", "REPRODUZIDO"].includes(raw)) return "played";
  return null;
}

function deliveryRank(status: DeliveryStatus | null) {
  if (status === "failed") return 0;
  if (status === "pending") return 1;
  if (status === "sent") return 2;
  if (status === "delivered") return 3;
  if (status === "read") return 4;
  if (status === "played") return 5;
  return -1;
}

function dedupeUpdates(updates: StatusUpdate[]) {
  const map = new Map<string, StatusUpdate>();
  for (const update of updates) {
    const key = `${update.messageId ?? ""}:${update.phone ?? ""}`;
    const existing = map.get(key);
    if (!existing || deliveryRank(update.status) >= deliveryRank(existing.status)) map.set(key, update);
  }
  return [...map.values()];
}

function normalizeEvent(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replaceAll("_", ".");
}

function normalizePhone(value?: string | null) {
  let digits = String(value ?? "").replace(/\D/g, "");
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

function evolutionBase(value: string) {
  const base = value.trim().replace(/\/+$/, "");
  const sendTextIndex = base.indexOf("/message/sendText");
  return sendTextIndex >= 0 ? base.slice(0, sendTextIndex) : base;
}

function safeEqual(expected: string, received: string) {
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(received).digest();
  return timingSafeEqual(a, b);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
