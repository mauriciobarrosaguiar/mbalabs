import { NextResponse } from "next/server";
import { getRuntimeMode, getRuntimeSummary } from "@/lib/runtime-mode";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/server";

const requiredTables = [
  "tenants",
  "users_profile",
  "tenant_users",
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
];

const commercialColumns = ["gross_price", "discount_extra", "net_price", "delivery_term_text"];

export async function GET() {
  const runtime = getRuntimeSummary();
  const response = {
    supabaseUrlConfigured: runtime.supabaseUrlConfigured,
    supabaseAnonKeyConfigured: runtime.supabaseAnonKeyConfigured,
    supabaseServiceRoleConfigured: runtime.supabaseServiceRoleConfigured,
    mode: getRuntimeMode(),
    databaseReachable: false,
    tablesOk: false,
    missingTables: [] as string[],
    missingColumns: [] as string[],
  };

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json(response);
  }

  try {
    const supabase = createSupabaseAdminClient();
    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select("id", { count: "exact", head: true });
      if (error) response.missingTables.push(table);
    }

    response.databaseReachable = true;
    response.tablesOk = response.missingTables.length === 0;

    const { error: columnError } = await supabase
      .from("supplier_quote_response_items")
      .select(commercialColumns.join(","))
      .limit(1);

    if (columnError) {
      response.missingColumns.push(
        ...commercialColumns.map((column) => `supplier_quote_response_items.${column}`),
      );
    }
  } catch {
    response.databaseReachable = false;
    response.tablesOk = false;
  }

  return NextResponse.json(response);
}
