import Link from "next/link";
import { MessageCircle, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/modules/cotacoes/components/layout/app-shell";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import { requireCompanyAccess } from "@/modules/cotacoes/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CotacoesConfiguracoesPage() {
  const auth = await requireCompanyAccess("/cotacoes/configuracoes");

  return (
    <AppShell
      mode="app"
      currentPath="/cotacoes/configuracoes"
      title="Configurações"
      subtitle="MBA Labs"
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Configurações da empresa</h2>
          <p className="mt-2 text-sm text-muted-foreground">Preferências, integrações e permissões operacionais do MBA Cotações.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Perfil e tenant</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Os acessos, papéis e vínculos com farmácia, licitação ou distribuidora são definidos pelo administrador em Usuários.</p>
              <Button asChild variant="outline"><Link href="/cotacoes/usuarios">Ver usuários</Link></Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Segurança</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>RLS por tenant habilitado nas migrations.</p>
              <p>Links públicos têm token, validade e escopo por fornecedor.</p>
              <p>Credenciais ficam protegidas no servidor.</p>
            </CardContent>
          </Card>
          <Card className="border-teal-200 bg-teal-50/50">
            <CardHeader><CardTitle className="flex items-center gap-2 text-teal-900"><MessageCircle className="h-5 w-5" />WhatsApp MBA</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-teal-900">
              <p>Configure o número central oficial do MBA Cotações para enviar links aos vendedores automaticamente.</p>
              <Button asChild><Link href="/cotacoes/configuracoes/whatsapp">Abrir WhatsApp MBA</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
