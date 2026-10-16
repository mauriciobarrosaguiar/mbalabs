import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/modules/cotacoes/components/layout/app-shell";
import { AdminDashboardPage, AdminSectionPage } from "@/modules/cotacoes/components/dashboard/pages";
import { requireSuperAdmin } from "@/modules/cotacoes/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const sections = new Set([
  "dashboard", "farmacias", "usuarios", "planos",
  "mensalidades", "distribuidoras", "representantes",
  "produtos", "configuracoes", "logs",
]);

export default async function CotacoesGestao({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const slug = (await params).slug ?? ["dashboard"];
  const section = slug[0] ?? "dashboard";
  if (section === "empresas") redirect("/cotacoes/gestao/farmacias" + (slug.length > 1 ? "/" + slug.slice(1).join("/") : ""));
  if (section === "pagamentos") redirect("/cotacoes/gestao/mensalidades");
  if (section === "vendedores") redirect("/cotacoes/gestao/representantes");
  if (section === "licitacoes" || section === "infra-whatsapp") redirect("/cotacoes/gestao");
  if (!sections.has(section)) notFound();
  const path = "/cotacoes/gestao" + (slug.length ? "/" + slug.join("/") : "");
  const auth = await requireSuperAdmin(path);

  return (
    <AppShell
      mode="admin"
      currentPath={path}
      title={section === "dashboard" ? "Gestão MBA Cotações" : "MBA Cotações · " + section}
      subtitle="Administração exclusiva do MBA Cotações"
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      {section === "dashboard" ? (
        <AdminDashboardPage />
      ) : (
        <AdminSectionPage section={section} slug={slug} />
      )}
    </AppShell>
  );
}
