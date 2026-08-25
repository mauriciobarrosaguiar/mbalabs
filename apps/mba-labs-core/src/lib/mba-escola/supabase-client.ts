"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseClient } from "@mba-labs/shared/supabase/client";

/**
 * MBA Escola usa o mesmo projeto Supabase e a mesma sessão Auth da MBA Labs.
 * Mantemos este wrapper apenas para evitar espalhar detalhes de infraestrutura
 * pelos componentes do módulo escolar.
 */
export function getMbaEscolaSupabase(): SupabaseClient {
  return createSupabaseClient() as unknown as SupabaseClient;
}
