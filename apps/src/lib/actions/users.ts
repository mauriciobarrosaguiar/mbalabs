"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/auth/session";

const profileRoles = ["SUPER_ADMIN", "ADMIN_EMPRESA", "COMPRADOR", "CONFERENTE", "FINANCEIRO"] as const;
const statuses = ["ativo", "inativo", "convidado"] as const;

type TenantRole = Exclude<(typeof profileRoles)[number], "SUPER_ADMIN">;
type ProfileStatus = (typeof statuses)[number];

export async function createUserAccessAction(formData: FormData) {
  await requireSuperAdmin("/admin/usuarios");

  const fullName = readRequired(formData, "fullName");
  const email = readRequired(formData, "email").toLowerCase();
  const role = readEnum(formData, "role", profileRoles, "COMPRADOR");
  const status = readEnum(formData, "status", statuses, "ativo");
  const tenantId = normalizeOptionalId(String(formData.get("tenantId") ?? ""));
  const temporaryPassword = String(formData.get("temporaryPassword") || "Alterar@123");
  const mustChangePassword = formData.get("mustChangePassword") !== "false";

  const supabase = createSupabaseAdminClient();
  const authUser = await getOrCreateAuthUser({
    email,
    fullName,
    temporaryPassword,
    mustChangePassword,
  });

  const { data: profile, error: profileError } = await supabase
    .from("users_profile")
    .upsert(
      {
        auth_user_id: authUser.id,
        full_name: fullName,
        email,
        role,
        status,
        must_change_password: mustChangePassword,
      },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();

  if (profileError) throw profileError;

  if (role !== "SUPER_ADMIN" && tenantId) {
    await upsertTenantUser(profile.id, tenantId, role, status);
  }

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

export async function updateUserAccessAction(formData: FormData) {
  await requireSuperAdmin("/admin/usuarios");

  const profileId = readRequired(formData, "profileId");
  const role = readEnum(formData, "role", profileRoles, "COMPRADOR");
  const status = readEnum(formData, "status", statuses, "ativo");
  const tenantId = normalizeOptionalId(String(formData.get("tenantId") ?? ""));

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users_profile")
    .update({ role, status })
    .eq("id", profileId);

  if (error) throw error;

  if (role !== "SUPER_ADMIN" && tenantId) {
    await upsertTenantUser(profileId, tenantId, role, status);
  }

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

async function getOrCreateAuthUser({
  email,
  fullName,
  temporaryPassword,
  mustChangePassword,
}: {
  email: string;
  fullName: string;
  temporaryPassword: string;
  mustChangePassword: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const existing = await findUserByEmail(email);

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      password: temporaryPassword,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name: fullName,
        must_change_password: mustChangePassword,
      },
    });

    if (error) throw error;
    return data.user ?? existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      must_change_password: mustChangePassword,
    },
  });

  if (error) throw error;
  if (!data.user) throw new Error("Supabase nao retornou o usuario criado.");
  return data.user;
}

async function findUserByEmail(email: string) {
  const supabase = createSupabaseAdminClient();
  let page = 1;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 100) return null;
    page += 1;
  }

  return null;
}

async function upsertTenantUser(
  userProfileId: string,
  tenantId: string,
  role: TenantRole,
  status: ProfileStatus,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("tenant_users").upsert(
    {
      tenant_id: tenantId,
      user_profile_id: userProfileId,
      role,
      status,
    },
    { onConflict: "tenant_id,user_profile_id" },
  );

  if (error) throw error;
}

function readRequired(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error(`Campo obrigatorio ausente: ${name}`);
  return value;
}

function normalizeOptionalId(value: string) {
  return value && value !== "none" ? value : "";
}

function readEnum<T extends readonly string[]>(
  formData: FormData,
  name: string,
  values: T,
  fallback: T[number],
) {
  const value = String(formData.get(name) ?? fallback);
  return values.includes(value) ? (value as T[number]) : fallback;
}
