export type RuntimeLabel = "Modo demo local" | "Supabase não configurado" | null;
export type RuntimeMode = "demo" | "supabase" | "missing_config";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isSupabaseWriteConfigured() {
  return Boolean(isSupabaseConfigured() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isLocalEnvironment() {
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

export function shouldUseDemoData() {
  return !isSupabaseConfigured() && isLocalEnvironment();
}

export function isDemoMode() {
  return getRuntimeMode() === "demo";
}

export function isMissingProductionConfig() {
  return getRuntimeMode() === "missing_config";
}

export function getRuntimeMode(): RuntimeMode {
  if (isSupabaseConfigured()) return "supabase";
  return shouldUseDemoData() ? "demo" : "missing_config";
}

export function getRuntimeLabel(): RuntimeLabel {
  const mode = getRuntimeMode();
  if (mode === "supabase") return null;
  if (mode === "demo") return "Modo demo local";
  return "Supabase não configurado";
}

export function getRuntimeSummary() {
  const mode = getRuntimeMode();

  return {
    mode,
    isDemo: mode === "demo",
    useDemoData: mode === "demo",
    missingProductionConfig: mode === "missing_config",
    isLocal: isLocalEnvironment(),
    label: getRuntimeLabel(),
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKeyConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
