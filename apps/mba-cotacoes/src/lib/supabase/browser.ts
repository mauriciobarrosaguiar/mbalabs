"use client";

import { createSupabaseClient } from "@mba-labs/shared/supabase/client";

export function createSupabaseBrowserClient() {
  return createSupabaseClient();
}
