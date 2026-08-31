import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleAlert,
  KeyRound,
  Landmark,
  ShieldCheck,
  Webhook
} from "lucide-react";
import { requireElshadayContext, requireElshadayRole } from "@/lib/elshaday";
import { listElshadayPixProviderStatus } from "@/lib/elshaday-payment-providers";
import { saveElshadayPixProviderSettings } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ElshadayPixProvidersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/financeiro/provedores");
  requireElshadayRole(context, ["admin", "tesouraria"]);

  const providers = await listElshadayPixProviderStatus(context.igreja.id);
  const configured = providers.filter((provider) => provider.config).length;
  const active = providers.filter((provider) => provider.config?.ativo).length;
  const ready = providers.filter((provider) => provider.ready).length;
  const errorMessage = readParam(query.erro);
  const ok = readParam(query.ok);

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link
            className="mb-4 inline-flex items-center gap-2 text-sm font-black text-[#176445]"
            href="/elshaday/financeiro"
          >
            <ArrowLeft size={16} /> Voltar ao financeiro
          </Link>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">
            Financeiro
          </p>
          <h1 className="mt-1 text-3xl font-black">Provedores PIX</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            Conecte mais de uma instituição sem misturar credenciais. O sistema mantém um provedor principal
            para novas cobranças e webhooks separados para cada integração.
          </p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <Landmark size={25} />
        </div>
      </header>

      {ok ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          Configuração do provedor salva.
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Provedores disponíveis" value={String(providers.length)} />
        <Kpi label="Configurados na igreja" value={String(configured)} />
        <Kpi label="Operacionais agora" value={String(ready)} hint={String(active) + " marcado(s) como ativo(s)"} />
      </section>

      <section className="flex gap-3 rounded-[24px] border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950">
        <ShieldCheck className="mt-0.5 shrink-0" size={19} />
        <p>
          Chaves privadas, Client Secrets, tokens e certificados <strong>não são gravados no banco</strong>.
          A tela só informa se cada segredo existe no ambiente seguro da aplicação. Aqui ficam apenas
          dados não secretos, como ambiente, apelido e chave PIX quando aplicável.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {providers.map((provider) => (
          <article
            className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm"
            key={provider.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={
                    provider.category === "banco"
                      ? "grid size-11 shrink-0 place-items-center rounded-2xl bg-indigo-100 text-indigo-800"
                      : "grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"
                  }
                >
                  {provider.category === "banco" ? <Building2 size={22} /> : <Landmark size={22} />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black">{provider.name}</h2>
                    {provider.config?.principal ? (
                      <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-800">
                        Principal
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{authLabel(provider.authMode)}</p>
                </div>
              </div>
              <ProviderBadge adapterStatus={provider.adapterStatus} ready={provider.ready} />
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">{provider.notes}</p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Capability label="PIX identificado" ok={provider.supportsIdentifiedPix} />
              <Capability label="PIX estático/reutilizável" ok={provider.supportsStaticPix} />
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                <KeyRound size={17} /> Credenciais seguras
              </div>
              <div className="mt-3 grid gap-2">
                {provider.requiredEnvironment.map((item) => (
                  <Credential key={item.name} name={item.name} configured={item.configured} />
                ))}
                {provider.requiresPixKey ? (
                  <Credential name="Chave PIX do recebedor" configured={provider.pixKeyConfigured} />
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-slate-700">
                <Webhook size={17} /> Webhook
              </div>
              <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs text-slate-600">
                {provider.webhookUrl}
              </code>
            </div>

            <form
              action={saveElshadayPixProviderSettings}
              className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2"
            >
              <input name="provider" type="hidden" value={provider.id} />

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Apelido
                <input
                  className="input"
                  defaultValue={provider.config?.apelido ?? ""}
                  name="apelido"
                  placeholder={"Ex.: " + provider.name + " Igreja"}
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Ambiente
                <select
                  className="input"
                  defaultValue={provider.config?.ambiente ?? "sandbox"}
                  name="ambiente"
                >
                  <option value="sandbox">Sandbox / testes</option>
                  <option value="production">Produção</option>
                </select>
              </label>

              {provider.requiresPixKey ? (
                <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">
                  Chave PIX do recebedor
                  <input
                    className="input"
                    defaultValue={provider.config?.pix_address_key ?? ""}
                    name="pix_address_key"
                    placeholder="E-mail, telefone, CNPJ ou chave aleatória"
                  />
                </label>
              ) : (
                <input name="pix_address_key" type="hidden" value="" />
              )}

              <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 px-4 text-sm font-bold">
                <input
                  className="size-5 accent-emerald-700"
                  defaultChecked={Boolean(provider.config?.ativo)}
                  disabled={provider.adapterStatus !== "operational"}
                  name="ativo"
                  type="checkbox"
                />
                Integração ativa
              </label>

              <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 px-4 text-sm font-bold">
                <input
                  className="size-5 accent-violet-700"
                  defaultChecked={Boolean(provider.config?.principal)}
                  disabled={provider.adapterStatus !== "operational"}
                  name="principal"
                  type="checkbox"
                />
                Provedor principal
              </label>

              {provider.adapterStatus === "prepared" ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 sm:col-span-2">
                  A arquitetura e o webhook já têm endereço reservado. A ativação transacional fica bloqueada
                  até o adaptador deste provedor ser concluído e validado em sandbox.
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <button
                  className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-black text-white"
                  type="submit"
                >
                  Salvar provedor
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>

      <style>
        {".input{min-height:3rem;border-radius:1rem;border:1px solid rgb(226 232 240);background:white;padding:0 1rem;outline:none}.input:focus{border-color:rgb(5 150 105)}"}
      </style>
    </div>
  );
}

function ProviderBadge({
  adapterStatus,
  ready
}: {
  adapterStatus: "operational" | "prepared";
  ready: boolean;
}) {
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
        <BadgeCheck size={14} /> Pronto
      </span>
    );
  }

  if (adapterStatus === "operational") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
        <CircleAlert size={14} /> Pendente
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-800">
      Estrutura pronta
    </span>
  );
}

function Capability({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={
        ok
          ? "flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
          : "flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500"
      }
    >
      {ok ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
      {label}
    </div>
  );
}

function Credential({ name, configured }: { name: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs">
      <code className="break-all text-slate-600">{name}</code>
      <span className={configured ? "shrink-0 font-black text-emerald-700" : "shrink-0 font-black text-amber-700"}>
        {configured ? "Configurada" : "Pendente"}
      </span>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <article className="rounded-[24px] border border-emerald-950/10 bg-white p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}

function authLabel(value: "api_key" | "access_token" | "oauth_certificate") {
  if (value === "api_key") return "API Key + webhook";
  if (value === "access_token") return "Access Token + webhook";
  return "OAuth + certificado digital";
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
