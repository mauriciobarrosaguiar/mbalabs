import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";
import { configureEvolutionStatusWebhook } from "@/modules/cotacoes/lib/whatsapp/evolution-status-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data: config } = await supabase
    .from("cot_whatsapp_global_config")
    .select("webhook_enabled, webhook_url")
    .eq("ativo", true)
    .eq("provider", "evolution_api")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const target = "https://www.mbalabs.com.br/api/cotacoes/webhooks/evolution/status";
  if (config?.webhook_enabled && config.webhook_url === target) {
    return NextResponse.json({ ok: true, alreadyConfigured: true, webhookUrl: target });
  }

  try {
    const result = await configureEvolutionStatusWebhook(target);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao ativar webhook da Evolution.",
    }, { status: 500 });
  }
}
