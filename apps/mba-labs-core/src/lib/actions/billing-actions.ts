"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserProfile, logAction } from "@/lib/core-data";
import { messageParam, textValue } from "@/lib/form-utils";
import {
  createAsaasChargeForCorePayment,
  saveAsaasSettings,
  testAsaasConnection,
  type AsaasBillingType,
} from "@/lib/billing/asaas";
import { syncAsaasPaymentStatus } from "@/lib/billing/asaas-sync";

const billingTypes = new Set(["UNDEFINED", "PIX", "CREDIT_CARD", "BOLETO"]);

export async function generateAsaasPaymentAction(formData: FormData) {
  const current = await getCurrentUserProfile("/admin/pagamentos");
  if (!current.isAdminMaster) redirect("/dashboard");

  const paymentId = textValue(formData, "payment_id");
  const billingType = textValue(formData, "billing_type") || "UNDEFINED";

  if (!paymentId) {
    redirect(`/admin/pagamentos?error=${messageParam("Informe o pagamento para gerar cobrança.")}`);
  }

  if (!billingTypes.has(billingType)) {
    redirect(`/admin/pagamentos?error=${messageParam("Forma de pagamento inválida.")}`);
  }

  try {
    await createAsaasChargeForCorePayment(paymentId, billingType as AsaasBillingType);
    await logAction({ acao: "gerar cobrança Asaas", detalhes: { paymentId, billingType } });
  } catch (error) {
    redirect(`/admin/pagamentos?error=${messageParam(error instanceof Error ? error.message : "Erro ao gerar cobrança Asaas.")}`);
  }

  revalidatePath("/admin/pagamentos");
  redirect(`/admin/pagamentos?ok=${messageParam("Cobrança Asaas gerada. O link já pode ser enviado ao cliente.")}`);
}

export async function syncAsaasPaymentAction(formData: FormData) {
  const current = await getCurrentUserProfile("/admin/pagamentos");
  if (!current.isAdminMaster) redirect("/dashboard");

  const paymentId = textValue(formData, "payment_id");
  if (!paymentId) {
    redirect(`/admin/pagamentos?error=${messageParam("Informe o pagamento para sincronizar.")}`);
  }

  try {
    const result = await syncAsaasPaymentStatus(paymentId);
    await logAction({ acao: "sincronizar cobrança Asaas", detalhes: { paymentId, result } });
    revalidatePath("/admin/pagamentos");
    redirect(`/admin/pagamentos?ok=${messageParam(`Pagamento sincronizado: ${result.status}.`)}`);
  } catch (error) {
    redirect(`/admin/pagamentos?error=${messageParam(error instanceof Error ? error.message : "Erro ao sincronizar cobrança Asaas.")}`);
  }
}

export async function saveAsaasSettingsAction(formData: FormData) {
  const current = await getCurrentUserProfile("/admin/configuracoes/asaas");
  if (!current.isAdminMaster) redirect("/dashboard");

  const environment = textValue(formData, "environment") === "production" ? "production" : "sandbox";

  try {
    await saveAsaasSettings({
      environment,
      apiUrl: textValue(formData, "api_url"),
      apiKey: textValue(formData, "api_key"),
      webhookToken: textValue(formData, "webhook_token"),
      active: formData.get("ativo") === "on",
    });
    await logAction({ acao: "salvar configuração Asaas", detalhes: { environment } });
  } catch (error) {
    redirect(`/admin/configuracoes/asaas?error=${messageParam(error instanceof Error ? error.message : "Erro ao salvar configuração Asaas.")}`);
  }

  revalidatePath("/admin/configuracoes/asaas");
  redirect(`/admin/configuracoes/asaas?ok=${messageParam("Configuração Asaas salva.")}`);
}

export async function testAsaasConnectionAction() {
  const current = await getCurrentUserProfile("/admin/configuracoes/asaas");
  if (!current.isAdminMaster) redirect("/dashboard");

  try {
    await testAsaasConnection();
  } catch (error) {
    redirect(`/admin/configuracoes/asaas?error=${messageParam(error instanceof Error ? error.message : "Erro ao testar Asaas.")}`);
  }

  redirect(`/admin/configuracoes/asaas?ok=${messageParam("Conexão Asaas validada.")}`);
}
