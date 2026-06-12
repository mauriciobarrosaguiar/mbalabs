import { getSupabaseServer } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { hasSupabaseEnv } from "./env";

export { createSupabaseAdminClient, hasSupabaseAdminConfig } from "./admin";

export function hasSupabaseConfig() {
  return hasSupabaseEnv();
}

export async function createSupabaseServerClient() {
  return (await getSupabaseServer()) as any;
}

export function createSupabaseServiceClient() {
  return getSupabaseAdmin() as any;
}
