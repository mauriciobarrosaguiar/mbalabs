import {
  CompanyRoutePage,
  getCompanyRouteTitle,
} from "@/components/dashboard/pages";
import { AppShell } from "@/components/layout/app-shell";
import { isMissingProductionConfig } from "@/lib/runtime-mode";
import {
  canAccessModule,
  requireActiveProfile,
  requireCompanyAccess,
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompanyCatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const path = `/app/${slug.join("/")}`;
  const [section, id] = slug;
  const allowSupabaseSetup = isMissingProductionConfig() && section === "configuracoes" && id === "supabase";
  const isSystemStatusPage = section === "acesso-suspenso" || section === "sem-permissao";
  const auth = allowSupabaseSetup
    ? null
    : isSystemStatusPage
      ? await requireActiveProfile(path)
      : await requireCompanyAccess(path);
  const moduleType = getRouteModule(section);
  const blockedByTenant =
    Boolean(auth && !auth.isSuperAdmin && moduleType) &&
    !canAccessModule(auth?.tenantAccess?.tenantType, moduleType!);
  const effectiveSlug = blockedByTenant ? ["sem-permissao"] : slug;

  if (section === "cotacoes-farmacia") {
    console.info("[Route] /app/cotacoes-farmacia", {
      moduleType,
      tenantId: auth?.tenantAccess?.tenantId,
      tenantName: auth?.tenantAccess?.tenantName,
      tenantType: auth?.tenantAccess?.tenantType,
      isSuperAdmin: auth?.isSuperAdmin ?? false,
      blockedByTenant,
    });
  }

  return (
    <AppShell
      mode="app"
      currentPath={path}
      title={getCompanyRouteTitle(effectiveSlug)}
      subtitle={auth?.tenantAccess?.tenantName ?? "Painel da empresa"}
      profileRole={auth?.profile.role}
      tenantType={auth?.tenantAccess?.tenantType}
      tenantName={auth?.tenantAccess?.tenantName}
    >
      <CompanyRoutePage
        slug={effectiveSlug}
        tenantType={auth?.tenantAccess?.tenantType}
        searchParams={resolvedSearchParams}
      />
    </AppShell>
  );
}

function getRouteModule(section?: string) {
  if (section === "cotacoes-farmacia" || section === "historico-compras") return "pharmacy" as const;
  if (
    section === "licitacoes" ||
    section === "mapa-comparativo" ||
    section === "analise-unidade" ||
    section === "historico-precos"
  ) {
    return "bidding" as const;
  }
  return null;
}
