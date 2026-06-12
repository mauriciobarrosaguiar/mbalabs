import { CompanyRoutePage, getCompanyRouteTitle } from "@/modules/cotacoes/components/dashboard/pages";
import { AppShell } from "@/modules/cotacoes/components/layout/app-shell";
import {
  canAccessModule,
  requireActiveProfile,
  requireCompanyAccess,
} from "@/modules/cotacoes/lib/auth/session";
import type { CustomerType } from "@/modules/cotacoes/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CotacoesCatchAllPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug: rawSlug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const slug = normalizeCotacoesSlug(rawSlug);
  const path = `/cotacoes/${rawSlug.join("/")}`;
  const [section, id] = slug;
  const isSystemStatusPage = section === "acesso-suspenso" || section === "sem-permissao";
  const auth = isSystemStatusPage
    ? await requireActiveProfile(path)
    : await requireCompanyAccess(path);
  const moduleType = getRouteModule(section);
  const blockedByTenant =
    Boolean(auth && !auth.isSuperAdmin && moduleType) &&
    !canAccessModule(auth.tenantAccess?.tenantType, moduleType!);
  const effectiveSlug = blockedByTenant ? ["sem-permissao"] : slug;

  return (
    <AppShell
      mode="app"
      currentPath={path}
      title={getCompanyRouteTitle(effectiveSlug)}
      subtitle={auth.tenantAccess?.tenantName ?? "Painel da empresa"}
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      <CompanyRoutePage
        slug={effectiveSlug}
        tenantType={auth.tenantAccess?.tenantType}
        searchParams={resolvedSearchParams}
      />
    </AppShell>
  );
}

function normalizeCotacoesSlug(slug: string[]) {
  const [section, ...rest] = slug;
  const aliases: Record<string, string[]> = {
    nova: ["cotacoes-farmacia", "nova"],
    vendedores: ["fornecedores"],
    pedidos: ["pedidos-gerados"],
    ganhadores: ["pedidos-gerados"],
    "pedidos-vencedores": ["pedidos-gerados"],
    abertas: ["cotacoes-farmacia"],
    finalizadas: ["cotacoes-farmacia"],
  };

  if (aliases[section]) return [...aliases[section], ...rest];
  return slug.length > 0 ? slug : ["dashboard"];
}

function getRouteModule(section?: string): "pharmacy" | "bidding" | null {
  if (section === "cotacoes-farmacia" || section === "historico-compras") return "pharmacy";
  if (
    section === "licitacoes" ||
    section === "mapa-comparativo" ||
    section === "analise-unidade" ||
    section === "historico-precos"
  ) {
    return "bidding";
  }
  return null;
}
