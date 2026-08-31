import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Environment = "sandbox" | "production";
type ContributionType = "dizimo" | "oferta" | "oferta_especial" | "campanha" | "outro";

type Member = {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
};

type PagBankLink = {
  rel?: string;
  href?: string;
  media?: string;
  type?: string;
};

type PagBankQrCode = {
  id?: string;
  text?: string;
  expiration_date?: string;
  links?: PagBankLink[];
};

type PagBankCharge = {
  id?: string;
  reference_id?: string;
  status?: string;
  description?: string;
  amount?: {
    value?: number;
    currency?: string;
  };
  payment_method?: {
    type?: string;
    pix?: {
      expiration_date?: string;
      end_to_end_id?: string;
      holder?: Record<string, unknown>;
    };
  };
  qr_code?: PagBankQrCode;
  links?: PagBankLink[];
};

type PagBankOrder = {
  id?: string;
  reference_id?: string;
  created_at?: string;
  charges?: PagBankCharge[];
  qr_codes?: PagBankQrCode[];
  links?: PagBankLink[];
  [key: string]: unknown;
};

const SANDBOX_URL = "https://sandbox.api.pagseguro.com";
const PRODUCTION_URL = "https://api.pagseguro.com";
const PROVIDER = "pagbank";

export async function createElshadayPagBankIdentifiedPixCharge(input: {
  igrejaId: string;
  member: Member;
  type: ContributionType;
  value: number;
  description?: string | null;
  createdBy: string;
}) {
  const settings = await requirePagBankSettings(input.igrejaId);
  const admin = getSupabaseAdmin() as any;

  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }
  if (value > 1000000) {
    throw new Error("O valor informado ultrapassa o limite permitido para esta contribuição.");
  }

  const cpf = onlyDigits(input.member.cpf);
  if (!isValidCpf(cpf)) {
    throw new Error("O cadastro do membro precisa ter um CPF válido para gerar PIX identificado.");
  }

  const email = String(input.member.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("O cadastro do membro precisa ter um e-mail válido para gerar PIX pelo PagBank.");
  }

  const allowedTypes: ContributionType[] = [
    "dizimo",
    "oferta",
    "oferta_especial",
    "campanha",
    "outro"
  ];
  if (!allowedTypes.includes(input.type)) {
    throw new Error("Tipo de contribuição inválido.");
  }

  const externalReference = `elshaday_identificado:${crypto.randomUUID()}`;
  const dueDate = addDaysIso(todayIsoDate(), 3);
  const expirationDate = `${dueDate}T23:59:59-03:00`;

  const { data: internalCharge, error: chargeError } = await admin
    .from("igreja_pix_cobrancas")
    .insert({
      igreja_id: input.igrejaId,
      membro_id: input.member.id,
      tipo: input.type,
      descricao: input.description?.trim() || null,
      valor: Number(value.toFixed(2)),
      provider: PROVIDER,
      external_reference: externalReference,
      status: "criando",
      due_date: dueDate,
      created_by: input.createdBy
    })
    .select("id")
    .single();

  if (chargeError || !internalCharge?.id) {
    throw new Error(chargeError?.message ?? "Não foi possível preparar a cobrança PIX.");
  }

  try {
    const body: Record<string, unknown> = {
      reference_id: externalReference,
      customer: {
        name: input.member.nome.trim(),
        email,
        tax_id: cpf,
        ...(buildPagBankPhones(input.member.whatsapp || input.member.telefone) ?? {})
      },
      notification_urls: [buildPagBankWebhookUrl()],
      charges: [
        {
          reference_id: externalReference,
          description:
            input.description?.trim() ||
            `${contributionTypeLabel(input.type)} - Igreja Elshaday`,
          amount: {
            value: Math.round(value * 100),
            currency: "BRL"
          },
          payment_method: {
            type: "PIX",
            pix: {
              expiration_date: expirationDate
            }
          }
        }
      ]
    };

    const order = await pagBankRequest<PagBankOrder>(settings, "/orders", {
      method: "POST",
      idempotencyKey: `elshaday${String(internalCharge.id).replace(/[^a-zA-Z0-9]/g, "")}`,
      body
    });

    const orderId = stringValue(order.id);
    const providerCharge =
      (Array.isArray(order.charges)
        ? order.charges.find((item) => String(item.payment_method?.type ?? "").toUpperCase() === "PIX")
        : null) ??
      (Array.isArray(order.charges) ? order.charges[0] : null);

    const providerChargeId = stringValue(providerCharge?.id);
    const qr = providerCharge?.qr_code ?? (Array.isArray(order.qr_codes) ? order.qr_codes[0] : null);
    const qrPayload = stringValue(qr?.text);
    const qrImage = findLink(providerCharge?.links ?? qr?.links, "QRCODE.PNG");
    const providerExpiration =
      stringValue(qr?.expiration_date) ||
      stringValue(providerCharge?.payment_method?.pix?.expiration_date) ||
      expirationDate;

    if (!orderId || !providerChargeId || !qrPayload) {
      throw new Error("O PagBank não retornou pedido, cobrança e PIX Copia e Cola válidos.");
    }

    const { error: updateError } = await admin
      .from("igreja_pix_cobrancas")
      .update({
        provider_order_id: orderId,
        provider_payment_id: providerChargeId,
        status: "aguardando_pagamento",
        qr_payload: qrPayload,
        qr_image: qrImage || null,
        qr_expiration_at: normalizeTimestamp(providerExpiration),
        provider_payload: order,
        updated_at: new Date().toISOString()
      })
      .eq("id", internalCharge.id)
      .eq("igreja_id", input.igrejaId);

    if (updateError) throw new Error(updateError.message);

    return {
      id: String(internalCharge.id),
      paymentId: providerChargeId,
      orderId,
      qrPayload,
      qrImage: qrImage || null,
      dueDate,
      expirationDate: providerExpiration
    };
  } catch (error) {
    await admin
      .from("igreja_pix_cobrancas")
      .update({
        status: "erro",
        provider_payload: {
          error: error instanceof Error ? error.message : "Erro ao gerar PIX PagBank."
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", internalCharge.id)
      .eq("igreja_id", input.igrejaId);

    throw error;
  }
}

export async function processElshadayPagBankWebhook(payload: PagBankOrder) {
  const admin = getSupabaseAdmin() as any;
  const webhookOrderId = stringValue(payload.id);
  const webhookCharge =
    (Array.isArray(payload.charges)
      ? payload.charges.find((item) => String(item.payment_method?.type ?? "").toUpperCase() === "PIX")
      : null) ??
    (Array.isArray(payload.charges) ? payload.charges[0] : null);
  const webhookChargeId = stringValue(webhookCharge?.id);
  const externalReference =
    stringValue(webhookCharge?.reference_id) || stringValue(payload.reference_id);

  let internal: any = null;

  if (webhookChargeId) {
    const { data, error } = await admin
      .from("igreja_pix_cobrancas")
      .select("id,igreja_id,membro_id,tipo,descricao,valor,provider_payment_id,provider_order_id,external_reference,status")
      .eq("provider", PROVIDER)
      .eq("provider_payment_id", webhookChargeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    internal = data;
  }

  if (!internal && webhookOrderId) {
    const { data, error } = await admin
      .from("igreja_pix_cobrancas")
      .select("id,igreja_id,membro_id,tipo,descricao,valor,provider_payment_id,provider_order_id,external_reference,status")
      .eq("provider", PROVIDER)
      .eq("provider_order_id", webhookOrderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    internal = data;
  }

  if (!internal && externalReference) {
    const { data, error } = await admin
      .from("igreja_pix_cobrancas")
      .select("id,igreja_id,membro_id,tipo,descricao,valor,provider_payment_id,provider_order_id,external_reference,status")
      .eq("provider", PROVIDER)
      .eq("external_reference", externalReference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    internal = data;
  }

  if (!internal) {
    return { ok: true, ignored: true, reason: "Cobrança PagBank não pertence ao Elshaday." };
  }

  const settings = await requirePagBankSettings(String(internal.igreja_id));
  let verifiedOrder: PagBankOrder;

  if (stringValue(internal.provider_order_id) || webhookOrderId) {
    const orderId = stringValue(internal.provider_order_id) || webhookOrderId;
    verifiedOrder = await pagBankRequest<PagBankOrder>(
      settings,
      `/orders/${encodeURIComponent(orderId)}`,
      { method: "GET" }
    );
  } else if (stringValue(internal.provider_payment_id) || webhookChargeId) {
    const chargeId = stringValue(internal.provider_payment_id) || webhookChargeId;
    const verifiedCharge = await pagBankRequest<PagBankCharge>(
      settings,
      `/charges/${encodeURIComponent(chargeId)}`,
      { method: "GET" }
    );
    verifiedOrder = {
      id: webhookOrderId || undefined,
      reference_id: externalReference || undefined,
      charges: [verifiedCharge]
    };
  } else {
    throw new Error("Cobrança PagBank sem identificadores para conferência.");
  }

  const verifiedCharge =
    (Array.isArray(verifiedOrder.charges)
      ? verifiedOrder.charges.find(
          (item) =>
            stringValue(item.id) === stringValue(internal.provider_payment_id) ||
            stringValue(item.reference_id) === stringValue(internal.external_reference)
        )
      : null) ??
    (Array.isArray(verifiedOrder.charges) ? verifiedOrder.charges[0] : null);

  if (!verifiedCharge) {
    throw new Error("O PagBank não retornou a cobrança vinculada ao Elshaday.");
  }

  const status = String(verifiedCharge.status ?? "").toUpperCase();
  const verifiedChargeId = stringValue(verifiedCharge.id);
  const verifiedOrderId = stringValue(verifiedOrder.id) || webhookOrderId;
  const eventId = `pagbank:${verifiedOrderId || "order"}:${verifiedChargeId || "charge"}:${status || "unknown"}`;

  const eventRow = await registerPagBankEvent({
    igrejaId: String(internal.igreja_id),
    eventId,
    eventType: status || "UNKNOWN",
    paymentId: verifiedChargeId || null,
    externalReference: stringValue(verifiedCharge.reference_id) || stringValue(internal.external_reference) || null,
    payload: verifiedOrder
  });

  if (eventRow.processed) {
    return { ok: true, duplicate: true, status };
  }

  try {
    if (status === "PAID") {
      await upsertPagBankFinanceEntry({
        internal,
        verifiedOrder,
        verifiedCharge,
        eventId
      });
    } else if (status === "CANCELED") {
      const { error } = await admin
        .from("igreja_pix_cobrancas")
        .update({ status: "cancelado", updated_at: new Date().toISOString() })
        .eq("id", internal.id);
      if (error) throw new Error(error.message);
    } else if (status === "DECLINED") {
      const { error } = await admin
        .from("igreja_pix_cobrancas")
        .update({ status: "erro", updated_at: new Date().toISOString() })
        .eq("id", internal.id);
      if (error) throw new Error(error.message);
    }

    await markPagBankEventProcessed(eventRow.id, null);
    return { ok: true, duplicate: false, status };
  } catch (error) {
    await markPagBankEventProcessed(
      eventRow.id,
      error instanceof Error ? error.message : "Erro ao processar webhook PagBank."
    );
    throw error;
  }
}

async function upsertPagBankFinanceEntry(input: {
  internal: any;
  verifiedOrder: PagBankOrder;
  verifiedCharge: PagBankCharge;
  eventId: string;
}) {
  const admin = getSupabaseAdmin() as any;
  const providerPaymentId = stringValue(input.verifiedCharge.id);
  if (!providerPaymentId) throw new Error("Pagamento PagBank sem identificador.");

  const amountCents = Number(input.verifiedCharge.amount?.value ?? 0);
  const providerValue = amountCents / 100;
  const configuredValue = Number(input.internal.valor ?? 0);

  if (providerValue > 0 && Math.abs(providerValue - configuredValue) > 0.009) {
    throw new Error("Valor confirmado pelo PagBank diverge da cobrança PIX identificada.");
  }

  const { data: existing, error: findError } = await admin
    .from("igreja_financeiro_entradas")
    .select("id")
    .eq("igreja_id", input.internal.igreja_id)
    .eq("provider", PROVIDER)
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();

  if (findError) throw new Error(findError.message);

  const receivedAt = new Date().toISOString();
  const paidDate = todayIsoDate();
  const financeData = {
    igreja_id: input.internal.igreja_id,
    membro_id: input.internal.membro_id,
    tipo: input.internal.tipo,
    descricao:
      input.internal.descricao ||
      `PIX identificado - ${contributionTypeLabel(input.internal.tipo)}`,
    valor: Number(configuredValue.toFixed(2)),
    forma_pagamento: "pix",
    data_entrada: paidDate,
    anonimo: false,
    observacoes: "Contribuição identificada e conciliada automaticamente pelo PagBank.",
    origem: "automatico_pix",
    provider: PROVIDER,
    provider_payment_id: providerPaymentId,
    provider_event_id: input.eventId,
    provider_payload: input.verifiedOrder,
    pix_cobranca_id: input.internal.id,
    recebido_em: receivedAt,
    status: "confirmado"
  };

  if (existing?.id) {
    const { error } = await admin
      .from("igreja_financeiro_entradas")
      .update(financeData)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin
      .from("igreja_financeiro_entradas")
      .insert(financeData);
    if (error && !isUniqueViolation(error)) throw new Error(error.message);
  }

  const { error: chargeError } = await admin
    .from("igreja_pix_cobrancas")
    .update({
      provider_order_id: stringValue(input.verifiedOrder.id) || input.internal.provider_order_id,
      provider_payment_id: providerPaymentId,
      status: "pago",
      paid_at: receivedAt,
      provider_payload: input.verifiedOrder,
      updated_at: new Date().toISOString()
    })
    .eq("id", input.internal.id);

  if (chargeError) throw new Error(chargeError.message);
}

async function registerPagBankEvent(input: {
  igrejaId: string;
  eventId: string;
  eventType: string;
  paymentId: string | null;
  externalReference: string | null;
  payload: PagBankOrder;
}) {
  const admin = getSupabaseAdmin() as any;

  const { data: existing, error: findError } = await admin
    .from("igreja_pix_eventos")
    .select("id,processed")
    .eq("provider", PROVIDER)
    .eq("event_id", input.eventId)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing) return existing;

  const { data, error } = await admin
    .from("igreja_pix_eventos")
    .insert({
      igreja_id: input.igrejaId,
      provider: PROVIDER,
      event_id: input.eventId,
      event_type: input.eventType,
      provider_payment_id: input.paymentId,
      pix_qr_code_id: null,
      external_reference: input.externalReference,
      payload: input.payload,
      processed: false
    })
    .select("id,processed")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const { data: duplicate, error: duplicateError } = await admin
        .from("igreja_pix_eventos")
        .select("id,processed")
        .eq("provider", PROVIDER)
        .eq("event_id", input.eventId)
        .single();
      if (duplicateError) throw new Error(duplicateError.message);
      return duplicate;
    }
    throw new Error(error.message);
  }

  return data;
}

async function markPagBankEventProcessed(id: string, errorMessage: string | null) {
  const admin = getSupabaseAdmin() as any;
  const { error } = await admin
    .from("igreja_pix_eventos")
    .update({
      processed: !errorMessage,
      processing_error: errorMessage,
      processed_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

async function requirePagBankSettings(igrejaId: string) {
  const admin = getSupabaseAdmin() as any;
  const { data: config, error } = await admin
    .from("igreja_pix_configuracoes")
    .select("ativo,ambiente")
    .eq("igreja_id", igrejaId)
    .eq("provider", PROVIDER)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!config?.ativo) {
    throw new Error("PagBank ainda não está ativo para a Igreja Elshaday.");
  }

  const token = String(process.env.ELSHADAY_PAGBANK_TOKEN ?? "").trim();
  if (!token) {
    throw new Error("Token do PagBank ainda não foi configurado no ambiente seguro.");
  }

  const environment: Environment =
    String(config.ambiente ?? "sandbox") === "production" ? "production" : "sandbox";

  return {
    environment,
    apiUrl: environment === "production" ? PRODUCTION_URL : SANDBOX_URL,
    token
  };
}

async function pagBankRequest<T>(
  settings: { apiUrl: string; token: string },
  path: string,
  options: {
    method: "GET" | "POST";
    body?: Record<string, unknown>;
    idempotencyKey?: string;
  }
) {
  const response = await fetch(`${settings.apiUrl}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${settings.token}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.idempotencyKey ? { "x-idempotency-key": options.idempotencyKey } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  const text = await response.text();
  let parsed: unknown = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      stringValue((parsed as any)?.error_messages?.[0]?.description) ||
      stringValue((parsed as any)?.message) ||
      `PagBank respondeu HTTP ${response.status}.`;
    throw new Error(message);
  }

  return (parsed ?? {}) as T;
}

function buildPagBankWebhookUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL ??
    "https://www.mbalabs.com.br";
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  return `${base.replace(/\/+$/, "")}/api/elshaday/webhooks/pagbank`;
}

function buildPagBankPhones(value: string | null | undefined) {
  const digits = onlyDigits(value);
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length !== 10 && local.length !== 11) return null;
  return {
    phones: [
      {
        country: "55",
        area: local.slice(0, 2),
        number: local.slice(2),
        type: "MOBILE"
      }
    ]
  };
}

function findLink(links: PagBankLink[] | undefined, rel: string) {
  if (!Array.isArray(links)) return "";
  return stringValue(links.find((item) => String(item.rel ?? "").toUpperCase() === rel)?.href);
}

function contributionTypeLabel(value: unknown) {
  const labels: Record<string, string> = {
    dizimo: "Dízimo",
    oferta: "Oferta",
    oferta_especial: "Oferta especial",
    campanha: "Campanha",
    outro: "Contribuição"
  };
  return labels[String(value ?? "")] ?? "Contribuição";
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (base: string, factor: number) => {
    let sum = 0;
    for (const char of base) {
      sum += Number(char) * factor;
      factor -= 1;
    }
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };

  const first = digit(cpf.slice(0, 9), 10);
  const second = digit(cpf.slice(0, 9) + String(first), 11);
  return cpf.endsWith(`${first}${second}`);
}

function addDaysIso(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00-03:00`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(parsed);
}

function todayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function normalizeTimestamp(value: unknown) {
  const raw = stringValue(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isUniqueViolation(error: any) {
  return String(error?.code ?? "") === "23505";
}
