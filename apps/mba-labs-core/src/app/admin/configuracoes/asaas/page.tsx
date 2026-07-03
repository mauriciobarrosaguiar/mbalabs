import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { MessageBanner, PageHeader } from "@/components/ui-kit";
import { testAsaasConnectionAction } from "@/lib/actions/billing-actions";
import { getCurrentUserProfile } from "@/lib/core-data";
import { getAsaasSettings } from "@/lib/billing/asaas";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AsaasConfigPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const current = await getCurrentUserProfile("/admin/configuracoes/asaas");
  if (!current.isAdminMaster) return null;

  const [settings, query] = await Promise.all([getAsaasSettings(), searchParams]);
  const webhookUrl = getWebhookUrl();

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="Admin Master"
          title="Configuração de Pagamentos Asaas"
          description="Integração central de pagamentos do MBA Labs para todos os sistemas atuais e futuros."
          actions={<Link className="button-secondary" href="/admin/pagamentos">Voltar aos pagamentos</Link>}
        />
        <MessageBanner ok={firstParam(query.ok)} error={firstParam(query.error)} />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="panel grid gap-3 p-5">
            <h2 className="text-xl font-black">Status da integração</h2>
            <p className="text-sm leading-6 text-slate-300">Ambiente: <strong className="text-slate-100">{settings.environment}</strong></p>
            <p className="text-sm leading-6 text-slate-300">API URL: <strong className="text-slate-100 break-all">{settings.apiUrl}</strong></p>
            <p className="text-sm leading-6 text-slate-300">Chave Asaas: <strong className="text-slate-100">{settings.apiKey ? "configurada" : "não configurada"}</strong></p>
            <p className="text-sm leading-6 text-slate-300">Webhook token: <strong className="text-slate-100">{settings.webhookToken ? "configurado" : "não configurado"}</strong></p>
            <p className="text-sm leading-6 text-slate-300">Ativo: <strong className="text-slate-100">{settings.active ? "sim" : "não"}</strong></p>
            <form action={testAsaasConnectionAction}>
              <button className="button-primary" type="submit">Testar conexão</button>
            </form>
          </div>

          <div className="panel grid gap-3 p-5">
            <h2 className="text-xl font-black">Webhook do Asaas</h2>
            <p className="text-sm leading-6 text-slate-300">Cadastre esta URL no painel do Asaas para baixa automática.</p>
            <code className="break-all rounded-[8px] border border-white/10 bg-black/20 p-3 text-sm text-emerald-100">{webhookUrl}</code>
            <p className="text-sm leading-6 text-slate-300">Eventos recomendados: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_DELETED e PAYMENT_REFUNDED.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function getWebhookUrl() {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "https://mbalabs.vercel.app";
  const base = raw.startsWith("http") ? raw : `https://${raw}`;
  return `${base.replace(/\/+$/, "")}/api/webhooks/asaas`;
}
