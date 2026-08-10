import { NextResponse } from "next/server";
import { configureEvolutionStatusWebhook } from "@/modules/cotacoes/lib/whatsapp/evolution-status-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Rota de configuração disponível somente no preview." }, { status: 404 });
  }

  try {
    const result = await configureEvolutionStatusWebhook(
      "https://www.mbalabs.com.br/api/cotacoes/webhooks/evolution/status",
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao configurar webhook da Evolution.",
    }, { status: 500 });
  }
}
