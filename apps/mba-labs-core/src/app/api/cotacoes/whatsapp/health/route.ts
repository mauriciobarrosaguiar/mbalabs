import { NextRequest, NextResponse } from "next/server";
import { checkWhatsappGlobalHealth } from "@/modules/cotacoes/lib/whatsapp/mba-cotacoes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Health check nao autorizado ou CRON_SECRET ausente." }, { status: 401 });
  }

  const health = await checkWhatsappGlobalHealth();
  const status = health.configured ? 200 : 409;
  return NextResponse.json(health, { status });
}
