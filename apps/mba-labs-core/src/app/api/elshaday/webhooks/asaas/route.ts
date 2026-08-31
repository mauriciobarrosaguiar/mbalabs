import { NextRequest, NextResponse } from "next/server";
import { processElshadayAsaasWebhook } from "@/lib/elshaday-payments";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const token =
      request.headers.get("asaas-access-token") ??
      request.headers.get("x-asaas-token") ??
      request.headers.get("authorization") ??
      request.headers.get("authtoken") ??
      null;

    const result = await processElshadayAsaasWebhook(payload, token);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[Elshaday PIX webhook] Falha ao processar evento", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao processar evento PIX."
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "asaas",
    module: "elshaday-pix",
    endpoint: "/api/elshaday/webhooks/asaas"
  });
}
