import { AppShell } from "@/components/layout/app-shell";
import { AdminDashboardPage } from "@/components/dashboard/pages";
import { requireSuperAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminHomePage() {
  const auth = await requireSuperAdmin("/admin");

  return (
    <AppShell
      mode="admin"
      currentPath="/admin"
      title="Dashboard administrativo"
      subtitle="Painel Administrativo MBA Cotações"
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      <AdminDashboardPage />
    </AppShell>
  );
}
