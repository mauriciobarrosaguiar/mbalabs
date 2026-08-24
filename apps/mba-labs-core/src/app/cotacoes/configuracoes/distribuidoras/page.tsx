import Link from "next/link";
import { ArrowLeft, Building2, Cable, LockKeyhole, ShoppingCart } from "lucide-react";
import { AppShell } from "@/modules/cotacoes/components/layout/app-shell";
import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import { requireCompanyAccess } from "@/modules/cotacoes/lib/auth/session";
import { initialDistributorCatalog } from "@/modules/cotacoes/lib/integrations/distributors/catalog";
import type {
  DistributorConnectionMode,
  DistributorIntegrationStatus,
} from "@/modules/cotacoes/lib/integrations/distributors/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusLabel: Record<DistributorIntegrationStatus, string> = {
  not_configured: "Não configurada",
  homologation: "Homologação",
  active: "Ativa",
  error: "Erro",
};

const connectionLabel: Record<DistributorConnectionMode, string> = {
  to_define: "A definir",
  api: "API",
  edi_van: "EDI / VAN",
  communicator: "Comunicador",
  portal: "Portal",
};

export default async function DistributorIntegrationsPage() {
  const auth = await requireCompanyAccess("/cotacoes/configuracoes/distribuidoras");

  return (
    <AppShell
      mode="app"
      currentPath="/cotacoes/configuracoes"
      title="Integrações de distribuidoras"
      subtitle="MBA Cotações"
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Central de integrações</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Base inicial para consultar preço e estoque em paralelo à cotação dos representantes e, após homologação, transmitir pedidos vencedores diretamente às distribuidoras.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/cotacoes/configuracoes"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
          </Button>
        </div>

        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex gap-3 p-5 text-sm text-amber-950">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Envio real ainda bloqueado</p>
              <p className="mt-1">
                Nesta primeira fase nenhuma credencial é armazenada e nenhum pedido é transmitido. Cada canal será homologado antes de liberar consulta automática ou envio.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          {initialDistributorCatalog.map((distributor) => (
            <Card key={distributor.key}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    {distributor.name}
                  </CardTitle>
                  <Badge variant={distributor.status === "homologation" ? "secondary" : "outline"}>
                    {statusLabel[distributor.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Unidade/CD: {distributor.unitName}</p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Canal preferencial</p>
                    <p className="mt-1 flex items-center gap-2 font-medium"><Cable className="h-4 w-4" />{connectionLabel[distributor.preferredConnectionMode]}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Código do cliente</p>
                    <p className="mt-1 font-medium">{distributor.customerCodeRequired ? "Obrigatório" : "Opcional"}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>Consulta automática</span>
                    <Badge variant="outline">Bloqueada</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Envio de pedido</span>
                    <Badge variant="outline">Bloqueado</Badge>
                  </div>
                </div>

                {distributor.notes ? <p className="text-muted-foreground">{distributor.notes}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Sequência de homologação</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-4">
            <div className="rounded-lg border p-3"><strong>1. Panpharma GO</strong><p className="mt-1 text-muted-foreground">Validar EDI/VAN, consulta e formato de pedido.</p></div>
            <div className="rounded-lg border p-3"><strong>2. Nazária Imperatriz/MA</strong><p className="mt-1 text-muted-foreground">Confirmar canal técnico homologado.</p></div>
            <div className="rounded-lg border p-3"><strong>3. Total TO</strong><p className="mt-1 text-muted-foreground">Validar integração B2B/API/EDI.</p></div>
            <div className="rounded-lg border p-3"><strong>4. Profarma DF</strong><p className="mt-1 text-muted-foreground">Confirmar método atual de integração.</p></div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
