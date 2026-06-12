import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "./env";

export { createSupabaseAdminClient, hasSupabaseAdminConfig } from "./admin";

export function hasSupabaseConfig() {
  return hasSupabaseEnv();
}

export async function createSupabaseServerClient() {
  if (!hasSupabaseConfig()) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        encode: "tokens-only",
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components não conseguem gravar cookies; Server Actions conseguem.
          }
        },
      },
    },
  );
}
