import { NextRequest, NextResponse } from "next/server";
import { processEvolutionStatusWebhook } from "@/modules/cotacoes/lib/whatsapp/evolution-status-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const result = await processEvolutionStatusWebhook({
      secret: request.headers.get("x-mba-webhook-secret"),
      payload,
    });
    return NextResponse.json(result, { status: result.status });
  } catch (error) {
    console.error("[MBA Cotações] Falha ao processar webhook da Evolution", error);
    return NextResponse.json({ ok: false, error: "Falha ao processar o status da Evolution." }, { status: 500 });
  }
}
