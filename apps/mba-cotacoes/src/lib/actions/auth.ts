"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";
import {
  getDefaultRouteForContext,
  getProfileByAuthUserId,
} from "@/lib/auth/session";
import { clearPasswordChangeRequirement } from "@/lib/auth/password-change";

export async function signInAction(formData: FormData) {
  const next = normalizeNextPath(String(formData.get("next") ?? ""));
  redirect(getCentralLoginUrl(next || "/app/dashboard"));
}

export async function recoverPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/alterar-senha`,
    });
  }

  redirect("/recuperar-senha?enviado=1");
}

export async function updatePasswordAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      redirect(`/alterar-senha?erro=${encodeURIComponent(error.message)}`);
    }
    if (userData.user) {
      await clearPasswordChangeRequirement(userData.user);
      const profile = await getProfileByAuthUserId(userData.user.id);
      redirect(getDefaultRouteForContext({
        isSuperAdmin: profile?.role === "SUPER_ADMIN" && profile.status === "ativo",
        tenantAccess: null,
      }));
    }
  }

  redirect(getCentralLoginUrl("/app/dashboard"));
}

export async function signOutAction() {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect(getCentralLoginUrl("/app/dashboard"));
}

function normalizeNextPath(value: string) {
  if (!value.startsWith("/")) return "";
  if (value.startsWith("//")) return "";
  return value;
}

function getCentralLoginUrl(nextPath: string) {
  const coreUrl = process.env.NEXT_PUBLIC_CORE_URL;

  if (coreUrl) {
    const url = new URL("/login", coreUrl);
    url.searchParams.set("next", "/cotacoes");
    return url.toString();
  }

  return `/login?next=${encodeURIComponent(nextPath)}`;
}
