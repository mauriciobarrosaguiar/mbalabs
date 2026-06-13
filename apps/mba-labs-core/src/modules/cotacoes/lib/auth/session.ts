import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSessionProfile, requireAppAccess, type CurrentUserProfile } from "@/lib/core-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { CustomerType, TenantStatus, UserRole } from "@/modules/cotacoes/lib/types";

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

const suspendedTenantStatuses = new Set(["suspended", "suspenso", "canceled", "cancelado", "inactive", "inativo", "bloqueada"]);

export async function getCurrentAuthContext(): Promise<AuthContext> {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) return emptyAuthContext();

  const current = toCurrentUserProfile(session);
  return ensureCotacoesAuthContext(current);
}

export async function requireActiveProfile(currentPath = "/cotacoes") {
  const current = await requireAppAccess("mba-cotacoes", normalizeCotacoesPath(currentPath));
  const context = await ensureCotacoesAuthContext(current);

  if (!context.profile || !context.isActive) {
    redirect("/acesso-bloqueado?motivo=usuario");
  }

  return context as AuthContext & { profile: AuthProfile };
}

export async function requireCompanyAccess(currentPath = "/cotacoes") {
  const context = await requireActiveProfile(currentPath);

  if (context.profile.role === "VENDEDOR_EXTERNO") {
    redirect("/acesso-bloqueado?app=mba-cotacoes");
  }

  if (context.isSuperAdmin) return context;

  if (!context.tenantAccess) {
    redirect("/acesso-bloqueado?app=mba-cotacoes");
  }

  if (isTenantSuspended(context.tenantAccess.tenantStatus)) {
    redirect("/acesso-bloqueado?app=mba-cotacoes");
  }

  return context as AuthContext & { profile: AuthProfile; tenantAccess: TenantAccess };
}

export async function requireSuperAdmin(currentPath = "/cotacoes/admin") {
  const context = await requireActiveProfile(currentPath);
  if (!context.isSuperAdmin) redirect(getDefaultRouteForContext(context));
  return context as AuthContext & { profile: AuthProfile };
}

export function getDefaultRouteForContext(_context: Pick<AuthContext, "isSuperAdmin" | "tenantAccess">) {
  return "/cotacoes";
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
  try {
    const admin = getSupabaseAdmin() as any;
    const { data } = await admin
      .from("users_profile")
      .select("id, auth_user_id, full_name, email, role, status, must_change_password")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      authUserId: data.auth_user_id,
      fullName: data.full_name,
      email: data.email,
      role: data.role,
      status: data.status,
      mustChangePassword: Boolean(data.must_change_password),
    };
  } catch {
    return null;
  }
}

async function ensureCotacoesAuthContext(current: CurrentUserProfile): Promise<AuthContext> {
  const role = mapCoreRole(current.tipo);
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isVendor = current.tipo === "vendedor";
  const status = ((current as CurrentUserProfile & { usuarioStatus?: string }).usuarioStatus ?? "ativo") === "ativo" ? "ativo" : "inativo";

  let profileId = current.usuario.id;
  let tenantAccess: TenantAccess | null = null;

  try {
    const admin = getSupabaseAdmin() as any;
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
    console.error("[MBA Cotações] Falha ao sincronizar contexto core -> módulo.", error);
  }

  return {
    user: {
      id: current.authUser.id,
      email: current.authUser.email ?? current.usuario.email,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "",
    } as User,
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
  };
}

async function ensureTenantBridge(admin: any, current: CurrentUserProfile) {
  const { data: empresa } = await admin
    .from("core_empresas")
    .select("id,nome,nome_fantasia,cnpj,telefone,email,cidade,estado,status")
    .eq("id", current.empresaId)
    .maybeSingle();

  const company = empresa ?? {
    id: current.empresaId,
    nome: "Empresa",
    nome_fantasia: "Empresa",
    cnpj: null,
    telefone: null,
    email: current.usuario.email,
    cidade: null,
    estado: null,
    status: "ativa",
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
  current: CurrentUserProfile,
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

function toCurrentUserProfile(session: Awaited<ReturnType<typeof getSessionProfile>>): CurrentUserProfile {
  return {
    authUser: {
      id: session.user!.id,
      email: session.user!.email,
    },
    usuario: session.profile!,
    empresaId: session.profile!.empresa_id!,
    tipo: session.profile!.tipo,
    usuarioStatus: (session.profile! as { status?: string }).status ?? "ativo",
    isAdminMaster: isSuperAdminType(session.profile!.tipo),
    permissoes: session.permissoes ?? [],
    appsLiberados: session.appsLiberados ?? [],
  } as CurrentUserProfile;
}

function mapCoreRole(tipo: string): Exclude<UserRole, "VENDEDOR_EXTERNO"> {
  if (isSuperAdminType(tipo)) return "SUPER_ADMIN";
  if (tipo === "admin_empresa") return "ADMIN_EMPRESA";
  if (tipo === "operador") return "CONFERENTE";
  if (tipo === "funcionario") return "CONFERENTE";
  return "COMPRADOR";
}

function mapTenantUserRole(role: Exclude<UserRole, "VENDEDOR_EXTERNO">): Exclude<UserRole, "SUPER_ADMIN" | "VENDEDOR_EXTERNO"> {
  if (role === "SUPER_ADMIN") return "ADMIN_EMPRESA";
  return role;
}

function mapCompanyStatus(status?: string | null): TenantStatus {
  if (status === "bloqueada") return "suspenso";
  if (status === "inativa" || status === "cancelada") return "cancelado";
  return "ativo";
}

function isSuperAdminType(tipo: string) {
  return tipo === "super_admin" || tipo === "admin_master";
}

function normalizeCotacoesPath(path: string) {
  if (path.startsWith("/cotacoes/")) return path.replace(/^\/cotacoes/, "/cotacoes");
  if (path === "/cotacoes") return "/cotacoes";
  return path;
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
