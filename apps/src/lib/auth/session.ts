import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getRuntimeMode } from "@/lib/runtime-mode";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseAdminConfig,
  hasSupabaseConfig,
} from "@/lib/supabase/server";
import { userMustChangePassword } from "@/lib/auth/password-change";
import type { CustomerType, TenantStatus, UserRole } from "@/lib/types";

export type AuthProfile = {
  id: string;
  authUserId: string | null;
  fullName: string;
  email: string;
  role: UserRole;
  status: "ativo" | "inativo" | "convidado";
  mustChangePassword: boolean;
};

export type TenantAccess = {
  id: string;
  tenantId: string;
  role: Exclude<UserRole, "SUPER_ADMIN" | "VENDEDOR_EXTERNO">;
  status: "ativo" | "inativo" | "convidado";
  tenantName: string;
  tenantType: CustomerType;
  tenantStatus: TenantStatus | "suspended" | "canceled" | "cancelado";
};

export type AuthContext = {
  user: User | null;
  profile: AuthProfile | null;
  tenantAccess: TenantAccess | null;
  isAuthenticated: boolean;
  isActive: boolean;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
};

const inactiveProfileMessage = "Usuário sem perfil ativo. Procure o administrador.";
const suspendedTenantStatuses = new Set(["suspended", "suspenso", "canceled", "cancelado", "inactive", "inativo"]);

export async function getCurrentAuthContext(): Promise<AuthContext> {
  if (!hasSupabaseConfig()) {
    return getDemoAuthContext();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return emptyAuthContext();
  }

  const profile = await getProfileByAuthUserId(data.user.id);
  const tenantAccess = profile ? await getPrimaryTenantAccess(profile.id) : null;
  const mustChangePassword = profile
    ? profile.mustChangePassword || (await userMustChangePassword(data.user))
    : false;

  return {
    user: data.user,
    profile,
    tenantAccess,
    isAuthenticated: true,
    isActive: profile?.status === "ativo",
    isSuperAdmin: profile?.status === "ativo" && profile.role === "SUPER_ADMIN",
    mustChangePassword,
  };
}

export async function requireActiveProfile(currentPath = "/app/dashboard") {
  const context = await getCurrentAuthContext();

  if (!context.isAuthenticated) {
    redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  }

  if (!context.profile || !context.isActive) {
    redirect(`/sair?erro=${encodeURIComponent(inactiveProfileMessage)}`);
  }

  if (context.mustChangePassword) {
    redirect("/alterar-senha?obrigatorio=1");
  }

  return context as AuthContext & { profile: AuthProfile };
}

export async function requireCompanyAccess(currentPath = "/app/dashboard") {
  const context = await requireActiveProfile(currentPath);

  if (context.isSuperAdmin) {
    return context;
  }

  if (!context.tenantAccess) {
    redirect("/app/sem-permissao");
  }

  if (isTenantSuspended(context.tenantAccess.tenantStatus)) {
    redirect("/app/acesso-suspenso");
  }

  return context as AuthContext & { profile: AuthProfile; tenantAccess: TenantAccess };
}

export async function requireSuperAdmin(currentPath = "/admin") {
  const context = await requireActiveProfile(currentPath);

  if (!context.isSuperAdmin) {
    redirect(getDefaultRouteForContext(context));
  }

  return context as AuthContext & { profile: AuthProfile };
}

export function getDefaultRouteForContext(context: Pick<AuthContext, "isSuperAdmin" | "tenantAccess">) {
  if (context.isSuperAdmin) return "/admin";
  return "/app/dashboard";
}

export function isTenantSuspended(status?: string | null) {
  return suspendedTenantStatuses.has(String(status ?? "").toLowerCase());
}

export function canAccessModule(
  tenantType: CustomerType | undefined,
  moduleType: "pharmacy" | "bidding",
) {
  if (!tenantType || tenantType === "both") return true;
  if (moduleType === "pharmacy") return tenantType === "pharmacy";
  return tenantType === "distributor_bidding";
}

export async function getProfileByAuthUserId(authUserId: string): Promise<AuthProfile | null> {
  const client = hasSupabaseAdminConfig()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  const { data, error } = await client
    .from("users_profile")
    .select("id, auth_user_id, full_name, email, role, status, must_change_password")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    fullName: data.full_name,
    email: data.email,
    role: data.role,
    status: data.status,
    mustChangePassword: Boolean(data.must_change_password),
  };
}

export async function getPrimaryTenantAccess(userProfileId: string): Promise<TenantAccess | null> {
  const client = hasSupabaseAdminConfig()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  const { data, error } = await client
    .from("tenant_users")
    .select("id, tenant_id, role, status, tenants(id, nome_fantasia, tipo_cliente, status)")
    .eq("user_profile_id", userProfileId)
    .eq("status", "ativo")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const tenant = Array.isArray(data.tenants) ? data.tenants[0] : data.tenants;

  return {
    id: data.id,
    tenantId: data.tenant_id,
    role: data.role,
    status: data.status,
    tenantName: tenant?.nome_fantasia ?? "Empresa",
    tenantType: tenant?.tipo_cliente ?? "both",
    tenantStatus: tenant?.status ?? "ativo",
  };
}

function emptyAuthContext(): AuthContext {
  return {
    user: null,
    profile: null,
    tenantAccess: null,
    isAuthenticated: false,
    isActive: false,
    isSuperAdmin: false,
    mustChangePassword: false,
  };
}

function getDemoAuthContext(): AuthContext {
  const isDemo = getRuntimeMode() === "demo";

  return {
    user: null,
    profile: isDemo
      ? {
          id: "demo-super-admin",
          authUserId: null,
          fullName: "Admin local",
          email: "admin.local@mbacotacoes.local",
          role: "SUPER_ADMIN",
          status: "ativo",
          mustChangePassword: false,
        }
      : null,
    tenantAccess: isDemo
      ? {
          id: "demo-tenant-access",
          tenantId: "tenant-demo",
          role: "ADMIN_EMPRESA",
          status: "ativo",
          tenantName: "Empresa local",
          tenantType: "both",
          tenantStatus: "ativo",
        }
      : null,
    isAuthenticated: isDemo,
    isActive: isDemo,
    isSuperAdmin: isDemo,
    mustChangePassword: false,
  };
}
