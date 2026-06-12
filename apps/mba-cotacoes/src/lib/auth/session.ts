import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  getCurrentUserProfileFromSupabase,
  type SharedCoreProfile,
  type SharedCurrentUserProfile,
} from "@mba-labs/shared/auth/profile";
import { getRuntimeMode } from "@/lib/runtime-mode";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  hasSupabaseAdminConfig,
  hasSupabaseConfig,
} from "@/lib/supabase/server";
import type { CustomerType, TenantStatus, UserRole } from "@/lib/types";

type CoreAuthContext = SharedCurrentUserProfile & {
  authUser: User;
  usuario: SharedCoreProfile;
};

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
  canAccessApp: boolean;
};

const appSlug = process.env.NEXT_PUBLIC_APP_SLUG || "mba-cotacoes";
const inactiveProfileMessage = "Usuario sem perfil ativo. Procure o administrador.";
const suspendedTenantStatuses = new Set(["suspended", "suspenso", "canceled", "cancelado", "inactive", "inativo", "bloqueada"]);

export async function getCurrentAuthContext(): Promise<AuthContext> {
  if (!hasSupabaseConfig()) {
    return getDemoAuthContext();
  }

  const supabase = await createSupabaseServerClient();
  const current = await getCurrentUserProfileFromSupabase(supabase as any);

  if (!current.authUser || !current.usuario) {
    return emptyAuthContext();
  }

  return ensureCotacoesAuthContext(current as CoreAuthContext);
}

export async function requireActiveProfile(currentPath = "/app/dashboard") {
  const context = await getCurrentAuthContext();

  if (!context.isAuthenticated) {
    redirect(getCentralLoginUrl(currentPath));
  }

  if (!context.profile || !context.isActive) {
    redirect(`/sair?erro=${encodeURIComponent(inactiveProfileMessage)}`);
  }

  return context as AuthContext & { profile: AuthProfile };
}

export async function requireCompanyAccess(currentPath = "/app/dashboard") {
  const context = await requireActiveProfile(currentPath);

  if (context.profile.role === "VENDEDOR_EXTERNO") {
    redirect("/app/sem-permissao");
  }

  if (!context.canAccessApp) {
    redirect("/app/sem-permissao");
  }

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

  const { data, error } = await (client as any)
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

  const { data, error } = await (client as any)
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

async function ensureCotacoesAuthContext(current: CoreAuthContext): Promise<AuthContext> {
  const role = mapCoreRole(current.usuario.tipo);
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isVendor = current.usuario.tipo === "vendedor";
  const canAccessApp = canAccessCotacoesApp(current);
  const status: "ativo" | "inativo" = "ativo";

  let profileId = current.usuario.id;
  let tenantAccess: TenantAccess | null = null;

  if (hasSupabaseAdminConfig()) {
    try {
      const admin = createSupabaseAdminClient() as any;
      const tenant = await ensureTenantBridge(admin, current);
      const profile = await ensureUserProfileBridge(admin, current, role, status);
      profileId = profile.id;

      if (!isSuperAdmin && tenant) {
        const tenantUser = await ensureTenantUserBridge(admin, tenant.id, profile.id, mapTenantUserRole(role));
        tenantAccess = {
          id: tenantUser.id,
          tenantId: tenant.id,
          role: tenantUser.role,
          status: tenantUser.status,
          tenantName: tenant.nome_fantasia,
          tenantType: tenant.tipo_cliente,
          tenantStatus: tenant.status,
        };
      } else if (tenant) {
        tenantAccess = {
          id: tenant.id,
          tenantId: tenant.id,
          role: "ADMIN_EMPRESA",
          status: "ativo",
          tenantName: tenant.nome_fantasia,
          tenantType: tenant.tipo_cliente,
          tenantStatus: tenant.status,
        };
      }
    } catch (error) {
      console.error("[MBA Cotacoes] Falha ao sincronizar contexto core -> modulo.", error);
    }
  }

  return {
    user: toSupabaseUser(current),
    profile: {
      id: profileId,
      authUserId: current.authUser.id,
      fullName: current.usuario.nome,
      email: current.usuario.email,
      role: isVendor ? "VENDEDOR_EXTERNO" : role,
      status,
      mustChangePassword: false,
    },
    tenantAccess,
    isAuthenticated: true,
    isActive: status === "ativo",
    isSuperAdmin,
    mustChangePassword: false,
    canAccessApp,
  };
}

async function ensureTenantBridge(admin: any, current: CoreAuthContext) {
  if (!current.empresaId) {
    return null;
  }

  const { data: empresa } = await admin
    .from("core_empresas")
    .select("id,nome,nome_fantasia,cnpj,telefone,email,cidade,estado,status")
    .eq("id", current.empresaId)
    .maybeSingle();

  const company = empresa ?? {
    id: current.empresaId,
    nome: current.empresa?.nome ?? "Empresa",
    nome_fantasia: current.empresa?.nome ?? "Empresa",
    cnpj: null,
    telefone: null,
    email: current.usuario.email,
    cidade: null,
    estado: null,
    status: current.empresa?.status ?? "ativa",
  };

  const { data: existingByCore } = await admin
    .from("tenants")
    .select("*")
    .eq("core_empresa_id", current.empresaId)
    .maybeSingle();
  if (existingByCore) return existingByCore;

  const cnpj = company.cnpj || `CORE-${current.empresaId}`;
  const { data: existingByCnpj } = await admin
    .from("tenants")
    .select("*")
    .eq("cnpj", cnpj)
    .maybeSingle();
  if (existingByCnpj) {
    const { data } = await admin
      .from("tenants")
      .update({ core_empresa_id: current.empresaId })
      .eq("id", existingByCnpj.id)
      .select("*")
      .single();
    return data ?? existingByCnpj;
  }

  const { data: tenant, error } = await admin
    .from("tenants")
    .insert({
      core_empresa_id: current.empresaId,
      nome_fantasia: company.nome_fantasia || company.nome || "Empresa",
      razao_social: company.nome || company.nome_fantasia || "Empresa",
      cnpj,
      tipo_cliente: "both",
      responsavel_nome: current.usuario.nome,
      responsavel_email: company.email || current.usuario.email,
      responsavel_whatsapp: company.telefone || "",
      status: mapCompanyStatus(company.status),
      valor_mensal: 0,
    })
    .select("*")
    .single();
  if (error) throw error;

  await ensureDefaultPharmacy(admin, tenant, company);
  return tenant;
}

async function ensureDefaultPharmacy(admin: any, tenant: any, company: any) {
  const { data: existing } = await admin
    .from("pharmacies")
    .select("id")
    .eq("tenant_id", tenant.id)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  await admin.from("pharmacies").insert({
    tenant_id: tenant.id,
    nome_fantasia: tenant.nome_fantasia,
    razao_social: tenant.razao_social,
    cnpj: tenant.cnpj,
    cidade: company.cidade || "",
    uf: company.estado || "",
    responsavel: tenant.responsavel_nome,
    whatsapp: tenant.responsavel_whatsapp,
    email: tenant.responsavel_email,
    status: "ativo",
  });
}

async function ensureUserProfileBridge(
  admin: any,
  current: CoreAuthContext,
  role: Exclude<UserRole, "VENDEDOR_EXTERNO">,
  status: "ativo" | "inativo",
) {
  const { data: existingByCore } = await admin
    .from("users_profile")
    .select("*")
    .eq("core_usuario_id", current.usuario.id)
    .maybeSingle();
  if (existingByCore) {
    const { data } = await admin
      .from("users_profile")
      .update({
        auth_user_id: current.authUser.id,
        full_name: current.usuario.nome,
        email: current.usuario.email,
        role,
        status,
      })
      .eq("id", existingByCore.id)
      .select("*")
      .single();
    return data ?? existingByCore;
  }

  const { data: existingByAuth } = await admin
    .from("users_profile")
    .select("*")
    .eq("auth_user_id", current.authUser.id)
    .maybeSingle();
  if (existingByAuth) {
    const { data } = await admin
      .from("users_profile")
      .update({ core_usuario_id: current.usuario.id, role, status })
      .eq("id", existingByAuth.id)
      .select("*")
      .single();
    return data ?? existingByAuth;
  }

  const { data, error } = await admin
    .from("users_profile")
    .insert({
      core_usuario_id: current.usuario.id,
      auth_user_id: current.authUser.id,
      full_name: current.usuario.nome,
      email: current.usuario.email,
      role,
      status,
      must_change_password: false,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function ensureTenantUserBridge(
  admin: any,
  tenantId: string,
  userProfileId: string,
  role: Exclude<UserRole, "SUPER_ADMIN" | "VENDEDOR_EXTERNO">,
) {
  const { data: existing } = await admin
    .from("tenant_users")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("user_profile_id", userProfileId)
    .maybeSingle();
  if (existing) {
    const { data } = await admin
      .from("tenant_users")
      .update({ role, status: "ativo" })
      .eq("id", existing.id)
      .select("*")
      .single();
    return data ?? existing;
  }

  const { data, error } = await admin
    .from("tenant_users")
    .insert({
      tenant_id: tenantId,
      user_profile_id: userProfileId,
      role,
      status: "ativo",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

function canAccessCotacoesApp(current: CoreAuthContext) {
  return (
    current.isAdminMaster ||
    current.appsLiberados.some((app) => app.slug === appSlug && app.canAccess)
  );
}

function toSupabaseUser(current: CoreAuthContext) {
  return {
    id: current.authUser.id,
    email: current.authUser.email ?? current.usuario.email,
    app_metadata: current.authUser.app_metadata ?? {},
    user_metadata: current.authUser.user_metadata ?? {},
    aud: current.authUser.aud ?? "authenticated",
    created_at: current.authUser.created_at ?? "",
  } as User;
}

function mapCoreRole(tipo: string): Exclude<UserRole, "VENDEDOR_EXTERNO"> {
  if (tipo === "admin_master") return "SUPER_ADMIN";
  if (tipo === "admin_empresa") return "ADMIN_EMPRESA";
  if (tipo === "funcionario") return "CONFERENTE";
  return "COMPRADOR";
}

function mapTenantUserRole(role: Exclude<UserRole, "VENDEDOR_EXTERNO">): Exclude<UserRole, "SUPER_ADMIN" | "VENDEDOR_EXTERNO"> {
  if (role === "SUPER_ADMIN") return "ADMIN_EMPRESA";
  return role;
}

function mapCompanyStatus(status?: string | null): TenantStatus {
  if (status === "bloqueada") return "suspenso";
  if (status === "inativa") return "cancelado";
  return "ativo";
}

function getCentralLoginUrl(nextPath: string) {
  const safeNext = normalizeNextPath(nextPath);
  const coreUrl = process.env.NEXT_PUBLIC_CORE_URL;

  if (coreUrl) {
    const url = new URL("/login", coreUrl);
    url.searchParams.set("next", toCoreNextPath(safeNext));
    return url.toString();
  }

  return `/login?next=${encodeURIComponent(safeNext)}`;
}

function toCoreNextPath(_appPath: string) {
  return "/cotacoes";
}

function normalizeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return "/app/dashboard";
  return value;
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
    canAccessApp: false,
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
    canAccessApp: isDemo,
  };
}
