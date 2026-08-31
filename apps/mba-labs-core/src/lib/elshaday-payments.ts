import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

type ElshadayPixEnvironment = "sandbox" | "production";

type ElshadayPixConfigRow = {
  igreja_id: string;
  provider: string;
  ambiente: ElshadayPixEnvironment;
  ativo: boolean;
  pix_address_key: string | null;
  static_qr_id: string | null;
  static_qr_payload: string | null;
  static_qr_image: string | null;
  static_qr_provider_payload: Record<string, unknown> | null;
};

type AsaasPayment = {
  id?: string;
  value?: number;
  netValue?: number;
  status?: string;
  billingType?: string;
  externalReference?: string;
  pixQrCodeId?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  confirmedDate?: string;
  description?: string;
  customer?: string;
  [key: string]: unknown;
};

type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  authToken?: string;
  payment?: AsaasPayment;
  [key: string]: unknown;
};

const SANDBOX_URL = "https://api-sandbox.asaas.com/v3";
const PRODUCTION_URL = "https://api.asaas.com/v3";
const PAID_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const REFUND_EVENTS = new Set([
  "PAYMENT_REFUNDED",
  "PAYMENT_DELETED",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE"
]);
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export async function getElshadayPixStatus(igrejaId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data, error } = await admin
    .from("igreja_pix_configuracoes")
    .select("igreja_id,provider,ambiente,ativo,pix_address_key,static_qr_id,static_qr_payload,static_qr_image,static_qr_provider_payload")
    .eq("igreja_id", igrejaId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const config = (data ?? null) as ElshadayPixConfigRow | null;
  const environment = normalizeEnvironment(
    process.env.ELSHADAY_ASAAS_ENVIRONMENT ?? config?.ambiente ?? "sandbox"
  );
  const apiKey = String(process.env.ELSHADAY_ASAAS_API_KEY ?? "").trim();
  const webhookToken = String(process.env.ELSHADAY_ASAAS_WEBHOOK_TOKEN ?? "").trim();
  const addressKey = String(process.env.ELSHADAY_PIX_ADDRESS_KEY ?? config?.pix_address_key ?? "").trim();

  return {
    provider: "asaas" as const,
    environment,
    apiUrl: environment === "production" ? PRODUCTION_URL : SANDBOX_URL,
    active: Boolean(config?.ativo),
    apiKeyConfigured: Boolean(apiKey),
    webhookTokenConfigured: Boolean(webhookToken),
    addressKeyConfigured: Boolean(addressKey),
    ready: Boolean(config?.ativo && apiKey && webhookToken && addressKey),
    webhookUrl: buildWebhookUrl(),
    staticQrId: config?.static_qr_id ?? null,
    staticQrPayload: config?.static_qr_payload ?? null,
    staticQrImage: config?.static_qr_image ?? null
  };
}

export async function saveElshadayPixConfiguration(input: {
  igrejaId: string;
  environment: ElshadayPixEnvironment;
  active: boolean;
  addressKey: string;
  updatedBy: string;
}) {
  const admin = getSupabaseAdmin() as any;
  const { data: current, error: currentError } = await admin
    .from("igreja_pix_configuracoes")
    .select("ambiente,pix_address_key")
    .eq("igreja_id", input.igrejaId)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);

  const nextAddressKey = input.addressKey.trim() || null;
  const changed =
    Boolean(current) &&
    (String(current?.ambiente ?? "sandbox") !== input.environment ||
      String(current?.pix_address_key ?? "") !== String(nextAddressKey ?? ""));

  const payload = {
    igreja_id: input.igrejaId,
    provider: "asaas",
    ambiente: input.environment,
    ativo: input.active,
    pix_address_key: nextAddressKey,
    ...(changed
      ? {
          static_qr_id: null,
          static_qr_payload: null,
          static_qr_image: null,
          static_qr_provider_payload: null
        }
      : {}),
    updated_by: input.updatedBy,
    updated_at: new Date().toISOString()
  };

  const { error } = await admin
    .from("igreja_pix_configuracoes")
    .upsert(payload, { onConflict: "igreja_id" });

  if (error) throw new Error(error.message);
}

export async function createElshadayStaticPixQrCode(igrejaId: string, updatedBy: string) {
  const settings = await requireOperationalSettings(igrejaId);
  const admin = getSupabaseAdmin() as any;

  const response = await asaasRequest<Record<string, unknown>>(settings, "/pix/qrCodes/static", {
    method: "POST",
    body: {
      addressKey: settings.addressKey,
      description: "Contribuições - Assembleia de Deus Elshaday Palmas",
      format: "ALL",
      allowsMultiplePayments: true,
      externalReference: `elshaday_static:${igrejaId}`
    }
  });

  const qrId = stringValue(response.id);
  const qrPayload = stringValue(response.payload);
  const qrImage =
    stringValue(response.encodedImage) ||
    stringValue(response.image) ||
    stringValue(response.qrCode);

  if (!qrId || !qrPayload) {
    throw new Error("O Asaas não retornou o ID e o código PIX esperados.");
  }

  const { error } = await admin
    .from("igreja_pix_configuracoes")
    .upsert(
      {
        igreja_id: igrejaId,
        provider: "asaas",
        ambiente: settings.environment,
        ativo: true,
        pix_address_key: settings.addressKey,
        static_qr_id: qrId,
        static_qr_payload: qrPayload,
        static_qr_image: qrImage || null,
        static_qr_provider_payload: response,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      },
      { onConflict: "igreja_id" }
    );

  if (error) throw new Error(error.message);

  return {
    id: qrId,
    payload: qrPayload,
    image: qrImage || null
  };
}

export async function syncElshadayStaticPixReceipts(igrejaId: string) {
  const settings = await requireOperationalSettings(igrejaId);
  const admin = getSupabaseAdmin() as any;
  const { data: config, error: configError } = await admin
    .from("igreja_pix_configuracoes")
    .select("static_qr_id")
    .eq("igreja_id", igrejaId)
    .maybeSingle();

  if (configError) throw new Error(configError.message);
  const qrId = stringValue(config?.static_qr_id);
  if (!qrId) throw new Error("Gere primeiro o QR Code PIX da igreja.");

  let offset = 0;
  let imported = 0;
  let seen = 0;

  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({
      pixQrCodeId: qrId,
      billingType: "PIX",
      limit: "100",
      offset: String(offset)
    });
    const response = await asaasRequest<{
      data?: AsaasPayment[];
      hasMore?: boolean;
      totalCount?: number;
    }>(settings, `/payments?${query.toString()}`, { method: "GET" });

    const payments = Array.isArray(response.data) ? response.data : [];
    seen += payments.length;

    for (const payment of payments) {
      if (!PAID_STATUSES.has(String(payment.status ?? "").toUpperCase())) continue;
      const result = await upsertAutomaticFinanceEntry({
        igrejaId,
        payment,
        eventId: null,
        origin: "sincronizacao_pix"
      });
      if (result.created) imported += 1;
    }

    if (!response.hasMore || payments.length === 0) break;
    offset += payments.length;
  }

  return { imported, seen };
}

export async function processElshadayAsaasWebhook(
  payload: AsaasWebhookPayload,
  receivedToken?: string | null
) {
  const expectedToken = String(process.env.ELSHADAY_ASAAS_WEBHOOK_TOKEN ?? "").trim();
  if (!expectedToken) {
    throw new Error("Webhook PIX do Elshaday ainda não possui token configurado.");
  }

  const payloadToken = String(payload.authToken ?? "").trim();
  const token = String(receivedToken ?? payloadToken ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token || token !== expectedToken) {
    throw new Error("Webhook PIX com token inválido.");
  }

  const eventType = String(payload.event ?? "").trim();
  const payment = payload.payment ?? {};
  const paymentId = stringValue(payment.id);
  const pixQrCodeId = stringValue(payment.pixQrCodeId);
  const externalReference = stringValue(payment.externalReference);
  const eventId = String(
    payload.id ?? `${eventType}:${paymentId || pixQrCodeId || externalReference || crypto.randomUUID()}`
  ).trim();

  const admin = getSupabaseAdmin() as any;
  let igrejaId = "";

  if (pixQrCodeId) {
    const { data: config, error } = await admin
      .from("igreja_pix_configuracoes")
      .select("igreja_id")
      .eq("provider", "asaas")
      .eq("static_qr_id", pixQrCodeId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    igrejaId = stringValue(config?.igreja_id);
  }

  if (!igrejaId && externalReference.startsWith("elshaday_static:")) {
    igrejaId = externalReference.replace("elshaday_static:", "").trim();
  }

  if (!igrejaId) {
    return { ok: true, ignored: true, reason: "evento não pertence ao PIX do Elshaday" };
  }

  const eventRow = await registerPixEvent({
    igrejaId,
    eventId,
    eventType,
    paymentId: paymentId || null,
    pixQrCodeId: pixQrCodeId || null,
    externalReference: externalReference || null,
    payload
  });

  if (eventRow.processed) {
    return { ok: true, duplicate: true };
  }

  try {
    if (PAID_EVENTS.has(eventType) && String(payment.billingType ?? "").toUpperCase() === "PIX") {
      await upsertAutomaticFinanceEntry({
        igrejaId,
        payment,
        eventId,
        origin: "automatico_pix"
      });
    }

    if (REFUND_EVENTS.has(eventType) && paymentId) {
      const { error } = await admin
        .from("igreja_financeiro_entradas")
        .update({
          status: "estornado",
          provider_event_id: eventId,
          provider_payload: payment
        })
        .eq("igreja_id", igrejaId)
        .eq("provider", "asaas")
        .eq("provider_payment_id", paymentId);

      if (error) throw new Error(error.message);
    }

    await markEventProcessed(eventRow.id, null);
    return { ok: true, duplicate: false };
  } catch (error) {
    await markEventProcessed(
      eventRow.id,
      error instanceof Error ? error.message : "Erro ao processar evento PIX."
    );
    throw error;
  }
}

async function upsertAutomaticFinanceEntry(input: {
  igrejaId: string;
  payment: AsaasPayment;
  eventId: string | null;
  origin: "automatico_pix" | "sincronizacao_pix";
}) {
  const admin = getSupabaseAdmin() as any;
  const paymentId = stringValue(input.payment.id);
  if (!paymentId) throw new Error("Pagamento PIX sem identificador do provedor.");

  const { data: existing, error: findError } = await admin
    .from("igreja_financeiro_entradas")
    .select("id,status")
    .eq("igreja_id", input.igrejaId)
    .eq("provider", "asaas")
    .eq("provider_payment_id", paymentId)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  const value = Number(input.payment.value ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Pagamento PIX sem valor válido.");
  }

  const paidDate =
    normalizeDate(input.payment.clientPaymentDate) ??
    normalizeDate(input.payment.paymentDate) ??
    normalizeDate(input.payment.confirmedDate) ??
    todayIsoDate();

  const data = {
    igreja_id: input.igrejaId,
    membro_id: null,
    tipo: "oferta",
    descricao: "PIX recebido automaticamente",
    valor: Number(value.toFixed(2)),
    forma_pagamento: "pix",
    data_entrada: paidDate,
    anonimo: true,
    observacoes: "Recebimento importado automaticamente pelo Asaas.",
    origem: input.origin,
    provider: "asaas",
    provider_payment_id: paymentId,
    provider_event_id: input.eventId,
    provider_payload: input.payment,
    recebido_em: toReceivedAt(
      input.payment.confirmedDate ??
      input.payment.clientPaymentDate ??
      input.payment.paymentDate ??
      paidDate
    ),
    status: "confirmado"
  };

  if (existing?.id) {
    const { error } = await admin
      .from("igreja_financeiro_entradas")
      .update(data)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { created: false, id: existing.id };
  }

  const { data: inserted, error } = await admin
    .from("igreja_financeiro_entradas")
    .insert(data)
    .select("id")
    .single();

  if (error) {
    if (isUniqueViolation(error)) return { created: false, id: null };
    throw new Error(error.message);
  }

  return { created: true, id: inserted.id };
}

async function registerPixEvent(input: {
  igrejaId: string;
  eventId: string;
  eventType: string;
  paymentId: string | null;
  pixQrCodeId: string | null;
  externalReference: string | null;
  payload: AsaasWebhookPayload;
}) {
  const admin = getSupabaseAdmin() as any;
  const { data: existing, error: findError } = await admin
    .from("igreja_pix_eventos")
    .select("id,processed")
    .eq("provider", "asaas")
    .eq("event_id", input.eventId)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing?.id) return existing as { id: string; processed: boolean };

  const { data, error } = await admin
    .from("igreja_pix_eventos")
    .insert({
      igreja_id: input.igrejaId,
      provider: "asaas",
      event_id: input.eventId,
      event_type: input.eventType || null,
      provider_payment_id: input.paymentId,
      pix_qr_code_id: input.pixQrCodeId,
      external_reference: input.externalReference,
      payload: input.payload
    })
    .select("id,processed")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const { data: duplicated, error: duplicateError } = await admin
        .from("igreja_pix_eventos")
        .select("id,processed")
        .eq("provider", "asaas")
        .eq("event_id", input.eventId)
        .maybeSingle();
      if (duplicateError || !duplicated) {
        throw new Error(duplicateError?.message ?? "Falha ao recuperar evento PIX duplicado.");
      }
      return duplicated as { id: string; processed: boolean };
    }
    throw new Error(error.message);
  }

  return data as { id: string; processed: boolean };
}

async function markEventProcessed(eventId: string, processingError: string | null) {
  const admin = getSupabaseAdmin() as any;
  const { error } = await admin
    .from("igreja_pix_eventos")
    .update({
      processed: !processingError,
      processed_at: processingError ? null : new Date().toISOString(),
      processing_error: processingError
    })
    .eq("id", eventId);

  if (error) throw new Error(error.message);
}

async function requireOperationalSettings(igrejaId: string) {
  const status = await getElshadayPixStatus(igrejaId);
  const apiKey = String(process.env.ELSHADAY_ASAAS_API_KEY ?? "").trim();

  const admin = getSupabaseAdmin() as any;
  const { data: config, error } = await admin
    .from("igreja_pix_configuracoes")
    .select("pix_address_key,ativo,ambiente")
    .eq("igreja_id", igrejaId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const finalAddressKey = String(
    process.env.ELSHADAY_PIX_ADDRESS_KEY ?? config?.pix_address_key ?? ""
  ).trim();

  if (!config?.ativo) throw new Error("Ative a integração PIX do Elshaday.");
  if (!apiKey) throw new Error("A API Key da conta Asaas da igreja ainda não está configurada.");
  if (!finalAddressKey) throw new Error("Informe a chave PIX da igreja.");

  const environment = normalizeEnvironment(
    process.env.ELSHADAY_ASAAS_ENVIRONMENT ?? config?.ambiente ?? status.environment
  );

  return {
    environment,
    apiUrl: environment === "production" ? PRODUCTION_URL : SANDBOX_URL,
    apiKey,
    addressKey: finalAddressKey
  };
}

async function asaasRequest<T>(
  settings: { apiUrl: string; apiKey: string },
  path: string,
  options: { method: string; body?: unknown }
): Promise<T> {
  const response = await fetch(`${settings.apiUrl}${path}`, {
    method: options.method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: settings.apiKey
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store"
  });

  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(resolveAsaasError(json) || `Erro Asaas ${response.status}.`);
  }

  return json as T;
}

function buildWebhookUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL ??
    "https://www.mbalabs.com.br";
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  return `${base.replace(/\/+$/, "")}/api/elshaday/webhooks/asaas`;
}

function resolveAsaasError(json: unknown) {
  const data = json as {
    errors?: Array<{ description?: string; message?: string }>;
    message?: string;
  } | null;
  return data?.errors?.[0]?.description ?? data?.errors?.[0]?.message ?? data?.message ?? "";
}

function normalizeEnvironment(value: unknown): ElshadayPixEnvironment {
  return String(value ?? "").toLowerCase() === "production" ? "production" : "sandbox";
}

function normalizeDate(value: unknown) {
  const date = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function todayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function toReceivedAt(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date().toISOString();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T12:00:00-03:00`)
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function isUniqueViolation(error: unknown) {
  const code =
    typeof error === "object" && error !== null
      ? String((error as Record<string, unknown>).code ?? "")
      : "";
  const message =
    typeof error === "object" && error !== null
      ? String((error as Record<string, unknown>).message ?? "")
      : "";
  return code === "23505" || message.toLowerCase().includes("duplicate key");
}
