import { CompanyRoutePage, getCompanyRouteTitle } from "@/modules/cotacoes/components/dashboard/pages";
import { AppShell } from "@/modules/cotacoes/components/layout/app-shell";
import { requireCompanyAccess } from "@/modules/cotacoes/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CotacoesPage() {
  const auth = await requireCompanyAccess("/cotacoes");
  const slug = ["dashboard"];

  return (
    <AppShell
      mode="app"
      currentPath="/cotacoes"
      title={getCompanyRouteTitle(slug)}
      subtitle={auth.tenantAccess?.tenantName ?? "Painel da empresa"}
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      <CompanyRoutePage
        slug={slug}
        tenantType={auth.tenantAccess?.tenantType}
        tenantId={auth.isSuperAdmin ? undefined : auth.tenantAccess?.tenantId}
        isSuperAdmin={auth.isSuperAdmin}
      />
    </AppShell>
  );
}
