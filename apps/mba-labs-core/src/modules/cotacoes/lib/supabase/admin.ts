import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export function hasSupabaseAdminConfig() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createSupabaseAdminClient() {
  return getSupabaseAdmin() as any;
}
