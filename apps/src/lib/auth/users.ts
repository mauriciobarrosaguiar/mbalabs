import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/lib/supabase/server";
import type { CustomerType, UserRole } from "@/lib/types";

export type ManagedUser = {
  id: string;
  authUserId: string | null;
  fullName: string;
  email: string;
  role: UserRole;
  status: "ativo" | "inativo" | "convidado";
  mustChangePassword: boolean;
  tenantLinks: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    tenantType: CustomerType;
    role: string;
    status: string;
  }>;
};

export type TenantOption = {
  id: string;
  name: string;
  type: CustomerType;
};

export async function listManagedUsers(): Promise<ManagedUser[]> {
  if (!hasSupabaseAdminConfig()) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users_profile")
    .select(
      "id, auth_user_id, full_name, email, role, status, must_change_password, tenant_users(id, tenant_id, role, status, tenants(id, nome_fantasia, tipo_cliente))",
    )
    .order("full_name", { ascending: true });

  if (error || !data) {
    console.error("Erro ao listar usuarios:", error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    authUserId: row.auth_user_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    mustChangePassword: Boolean(row.must_change_password),
    tenantLinks: (row.tenant_users ?? []).map((link) => {
      const tenant = Array.isArray(link.tenants) ? link.tenants[0] : link.tenants;
      return {
        id: link.id,
        tenantId: link.tenant_id,
        tenantName: tenant?.nome_fantasia ?? "Sem empresa",
        tenantType: tenant?.tipo_cliente ?? "both",
        role: link.role,
        status: link.status,
      };
    }),
  }));
}

export async function listTenantOptions(): Promise<TenantOption[]> {
  if (!hasSupabaseAdminConfig()) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("id, nome_fantasia, tipo_cliente")
    .order("nome_fantasia", { ascending: true });

  if (error || !data) {
    console.error("Erro ao listar empresas para usuarios:", error);
    return [];
  }

  return data.map((tenant) => ({
    id: tenant.id,
    name: tenant.nome_fantasia,
    type: tenant.tipo_cliente,
  }));
}
