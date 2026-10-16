import { AppShell } from "@/modules/cotacoes/components/layout/app-shell";
import { TenantWhatsappConnect } from "@/modules/cotacoes/components/settings/tenant-whatsapp-connect";
import { requireCompanyAccess } from "@/modules/cotacoes/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WhatsappEmpresaPage() {
  const auth = await requireCompanyAccess("/cotacoes/configuracoes/whatsapp");
  return (
    <AppShell mode="app" currentPath="/cotacoes/configuracoes/whatsapp"
      title="WhatsApp da minha empresa" subtitle="Configurações · MBA Cotações"
      profileRole={auth.profile.role} tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}>
      {auth.tenantAccess ? (
        <TenantWhatsappConnect canManage={auth.isSuperAdmin || auth.tenantAccess.role === "ADMIN_EMPRESA"} />
      ) : (
        <div className="rounded-lg border bg-white p-5 text-sm">
          Para configurar um WhatsApp de cliente, acesse com o administrador da farmácia correspondente.
          A infraestrutura geral é gerenciada separadamente no Admin MBA Cotações.
        </div>
      )}
    </AppShell>
  );
}
