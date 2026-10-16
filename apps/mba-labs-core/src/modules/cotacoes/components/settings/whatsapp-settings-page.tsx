import Link from "next/link";
import { MessageCircle, ServerCog, ShieldCheck } from "lucide-react";
import { AppShell } from "@/modules/cotacoes/components/layout/app-shell";
import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import { Input } from "@/modules/cotacoes/components/ui/input";
import { Label } from "@/modules/cotacoes/components/ui/label";
import {
  saveWhatsappSettingsAction,
  testWhatsappConnectionAction,
} from "@/modules/cotacoes/lib/actions/whatsapp-settings";
import { requireSuperAdmin } from "@/modules/cotacoes/lib/auth/session";
import { getWhatsappGlobalConfigForAdmin } from "@/modules/cotacoes/lib/whatsapp/mba-cotacoes";

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
  currentPath?: string;
  subtitle?: string;
};

export async function WhatsappMbaCotacoesSettingsPage({
  searchParams,
  currentPath = "/cotacoes/gestao/infra-whatsapp",
  subtitle = "Administração master · infraestrutura compartilhada",
}: Props) {
  const [auth, config, params] = await Promise.all([
    requireSuperAdmin(currentPath),
    getWhatsappGlobalConfigForAdmin(),
    searchParams,
  ]);

  const status = params.status;
  const message = params.mensagem;
  const validated = config?.status_conexao === "infraestrutura_validada";

  return (
    <AppShell
      mode="admin"
      currentPath={currentPath}
      title="Infraestrutura WhatsApp"
      subtitle={subtitle}
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-teal-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Somente administrador master</Badge>
                <Badge variant={validated ? "default" : "outline"}>
                  {validated ? "Servidor e autenticação validados" : "Validação pendente"}
                </Badge>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Configurar Evolution API para todas as farmácias
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                Aqui você configura exclusivamente o endereço e a chave de acesso do servidor.
                Cada cliente conecta seu próprio número por QR Code na sua área.
                Nenhum WhatsApp será conectado ou enviado pelo seu número de administrador.
              </p>
            </div>
            <ServerCog className="h-7 w-7 text-teal-700" />
          </div>
        </div>

        {message ? (
          <div role="status" className={`rounded-md border p-3 text-sm ${status === "erro"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {message}
          </div>
        ) : null}

        <Card className="bg-white text-slate-900">
          <CardHeader><CardTitle>Credenciais da infraestrutura</CardTitle></CardHeader>
          <CardContent>
            <form action={saveWhatsappSettingsAction} className="space-y-4">
              <input type="hidden" name="return_to" value={currentPath} />
              <input type="hidden" name="provider" value="evolution_api" />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Provedor</Label>
                  <Input value="Evolution API" disabled className="bg-slate-50 text-slate-700" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evolution-api-url">URL da Evolution API</Label>
                  <Input id="evolution-api-url" name="api_url" type="url"
                    defaultValue={config?.api_url ?? ""} required
                    placeholder="https://seu-servidor.onrender.com"
                    className="bg-white text-slate-900" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="evolution-api-token">Chave da API (apikey)</Label>
                <Input id="evolution-api-token" name="api_token"
                  type="password" autoComplete="new-password"
                  placeholder={config?.api_token_configurado
                    ? "Chave já configurada — deixe em branco para manter"
                    : "Informe a chave definida em AUTHENTICATION_API_KEY no Render"}
                  className="bg-white text-slate-900" />
                <p className="text-xs leading-5 text-slate-600">
                  {config?.api_token_configurado ? "Existe uma chave salva no servidor. Seu valor não é exibido." : "Nenhuma chave configurada."}
                  {" "}O valor precisa ser o mesmo de AUTHENTICATION_API_KEY no Render.
                  Não compartilhe a chave com clientes e não a envie em conversas.
                </p>
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <input name="ativo" type="checkbox" defaultChecked={config?.ativo ?? true} />
                Ativar infraestrutura para conexão dos WhatsApps das farmácias
              </label>
              <Button type="submit"><ShieldCheck className="h-4 w-4" />Salvar infraestrutura</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-white text-slate-900">
          <CardHeader><CardTitle>Diagnóstico da Evolution API</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-slate-700">
              Depois de salvar, teste a conexão real com a API. O teste verifica a
              autenticação do servidor sem criar instâncias nem enviar mensagens.
            </p>
            <form action={testWhatsappConnectionAction}>
              <input type="hidden" name="return_to" value={currentPath} />
              <Button type="submit" variant="outline">
                <MessageCircle className="h-4 w-4" />Testar servidor e autenticação
              </Button>
            </form>
            <p className="text-xs leading-5 text-slate-600">
              Se aparecer HTTP 401, a chave da API salva aqui não corresponde à chave
              AUTHENTICATION_API_KEY do Render. Corrija essa divergência antes de tentar
              conectar a farmácia. O teste pode demorar enquanto o servidor inicia.
            </p>
            <p className="text-xs text-slate-600">
              Conexões individuais são feitas somente na página WhatsApp próprio, no acesso da farmácia.
              <span className="ml-1"><Link href="/cotacoes/gestao/farmacias" className="underline">Gerenciar farmácias</Link></span>
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
