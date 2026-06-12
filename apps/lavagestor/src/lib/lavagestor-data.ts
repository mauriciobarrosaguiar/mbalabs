import { getCurrentUserProfileFromSupabase } from "@mba-labs/shared/auth/profile";
import { getSupabaseServer } from "./supabase";

export async function getLavaGestorContext() {
  try {
    const supabase = await getSupabaseServer();
    const current = await getCurrentUserProfileFromSupabase(supabase);

    if (!current.authUser) {
      return { signedIn: false, profile: null, error: null };
    }

    return {
      signedIn: true,
      profile: current.usuario,
      error: current.error
    };
  } catch (error) {
    return {
      signedIn: false,
      profile: null,
      error: error instanceof Error ? error.message : "Erro ao conectar no Supabase."
    };
  }
}

export async function readLavaGestorRows(table: string, columns: string) {
  const context = await getLavaGestorContext();

  if (!context.signedIn || !context.profile) {
    return { ...context, rows: [] as Array<Record<string, unknown>> };
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any).from(table).select(columns).limit(25);

  return {
    ...context,
    rows: (data ?? []) as Array<Record<string, unknown>>,
    error: error?.message ?? context.error
  };
}
