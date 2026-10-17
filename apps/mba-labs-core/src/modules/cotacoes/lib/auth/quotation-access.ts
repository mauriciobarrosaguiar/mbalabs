import "server-only";

import { canAccessModule, isTenantSuspended, type AuthContext } from "@/modules/cotacoes/lib/auth/session";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/modules/cotacoes/lib/supabase/server";
import { isQuotationDeleted } from "@/modules/cotacoes/lib/quotation-status";
import type { CustomerType, ModuleType } from "@/modules/cotacoes/lib/types";

type QuotationAccessRow = {
  id: string;
  tenant_id: string;
  module_type: ModuleType;
  status?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
};

export type AccessFailure = {
  ok: false;
  status: 401 | 403 | 404 | 409;
  error: string;
};

export type QuotationAccess = {
  ok: true;
  quotation: QuotationAccessRow;
  tenantId?: string;
};

export function accessErrorResponse(access: AccessFailure) {
  return Response.json({ error: access.error }, { status: access.status });
}

export function ensureCreateQuotationAccess(
  auth: AuthContext,
  moduleType: ModuleType,
  requestedTenantId?: string | null,
): { ok: true; tenantId?: string } | AccessFailure {
  const session = ensureActiveSession(auth);
  if (!session.ok) return session;
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return { ok: false, status: 409, error: "Supabase nao configurado." };
  }

  if (auth.isSuperAdmin) {
    return { ok: false, status: 403, error: "O administrador MBA Labs gerencia farmácias e catálogos, mas não pode operar cotações." };
  }

  if (!auth.tenantAccess) {
    return { ok: false, status: 403, error: "Empresa nao vinculada ao usuario logado." };
  }

  if (!["ADMIN_EMPRESA", "COMPRADOR"].includes(auth.profile?.role ?? "")) {
    return { ok: false, status: 403, error: "Apenas compradores e administradores podem criar cotações." };
  }

  if (!canAccessModule(auth.tenantAccess.tenantType, moduleType)) {
    return { ok: false, status: 403, error: "Modulo nao liberado para esta empresa." };
  }

  return { ok: true, tenantId: auth.tenantAccess.tenantId };
}

export async function ensureQuotationAccess(
  auth: AuthContext,
  quotationId: string,
  select = "id, tenant_id, module_type, status, deleted_at",
  operation: "read" | "manage" = "read",
): Promise<QuotationAccess | AccessFailure> {
  const session = ensureActiveSession(auth);
  if (!session.ok) return session;
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return { ok: false, status: 409, error: "Supabase nao configurado." };
  }

  if (auth.isSuperAdmin) return { ok: false, status: 403, error: "Conta administrativa sem permissão para operar cotações de farmácias." };
  if (operation === "manage" && !["ADMIN_EMPRESA", "COMPRADOR"].includes(auth.profile?.role ?? "")) {
    return { ok: false, status: 403, error: "Apenas compradores e administradores podem alterar cotações e pedidos." };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("quotations")
    .select(select)
    .eq("id", quotationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, status: 404, error: "Cotacao nao encontrada." };

  const quotation = data as QuotationAccessRow;
  if (quotation.deleted_at || isQuotationDeleted(quotation.status)) {
    return { ok: false, status: 404, error: "Cotacao nao encontrada." };
  }
  if (!auth.isSuperAdmin) {
    if (!auth.tenantAccess) {
      return { ok: false, status: 403, error: "Empresa nao vinculada ao usuario logado." };
    }
    if (quotation.tenant_id !== auth.tenantAccess.tenantId) {
      return { ok: false, status: 403, error: "Sem permissao para esta cotacao." };
    }
    if (!canAccessModule(auth.tenantAccess.tenantType, quotation.module_type)) {
      return { ok: false, status: 403, error: "Modulo nao liberado para esta empresa." };
    }
  }

  return {
    ok: true,
    quotation,
    tenantId: auth.isSuperAdmin ? undefined : quotation.tenant_id,
  };
}

export function normalizeModuleType(value: unknown): ModuleType | null {
  return value === "pharmacy" || value === "bidding" ? value : null;
}

export function normalizeCotacoesAccessType(value: unknown): CustomerType {
  if (value === "pharmacy" || value === "distributor_bidding" || value === "both") {
    return value;
  }
  return "both";
}

function ensureActiveSession(auth: AuthContext): { ok: true } | AccessFailure {
  if (!auth.isAuthenticated || !auth.profile || !auth.user) {
    return { ok: false, status: 401, error: "Sessao expirada." };
  }
  if (!auth.isActive) {
    return { ok: false, status: 401, error: "Sessao expirada." };
  }
  if (!auth.isSuperAdmin) {
    if (auth.profile.role === "VENDEDOR_EXTERNO") {
      return { ok: false, status: 403, error: "Representantes devem utilizar seus links de resposta." };
    }
    if (auth.tenantAccess && (auth.tenantAccess.status !== "ativo" || isTenantSuspended(auth.tenantAccess.tenantStatus))) {
      return { ok: false, status: 403, error: "Acesso da empresa suspenso ou vínculo inativo." };
    }
  }
  return { ok: true };
}
