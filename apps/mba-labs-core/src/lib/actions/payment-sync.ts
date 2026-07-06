import "server-only";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type SyncResult = {
  ok: boolean;
  error?: string;
};

export async function syncPagamentoManualComAssinatura(row: any): Promise<SyncResult> {
  const pagamentoId = nullableString(row?.id);
  const assinaturaId = nullableString(row?.assinatura_id);
  const status = String(row?.status ?? "").toLowerCase();

  if (!pagamentoId || !assinaturaId || !["pago", "vencido", "cancelado"].includes(status)) {
    return { ok: true };
  }

  const admin = getSupabaseAdmin() as any;

  const { data: assinatura, error: assinaturaError } = await admin
    .from("core_assinaturas")
    .select("id,empresa_id,app_id,plano_id,vencimento")
    .eq("id", assinaturaId)
    .maybeSingle();

  if (assinaturaError) return { ok: false, error: assinaturaError.message };
  if (!assinatura?.id) return { ok: true };

  if (status === "pago") {
    const paidDate = normalizeDateOnly(row.pagamento_em) ?? todayDateOnly();
    const baseDate = normalizeDateOnly(row.vencimento) ?? normalizeDateOnly(assinatura.vencimento) ?? paidDate;
    const nextDue = addDaysFromDate(baseDate, 30);

    const { error: paymentError } = await admin
      .from("core_pagamentos")
      .update({
        status: "pago",
        pagamento_em: paidDate
      })
      .eq("id", pagamentoId);

    if (paymentError) return { ok: false, error: paymentError.message };

    const { error: assinaturaUpdateError } = await admin
      .from("core_assinaturas")
      .update({
        status: "ativa",
        vencimento: nextDue
      })
      .eq("id", assinaturaId);

    if (assinaturaUpdateError) return { ok: false, error: assinaturaUpdateError.message };

    if (assinatura.empresa_id && assinatura.app_id) {
      const { error: appError } = await admin
        .from("core_empresa_apps")
        .upsert(
          {
            empresa_id: assinatura.empresa_id,
            app_id: assinatura.app_id,
            plano_id: assinatura.plano_id,
            status: "ativo",
            data_vencimento: nextDue
          },
          { onConflict: "empresa_id,app_id" }
        );

      if (appError) return { ok: false, error: appError.message };
    }

    revalidateBillingPaths();
    return { ok: true };
  }

  const assinaturaStatus = status === "cancelado" ? "bloqueada" : "vencida";
  const empresaAppStatus = status === "cancelado" ? "bloqueado" : "vencido";

  const { error: assinaturaStatusError } = await admin
    .from("core_assinaturas")
    .update({ status: assinaturaStatus })
    .eq("id", assinaturaId);

  if (assinaturaStatusError) return { ok: false, error: assinaturaStatusError.message };

  if (assinatura.empresa_id && assinatura.app_id) {
    const { error: empresaAppError } = await admin
      .from("core_empresa_apps")
      .update({ status: empresaAppStatus })
      .eq("empresa_id", assinatura.empresa_id)
      .eq("app_id", assinatura.app_id);

    if (empresaAppError) return { ok: false, error: empresaAppError.message };
  }

  revalidateBillingPaths();
  return { ok: true };
}

function revalidateBillingPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/admin/pagamentos");
  revalidatePath("/admin/assinaturas");
}

function nullableString(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDateOnly(value: unknown) {
  const normalized = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysFromDate(dateInput: string, days: number) {
  const date = new Date(`${normalizeDateOnly(dateInput) ?? todayDateOnly()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
