import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/modules/cotacoes/lib/supabase/server";

export const runtime = "nodejs";

const backupBucket = "mba-cotacoes-backups";
const backupTables = [
  "tenants",
  "pharmacies",
  "suppliers",
  "distributors",
  "laboratories",
  "products",
  "quotations",
  "quotation_items",
  "supplier_quote_sessions",
  "supplier_quote_responses",
  "supplier_quote_response_items",
  "purchase_orders",
  "purchase_order_items",
  "winner_order_pending_items",
  "audit_logs",
];

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Backup nao autorizado ou CRON_SECRET ausente." }, { status: 401 });
  }

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({ error: "Supabase service role nao configurado para backup." }, { status: 409 });
  }

  const supabase = createSupabaseAdminClient();
  const createdAt = new Date().toISOString();
  const snapshot: Record<string, unknown> = {
    createdAt,
    source: "mba-cotacoes",
    tables: {},
    errors: [],
  };
  const tableCounts: Record<string, number> = {};
  const errors: Array<{ table: string; message: string }> = [];

  for (const table of backupTables) {
    try {
      const { data, error } = await supabase.from(table).select("*").limit(10000);
      if (error) {
        errors.push({ table, message: error.message });
        continue;
      }
      (snapshot.tables as Record<string, unknown>)[table] = data ?? [];
      tableCounts[table] = data?.length ?? 0;
    } catch (error) {
      errors.push({ table, message: error instanceof Error ? error.message : "Erro desconhecido." });
    }
  }

  (snapshot.errors as Array<{ table: string; message: string }>).push(...errors);

  await ensureBackupBucket(supabase);
  const path = `${createdAt.slice(0, 10)}/backup-${createdAt.replace(/[:.]/g, "-")}.json`;
  const { error: uploadError } = await supabase.storage
    .from(backupBucket)
    .upload(path, JSON.stringify(snapshot, null, 2), {
      contentType: "application/json",
      upsert: false,
    });

  if (uploadError) {
    await recordBackupAudit(supabase, "error", {
      path,
      tableCounts,
      errors: [...errors, { table: "storage", message: uploadError.message }],
    });
    return NextResponse.json({ error: uploadError.message, tableCounts, errors }, { status: 500 });
  }

  await recordBackupAudit(supabase, errors.length > 0 ? "warning" : "info", {
    path,
    tableCounts,
    errors,
  });

  return NextResponse.json({
    ok: errors.length === 0,
    bucket: backupBucket,
    path,
    tableCounts,
    errors,
  });
}

async function ensureBackupBucket(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await supabase.storage.getBucket(backupBucket);
  if (data) return;
  const { error } = await supabase.storage.createBucket(backupBucket, { public: false });
  if (error && !error.message.toLowerCase().includes("already exists")) throw error;
}

async function recordBackupAudit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  severity: "info" | "warning" | "error",
  metadata: Record<string, unknown>,
) {
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: null,
    actor: "Sistema",
    action: "Backup Supabase MBA Cotacoes",
    entity: "supabase_backup",
    severity,
    metadata,
  });
  if (error) console.error("[Backup Supabase] Falha ao registrar auditoria", error);
}
