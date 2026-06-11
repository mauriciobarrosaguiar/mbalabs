import { getSupabaseServer } from "./supabase";

export async function getCotacoesContext() {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return { signedIn: false, profile: null, error: null };
    }

    const { data: profile, error } = await supabase
      .from("core_usuarios")
      .select("id,nome,email,tipo,empresa_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    return {
      signedIn: true,
      profile,
      error: error?.message ?? null
    };
  } catch (error) {
    return {
      signedIn: false,
      profile: null,
      error: error instanceof Error ? error.message : "Erro ao conectar no Supabase."
    };
  }
}

export async function readCotacoesRows(table: string, columns: string) {
  const context = await getCotacoesContext();

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
