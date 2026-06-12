"use server";

import { redirect } from "next/navigation";
import { isMissingProductionConfig } from "@/lib/runtime-mode";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";
import {
  getDefaultRouteForContext,
  getProfileByAuthUserId,
} from "@/lib/auth/session";
import {
  clearPasswordChangeRequirement,
  userMustChangePassword,
} from "@/lib/auth/password-change";

const inactiveProfileMessage = "Usuário sem perfil ativo. Procure o administrador.";

export async function signInAction(formData: FormData) {
  if (!hasSupabaseConfig()) {
    if (isMissingProductionConfig()) {
      redirect("/app/configuracoes/supabase");
    }
    redirect("/app/dashboard");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = normalizeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?erro=${encodeURIComponent(error.message)}`);
  }

  const user = data.user;
  const profile = user ? await getProfileByAuthUserId(user.id) : null;

  if (!user || !profile || profile.status !== "ativo") {
    await supabase.auth.signOut();
    redirect(`/login?erro=${encodeURIComponent(inactiveProfileMessage)}`);
  }

  if (await userMustChangePassword(user)) {
    redirect("/alterar-senha?obrigatorio=1");
  }

  if (profile.role === "SUPER_ADMIN") {
    redirect("/admin");
  }

  redirect(next && !next.startsWith("/admin") ? next : "/app/dashboard");
}

export async function recoverPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/alterar-senha`,
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

  redirect("/login?senha=alterada");
}

export async function signOutAction() {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}

function normalizeNextPath(value: string) {
  if (!value.startsWith("/")) return "";
  if (value.startsWith("//")) return "";
  return value;
}
