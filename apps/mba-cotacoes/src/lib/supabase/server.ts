import { cookies } from "next/headers";
import { createSupabaseServerClient as createSharedSupabaseServerClient } from "@mba-labs/shared/supabase/server";
import { hasSupabaseEnv } from "./env";

export { createSupabaseAdminClient, hasSupabaseAdminConfig } from "./admin";

export function hasSupabaseConfig() {
  return hasSupabaseEnv();
}

export async function createSupabaseServerClient(): Promise<any> {
  if (!hasSupabaseConfig()) {
    throw new Error(
      "Supabase nao configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createSharedSupabaseServerClient((await cookies()) as any) as any;
}
