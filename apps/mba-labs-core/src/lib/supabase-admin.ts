import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export function getSupabaseAdmin() {
  return createSupabaseAdminClient();
}
