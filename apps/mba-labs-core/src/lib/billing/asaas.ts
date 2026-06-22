import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type AsaasBillingType = "UNDEFINED" | "PIX" | "CREDIT_CARD" | "BOLETO";

type AsaasSettings = {
  environment: "sandbox" | "production";
  apiUrl: string;
  apiKey: string;
  webhookToken: string;
  active: boolean;
};

type CorePaymentRow = {
  id: string;
  empresa_id: string;
  assinatura_id: string | null;
  valor: number;
  vencimento: string | null;
  metodo: string | null;
  status: string | null;
  referencia_externa: string | null;
  core_empresas?: Record<string, unknown> | Record<string, unknown>[] | null;
  core_assinaturas?: Record<string, unknown> | Record<string, unknown>[] | null;
};

type AsaasPaymentPayload = {
  id?: string;
  customer?: string;
  billingType?: string;
  status?: string;
  value?: number;
  dueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  externalReference?: string;
};

type AsaasWebhookPayload = {
  id?: string;
  event?: string;
  authToken?: string;
  payment?: AsaasPaymentPayload;
  subscription?: Record<string, unknown>;
  [key: string]: unknown;
};

const defaultSandboxUrl = "https://api-sandbox.asaas.com/v3";
const defaultProductionUrl = "https://api.asaas.com/v3";
const paidStatuses = new Set(["RECEIVED", "RECEIVED_IN_CASH", "CONFIRMED"]);
const overdueStatuses = new Set(["OVERDUE"]);
const canceledStatuses = new Set(["DELETED", "REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL", "DUNNING_REQUESTED", "DUNNING_RECEIVED"]);

export async function getAsaasSettings(): Promise<AsaasSettings> {
  const admin = getSupabaseAdmin() as any;
  let row: Record<string, unknown> | null = null;

  try {
    const { data } = await admin
      .from("core_payment_settings")
      .select("environment,api_url,api_key,webhook_token,ativo")
      .eq("provider", "asaas")
      .maybeSingle();
    row = data ?? null;
  } catch {
    row = null;
  }

  const environment = normalizeEnvironment(
    process.env.ASAAS_ENVIRONMENT ?? String(row?.environment ?? "sandbox"),
  );
  const apiUrl = normalizeApiUrl(
    process.env.ASAAS_API_URL ?? String(row?.api_url ?? ""),
    environment,
  );
  const apiKey = String(process.env.ASAAS_API_KEY ?? row?.api_key ?? "").trim();
  const webhookToken = String(process.env.ASAAS_WEBHOOK_TOKEN ?? row?.webhook_token ?? "").trim();
  const active = Boolean(process.env.ASAAS_API_KEY || row?.ativo);

  return { environment, apiUrl, apiKey, webhookToken, active };
}

export async function saveAsaasSettings(input: {
  environment: "sandbox" | "production";
  apiUrl?: string;
  apiKey?: string;
  webhookToken?: string;
  active: boolean;
}) {
  const admin = getSupabaseAdmin() as any;
  const current = await getAsaasSettings();
  const payload = {
    provider: "asaas",
    environment: input.environment,
    api_url: input.apiUrl?.trim() || null,
    api_key: input.apiKey?.trim() || current.apiKey || null,
    webhook_token: input.webhookToken?.trim() || current.webhookToken || null,
    ativo: input.active,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("core_payment_settings")
    .upsert(payload, { onConflict: "provider" });

  if (error) throw new Error(error.message);
}

export async function createAsaasChargeForCorePayment(paymentId: string, billingType?: AsaasBillingType) {
  const settings = await getAsaasSettings();
  if (!settings.active || !settings.apiKey) {
    throw new Error("Asaas não configurado. Informe a API Key nas variáveis da Vercel ou na configuração do Admin Master.");
  }

  const admin = getSupabaseAdmin() as any;
  const { data: payment, error: paymentError } = await admin
    .from("core_pagamentos")
    .select("id,empresa_id,assinatura_id,valor,vencimento,metodo,status,referencia_externa,core_empresas(*),core_assinaturas(id,app_id,plano_id,status,inicio,vencimento,core_apps(nome,slug),core_planos(nome,valor_mensal))")
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) throw new Error(paymentError.message);
  if (!payment) throw new Error("Pagamento não encontrado.");

  const row = payment as CorePaymentRow;
  const empresa = relationObject(row.core_empresas);
  const assinatura = relationObject(row.core_assinaturas);
  const customerId = await ensureAsaasCustomer(empresa, settings);
  const value = normalizeMoney(row.valor) || normalizeMoney(relationObject(assinatura?.core_planos)?.valor_mensal);
  if (!value || value <= 0) throw new Error("Pagamento sem valor válido para gerar cobrança.");

  const dueDate = normalizeDate(row.vencimento) ?? todayIsoDate();
  const selectedBillingType = billingType ?? resolveBillingType(row.metodo);
  const description = buildPaymentDescription(empresa, assinatura);
  const externalReference = `core_pagamento:${row.id}`;

  const asaasPayment = await asaasRequest<AsaasPaymentPayload>(settings, "/payments", {
    method: "POST",
    body: {
      customer: customerId,
      billingType: selectedBillingType,
      value,
      dueDate,
      description,
      externalReference,
    },
  });

  const { error: updateError } = await admin
    .from("core_pagamentos")
    .update({
      provider: "asaas",
      billing_type: selectedBillingType,
      asaas_payment_id: asaasPayment.id ?? null,
      asaas_customer_id: customerId,
      asaas_status: asaasPayment.status ?? null,
      asaas_payload: asaasPayment,
      payment_url: asaasPayment.invoiceUrl ?? null,
      invoice_url: asaasPayment.invoiceUrl ?? null,
      bank_slip_url: asaasPayment.bankSlipUrl ?? null,
      referencia_externa: asaasPayment.externalReference ?? externalReference,
      status: mapAsaasPaymentStatus(asaasPayment.status ?? "PENDING"),
      metodo: selectedBillingType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateError) throw new Error(updateError.message);

  return asaasPayment;
}

export async function processAsaasWebhook(payload: AsaasWebhookPayload, receivedToken?: string | null) {
  const settings = await getAsaasSettings();
  const expectedToken = settings.webhookToken;
  const payloadToken = String(payload.authToken ?? "").trim();
  const token = String(receivedToken ?? payloadToken ?? "").replace(/^Bearer\s+/i, "").trim();

  if (expectedToken && token !== expectedToken) {
    throw new Error("Webhook Asaas com token inválido.");
  }

  const eventType = String(payload.event ?? "").trim();
  const payment = payload.payment ?? {};
  const paymentId = String(payment.id ?? "").trim();
  const externalReference = String(payment.externalReference ?? "").trim();
  const admin = getSupabaseAdmin() as any;

  const eventId = String(payload.id ?? `${eventType}:${paymentId || externalReference}`).trim();
  const { data: eventRow, error: eventError } = await admin
    .from("core_payment_webhook_events")
    .upsert(
      {
        provider: "asaas",
        event_id: eventId || null,
        event_type: eventType || null,
        payment_id: paymentId || null,
        external_reference: externalReference || null,
        payload,
      },
      { onConflict: "provider,event_id" },
    )
    .select("id,processed")
    .single();

  if (eventError) throw new Error(eventError.message);
  if (eventRow?.processed) {
    return { ok: true, duplicate: true };
  }

  try {
    const status = mapAsaasEventToCoreStatus(eventType, payment.status);
    if (status) {
      await updateCorePaymentFromAsaasPayment({
        paymentId,
        externalReference,
        status,
        asaasStatus: payment.status,
        payload: payment,
        paidAt: payment.clientPaymentDate ?? payment.paymentDate,
        dueDate: payment.dueDate,
      });
    }

    await admin
      .from("core_payment_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString(), processing_error: null })
      .eq("id", eventRow.id);

    return { ok: true, duplicate: false };
  } catch (error) {
    await admin
      .from("core_payment_webhook_events")
      .update({
        processed: false,
        processing_error: error instanceof Error ? error.message : "Erro ao processar webhook Asaas.",
      })
      .eq("id", eventRow.id);
    throw error;
  }
}

export async function testAsaasConnection() {
  const settings = await getAsaasSettings();
  if (!settings.active || !settings.apiKey) {
    throw new Error("Asaas não configurado.");
  }

  return asaasRequest(settings, "/finance/balance", { method: "GET" });
}

async function ensureAsaasCustomer(empresa: Record<string, unknown>, settings: AsaasSettings) {
  const admin = getSupabaseAdmin() as any;
  const empresaId = String(empresa.id ?? "").trim();
  const existing = String(empresa.asaas_customer_id ?? "").trim();
  if (existing) return existing;

  const cpfCnpj = onlyDigits(String(empresa.cnpj ?? ""));
  const payload = {
    name: String(empresa.nome_fantasia ?? empresa.nome ?? empresa.razao_social ?? "Cliente MBA Labs"),
    email: String(empresa.billing_email ?? empresa.email ?? "").trim() || undefined,
    mobilePhone: onlyDigits(String(empresa.billing_whatsapp ?? empresa.whatsapp ?? empresa.telefone ?? "")) || undefined,
    cpfCnpj: cpfCnpj || undefined,
    externalReference: `core_empresa:${empresaId}`,
    notificationDisabled: false,
  };

  const customer = await asaasRequest<{ id?: string }>(settings, "/customers", { method: "POST", body: payload });
  if (!customer.id) throw new Error("Asaas não retornou o ID do cliente.");

  const { error } = await admin
    .from("core_empresas")
    .update({ asaas_customer_id: customer.id })
    .eq("id", empresaId);

  if (error) throw new Error(error.message);
  return customer.id;
}

async function updateCorePaymentFromAsaasPayment(input: {
  paymentId: string;
  externalReference: string;
  status: "pendente" | "pago" | "vencido" | "cancelado";
  asaasStatus?: string;
  payload: AsaasPaymentPayload;
  paidAt?: string;
  dueDate?: string;
}) {
  const admin = getSupabaseAdmin() as any;
  let query = admin.from("core_pagamentos").select("id,empresa_id,assinatura_id,vencimento").limit(1);

  if (input.paymentId) {
    query = query.eq("asaas_payment_id", input.paymentId);
  } else if (input.externalReference.startsWith("core_pagamento:")) {
    query = query.eq("id", input.externalReference.replace("core_pagamento:", ""));
  } else {
    query = query.eq("referencia_externa", input.externalReference);
  }

  const { data: rows, error: findError } = await query;
  if (findError) throw new Error(findError.message);
  const payment = rows?.[0];
  if (!payment?.id) return;

  const paidAt = input.status === "pago"
    ? input.paidAt ?? new Date().toISOString().slice(0, 10)
    : null;

  const { error: updateError } = await admin
    .from("core_pagamentos")
    .update({
      status: input.status,
      pagamento_em: paidAt,
      asaas_status: input.asaasStatus ?? null,
      asaas_payload: input.payload,
      payment_url: input.payload.invoiceUrl ?? null,
      invoice_url: input.payload.invoiceUrl ?? null,
      bank_slip_url: input.payload.bankSlipUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (updateError) throw new Error(updateError.message);

  if (payment.assinatura_id) {
    if (input.status === "pago") {
      const nextDue = addDays(input.dueDate ?? String(payment.vencimento ?? todayIsoDate()), 30);
      const { data: assinatura } = await admin
        .from("core_assinaturas")
        .select("id,empresa_id,app_id,plano_id")
        .eq("id", payment.assinatura_id)
        .maybeSingle();

      await admin
        .from("core_assinaturas")
        .update({ status: "ativa", vencimento: nextDue })
        .eq("id", payment.assinatura_id);

      if (assinatura?.empresa_id && assinatura?.app_id) {
        await admin
          .from("core_empresa_apps")
          .upsert(
            {
              empresa_id: assinatura.empresa_id,
              app_id: assinatura.app_id,
              plano_id: assinatura.plano_id,
              status: "ativo",
              data_vencimento: nextDue,
            },
            { onConflict: "empresa_id,app_id" },
          );
      }
    }

    if (input.status === "vencido") {
      await admin
        .from("core_assinaturas")
        .update({ status: "vencida" })
        .eq("id", payment.assinatura_id);
    }

    if (input.status === "cancelado") {
      await admin
        .from("core_assinaturas")
        .update({ status: "bloqueada" })
        .eq("id", payment.assinatura_id);
    }
  }
}

async function asaasRequest<T>(settings: AsaasSettings, path: string, options: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(`${settings.apiUrl}${path}`, {
    method: options.method,
    headers: {
      "accept": "application/json",
      "content-type": "application/json",
      "access_token": settings.apiKey,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = resolveAsaasError(json) || `Erro Asaas ${response.status}.`;
    throw new Error(message);
  }

  return json as T;
}

function resolveAsaasError(json: unknown) {
  const data = json as { errors?: Array<{ description?: string; message?: string }>; message?: string } | null;
  const first = data?.errors?.[0];
  return first?.description ?? first?.message ?? data?.message ?? "";
}

function mapAsaasEventToCoreStatus(event: string, paymentStatus?: string) {
  if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") return "pago";
  if (event === "PAYMENT_OVERDUE") return "vencido";
  if (["PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE"].includes(event)) return "cancelado";
  return mapAsaasPaymentStatus(paymentStatus ?? "");
}

function mapAsaasPaymentStatus(status: string): "pendente" | "pago" | "vencido" | "cancelado" {
  const normalized = String(status ?? "").toUpperCase();
  if (paidStatuses.has(normalized)) return "pago";
  if (overdueStatuses.has(normalized)) return "vencido";
  if (canceledStatuses.has(normalized)) return "cancelado";
  return "pendente";
}

function resolveBillingType(method?: string | null): AsaasBillingType {
  const normalized = String(method ?? "").toUpperCase().replaceAll("É", "E").replaceAll(" ", "_");
  if (normalized.includes("PIX")) return "PIX";
  if (normalized.includes("CREDIT") || normalized.includes("CARTAO")) return "CREDIT_CARD";
  if (normalized.includes("BOLETO")) return "BOLETO";
  return "UNDEFINED";
}

function buildPaymentDescription(empresa: Record<string, unknown>, assinatura: Record<string, unknown>) {
  const empresaNome = String(empresa.nome_fantasia ?? empresa.nome ?? "Cliente");
  const appNome = String(relationObject(assinatura.core_apps)?.nome ?? "MBA Labs");
  const planoNome = String(relationObject(assinatura.core_planos)?.nome ?? "Plano");
  return `MBA Labs - ${appNome} - ${planoNome} - ${empresaNome}`.slice(0, 500);
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : {};
}

function normalizeEnvironment(value: string): "sandbox" | "production" {
  return value === "production" ? "production" : "sandbox";
}

function normalizeApiUrl(value: string, environment: "sandbox" | "production") {
  const fallback = environment === "production" ? defaultProductionUrl : defaultSandboxUrl;
  return String(value || fallback).replace(/\/+$/, "");
}

function normalizeMoney(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0;
}

function normalizeDate(value: unknown) {
  const normalized = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateInput: string, days: number) {
  const date = new Date(`${normalizeDate(dateInput) ?? todayIsoDate()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}
