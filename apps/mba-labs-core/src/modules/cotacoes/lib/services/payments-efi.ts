import type { PaymentStatus } from "@/modules/cotacoes/lib/types";

export interface EfiChargeDraft {
  tenantId: string;
  subscriptionId: string;
  amount: number;
  dueDate: string;
  payerName: string;
  payerDocument: string;
}

export interface EfiChargeResult {
  txid: string;
  status: PaymentStatus;
  copyPaste?: string;
  message: string;
}

export async function createPixCharge(draft: EfiChargeDraft): Promise<EfiChargeResult> {
  // Integração real usa as variáveis EFI_CLIENT_ID, EFI_CLIENT_SECRET,
  // EFI_CERTIFICATE_PATH, EFI_PIX_KEY e EFI_ENVIRONMENT=sandbox|production.
  return {
    txid: `stub-${draft.tenantId}-${draft.subscriptionId}`,
    status: "pending",
    message:
      "Cobranca Pix simulada. Configure as credenciais Efi para emissao real.",
  };
}

export async function getPixChargeStatus(txid: string) {
  // Consulta simulada enquanto as credenciais Efi não estiverem configuradas.
  return {
    txid,
    status: "pending" as PaymentStatus,
    message: "Consulta simulada no modo demo.",
  };
}

export async function handleEfiWebhook(payload: unknown) {
  // Webhook simulado: a versão real valida assinatura e atualiza pagamentos.
  return {
    received: true,
    status: "pending" as PaymentStatus,
    payload,
  };
}

export async function markPaymentAsPaid(paymentId: string) {
  // Marca pagamento no fluxo simulado.
  return { paymentId, status: "paid" as PaymentStatus };
}

export async function suspendTenantIfOverdue(tenantId: string) {
  // Suspensão simulada no modo demo.
  return { tenantId, suspended: false };
}

export async function reactivateTenantAfterPayment(tenantId: string) {
  // Reativação simulada no modo demo.
  return { tenantId, status: "ativo" };
}

export const createEfiPixCharge = createPixCharge;
export const handleEfiPixWebhook = handleEfiWebhook;
