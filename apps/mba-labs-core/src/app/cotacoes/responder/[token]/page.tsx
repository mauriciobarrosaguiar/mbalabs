import { VendorResponsePage } from "@/modules/cotacoes/components/public/vendor-pages";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ModuleType } from "@/modules/cotacoes/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicVendorResponsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const moduleType = await inferResponseModuleType(token);
  return <VendorResponsePage token={token} moduleType={moduleType} />;
}

async function inferResponseModuleType(token: string): Promise<ModuleType> {
  try {
    const supabase = getSupabaseAdmin() as any;
    const { data: session } = await supabase
      .from("supplier_quote_sessions")
      .select("quotation_id")
      .eq("public_token", token)
      .maybeSingle();

    if (session?.quotation_id) {
      const { data: quotation } = await supabase
        .from("quotations")
        .select("module_type")
        .eq("id", session.quotation_id)
        .maybeSingle();

      if (quotation?.module_type === "bidding" || quotation?.module_type === "pharmacy") {
        return quotation.module_type;
      }
    }
  } catch {
    // Fallback keeps demo and partially configured local environments usable.
  }

  return token.toLowerCase().includes("licitacao") || token.toLowerCase().includes("bidding")
    ? "bidding"
    : "pharmacy";
}
