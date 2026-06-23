import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAsaasSettings } from "@/lib/billing/asaas";

type AsaasPayment = {
  id?: string;
  status?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  dueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  value?: number;
  billingType?: string;
  externalReference?: string;
};

const paidStatuses = new Set(["RECEIVED", "RECEIVED_IN_CASH", "CONFIRMED"]);
const overdueStatuses = new Set(["OVERDUE"]);
const canceledStatuses = new Set(["DELETED", "REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL"]);

export async function syncAsaasPaymentStatus(paymentId: string) {
  const admin = getSupabaseAdmin() as any;
  const settings = await getAsaasSettings();

  if (!settings.active || !settings.apiKey) {
    throw new Error("Asaas não configurado.");
  }

  const { data: payment, error } = await admin
    .from("core_pagamentos")
    .select("id,empresa_id,assinatura_id,vencimento,asaas_payment_id,referencia_externa")
    .eq("id", paymentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!payment?.id) throw new Error("Pagamento não encontrado.");
  if (!payment.asaas_payment_id) throw new Error("Este pagamento ainda não possui cobrança Asaas gerada.");

  const asaasPayment = await fetchAsaasPayment(settings, String(payment.asaas_payment_id));
  const status = mapAsaasPaymentStatus(asaasPayment.status ?? "");
  const paidAt = status === "pago"
    ? asaasPayment.clientPaymentDate ?? asaasPayment.paymentDate ?? new Date().toISOString().slice(0, 10)
    : null;

  const { error: updateError } = await admin
    .from("core_pagamentos")
    .update({
      status,
      pagamento_em: paidAt,
      asaas_status: asaasPayment.status ?? null,
      asaas_payload: asaasPayment,
      payment_url: asaasPayment.invoiceUrl ?? null,
      invoice_url: asaasPayment.invoiceUrl ?? null,
      bank_slip_url: asaasPayment.bankSlipUrl ?? null,
      billing_type: asaasPayment.billingType ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (updateError) throw new Error(updateError.message);

  if (payment.assinatura_id) {
    await updateSubscriptionFromPayment({
      admin,
      assinaturaId: payment.assinatura_id,
      status,
      dueDate: asaasPayment.dueDate ?? payment.vencimento,
    });
  }

  return { status, asaasStatus: asaasPayment.status };
}

async function updateSubscriptionFromPayment(input: {
  admin: any;
  assinaturaId: string;
  status: "pendente" | "pago" | "vencido" | "cancelado";
  dueDate?: string | null;
}) {
  const { admin, assinaturaId, status, dueDate } = input;

  if (status === "pago") {
    const nextDue = addDays(dueDate ?? todayIsoDate(), 30);
    const { data: assinatura } = await admin
      .from("core_assinaturas")
      .select("id,empresa_id,app_id,plano_id")
      .eq("id", assinaturaId)
      .maybeSingle();

    await admin
      .from("core_assinaturas")
      .update({ status: "ativa", vencimento: nextDue })
      .eq("id", assinaturaId);

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

  if (status === "vencido") {
    await admin.from("core_assinaturas").update({ status: "vencida" }).eq("id", assinaturaId);
  }

  if (status === "cancelado") {
    await admin.from("core_assinaturas").update({ status: "bloqueada" }).eq("id", assinaturaId);
  }
}

async function fetchAsaasPayment(settings: Awaited<ReturnType<typeof getAsaasSettings>>, asaasPaymentId: string) {
  const response = await fetch(`${settings.apiUrl}/payments/${asaasPaymentId}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      access_token: settings.apiKey,
    },
    cache: "no-store",
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = resolveAsaasError(json) || `Erro Asaas ${response.status}.`;
    throw new Error(message);
  }

  return json as AsaasPayment;
}

function mapAsaasPaymentStatus(status: string): "pendente" | "pago" | "vencido" | "cancelado" {
  const normalized = String(status ?? "").toUpperCase();
  if (paidStatuses.has(normalized)) return "pago";
  if (overdueStatuses.has(normalized)) return "vencido";
  if (canceledStatuses.has(normalized)) return "cancelado";
  return "pendente";
}

function resolveAsaasError(json: unknown) {
  const data = json as { errors?: Array<{ description?: string; message?: string }>; message?: string } | null;
  const first = data?.errors?.[0];
  return first?.description ?? first?.message ?? data?.message ?? "";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateInput: string, days: number) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(String(dateInput).slice(0, 10))
    ? String(dateInput).slice(0, 10)
    : todayIsoDate();
  const date = new Date(`${normalized}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
