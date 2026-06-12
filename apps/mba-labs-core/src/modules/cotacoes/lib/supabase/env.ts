import {
  getRuntimeLabel,
  getRuntimeMode,
  isLocalEnvironment,
  isSupabaseConfigured,
} from "@/modules/cotacoes/lib/runtime-mode";

export type SupabaseClientMode = "supabase" | "demo" | "missing_config";
export type RuntimeEnvironment = "local" | "vercel" | "production";

export function hasSupabaseEnv() {
  return isSupabaseConfigured();
}

export function hasSupabaseServiceRoleEnv() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseClientMode(): SupabaseClientMode {
  return getRuntimeMode();
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") return "vercel";
  return isLocalEnvironment() ? "local" : "production";
}

export function getDemoModeLabel() {
  return getRuntimeLabel();
}
