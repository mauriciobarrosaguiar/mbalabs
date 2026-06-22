import { NextRequest, NextResponse } from "next/server";
import { processAsaasWebhook } from "@/lib/billing/asaas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const token =
      request.headers.get("asaas-access-token") ??
      request.headers.get("x-asaas-token") ??
      request.headers.get("authorization") ??
      request.headers.get("authToken") ??
      null;

    const result = await processAsaasWebhook(payload, token);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Asaas webhook] Erro ao processar webhook", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao processar webhook Asaas." },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: "asaas", endpoint: "/api/webhooks/asaas" });
}
