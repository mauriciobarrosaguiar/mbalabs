import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseAdminConfig,
  hasSupabaseConfig,
} from "@/lib/supabase/server";

type PasswordChangeState = {
  user: User | null;
  mustChangePassword: boolean;
};

export async function getCurrentPasswordChangeState(): Promise<PasswordChangeState> {
  if (!hasSupabaseConfig()) {
    return { user: null, mustChangePassword: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { user: null, mustChangePassword: false };
  }

  return {
    user: data.user,
    mustChangePassword: await userMustChangePassword(data.user),
  };
}

export async function redirectIfPasswordChangeRequired() {
  const { mustChangePassword } = await getCurrentPasswordChangeState();
  if (mustChangePassword) {
    redirect("/alterar-senha?obrigatorio=1");
  }
}

export async function userMustChangePassword(user: User) {
  const metadataMustChange = isTruthy(user.user_metadata?.must_change_password);
  const profileMustChange = await getProfileMustChangePassword(user.id);
  return metadataMustChange || profileMustChange;
}

export async function clearPasswordChangeRequirement(user: User) {
  const metadata = {
    ...(user.user_metadata ?? {}),
    must_change_password: false,
  };

  if (hasSupabaseAdminConfig()) {
    const admin = createSupabaseAdminClient();
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: metadata,
    });

    if (authError) return authError.message;

    const { error: profileError } = await admin
      .from("users_profile")
      .update({ must_change_password: false })
      .eq("auth_user_id", user.id);

    return profileError?.message ?? null;
  }

  const supabase = await createSupabaseServerClient();
  const { error: authError } = await supabase.auth.updateUser({ data: metadata });
  if (authError) return authError.message;

  const { error: profileError } = await supabase
    .from("users_profile")
    .update({ must_change_password: false })
    .eq("auth_user_id", user.id);

  return profileError?.message ?? null;
}

async function getProfileMustChangePassword(authUserId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("users_profile")
      .select("must_change_password")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error) {
      console.error("Erro ao consultar troca obrigatoria de senha:", error);
      return false;
    }

    return Boolean(data?.must_change_password);
  } catch (error) {
    console.error("Falha ao consultar troca obrigatoria de senha:", error);
    return false;
  }
}

function isTruthy(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}
