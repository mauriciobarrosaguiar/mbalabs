import { AppShell } from "@/components/layout/app-shell";
import { AdminSectionPage, getAdminRouteTitle } from "@/components/dashboard/pages";
import { requireSuperAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminCatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const section = slug[0] ?? "dashboard";
  const path = `/admin/${slug.join("/")}`;
  const auth = await requireSuperAdmin(path);

  return (
    <AppShell
      mode="admin"
      currentPath={path}
      title={getAdminRouteTitle(section)}
      subtitle="Painel Administrativo MBA Cotações"
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      <AdminSectionPage slug={slug} />
    </AppShell>
  );
}
