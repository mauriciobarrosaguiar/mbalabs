import { NextRequest, NextResponse } from "next/server";
import { handleEfiWebhook } from "@/lib/services/payments-efi";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => ({}));
  const result = await handleEfiWebhook(payload);

  return NextResponse.json({
    ok: true,
    message:
      "Webhook Efi recebido. Configure validacao de assinatura e atualizacao por txid antes de producao.",
    result,
  });
}
