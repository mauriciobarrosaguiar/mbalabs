import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@mba-labs/shared/supabase/server";

export async function getSupabaseServer() {
  return createSupabaseServerClient((await cookies()) as any);
}
