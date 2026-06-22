import { MessageCircle, ShieldCheck } from "lucide-react";
import { AppShell } from "@/modules/cotacoes/components/layout/app-shell";
import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import { Input } from "@/modules/cotacoes/components/ui/input";
import { Label } from "@/modules/cotacoes/components/ui/label";
import {
  saveWhatsappSettingsAction,
  sendWhatsappTestMessageAction,
  testWhatsappConnectionAction,
} from "@/modules/cotacoes/lib/actions/whatsapp-settings";
import { requireSuperAdmin } from "@/modules/cotacoes/lib/auth/session";
import { getWhatsappGlobalConfigForAdmin } from "@/modules/cotacoes/lib/whatsapp/mba-cotacoes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WhatsappMbaCotacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [auth, config, params] = await Promise.all([
    requireSuperAdmin("/cotacoes/configuracoes/whatsapp"),
    getWhatsappGlobalConfigForAdmin(),
    searchParams,
  ]);
  const status = params.status;
  const mensagem = params.mensagem;

  return (
    <AppShell
      mode="admin"
      currentPath="/cotacoes/configuracoes/whatsapp"
      title="WhatsApp MBA Cotações"
      subtitle="Admin Master MBA Labs"
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      <div className="space-y-6">
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-teal-50 text-teal-800 hover:bg-teal-50">Número central</Badge>
                <Badge className="bg-slate-900 text-white hover:bg-slate-900">Somente Admin Master</Badge>
                <Badge variant={config?.ativo ? "default" : "outline"}>{config?.ativo ? "Ativo" : "Inativo"}</Badge>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">Envio automático pelo WhatsApp oficial</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
                Esta área é exclusiva do Admin Master do MBA Labs. Clientes, farmácias e vendedores não acessam API, token, QR Code ou número conectado.
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-teal-50 text-teal-700">
              <MessageCircle className="h-6 w-6" />
            </div>
          </div>
        </div>

        {mensagem ? (
          <div className={`rounded-md border p-3 text-sm ${status === "erro" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {mensagem}
          </div>
        ) : null}

        <Card>
          <CardHeader><CardTitle>WhatsApp MBA Cotações</CardTitle></CardHeader>
          <CardContent>
            <form action={saveWhatsappSettingsAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-2">
                <Label>Provider</Label>
                <select name="provider" defaultValue={config?.provider ?? "evolution_api"} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="evolution_api">Evolution API</option>
                  <option value="zapi">Z-API</option>
                  <option value="meta_cloud_api">Meta Cloud API</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <TextField name="api_url" label="API URL" defaultValue={config?.api_url ?? ""} />
              <TextField name="phone_number_id" label="Phone number ID / Instância" defaultValue={config?.phone_number_id ?? ""} />
              <TextField name="numero_oficial" label="Número oficial" defaultValue={config?.numero_oficial ?? ""} placeholder="5563999999999" />
              <TextField name="nome_exibicao" label="Nome de exibição" defaultValue={config?.nome_exibicao ?? "MBA Cotações"} />
              <TextField name="status_conexao" label="Status da conexão" defaultValue={config?.status_conexao ?? "nao_configurado"} />
              <div className="space-y-2">
                <Label>API token</Label>
                <Input name="api_token" type="password" placeholder={config?.api_token_configurado ? "token configurado — preencha só para trocar" : "cole o token/API key"} />
              </div>
              <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm md:mt-8">
                <input name="ativo" type="checkbox" defaultChecked={config?.ativo ?? true} />
                Ativar envio automático
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3">
                <Button type="submit">Salvar configuração</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Testar conexão</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">Valida se existe configuração mínima para o provedor.</p>
              <form action={testWhatsappConnectionAction}>
                <Button type="submit" variant="outline"><ShieldCheck className="h-4 w-4" />Testar conexão</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Enviar mensagem teste</CardTitle></CardHeader>
            <CardContent>
              <form action={sendWhatsappTestMessageAction} className="space-y-3">
                <TextField name="telefone_teste" label="WhatsApp de teste" placeholder="5563999999999" />
                <div className="space-y-2">
                  <Label>Mensagem</Label>
                  <textarea name="mensagem_teste" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="Mensagem de teste do MBA Cotações." />
                </div>
                <Button type="submit" variant="outline"><MessageCircle className="h-4 w-4" />Enviar mensagem teste</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function TextField({ name, label, defaultValue, placeholder }: { name: string; label: string; defaultValue?: string; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input name={name} defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  );
}
