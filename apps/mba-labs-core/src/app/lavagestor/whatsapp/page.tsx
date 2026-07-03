import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { MessageActions } from "@/components/lavagestor/MessageActions";
import { BackButton, MessageBanner, PageHeader, formatDateTime } from "@/components/ui-kit";
import {
  approveLavaWhatsappMessageAction,
  cancelLavaWhatsappMessageAction,
  markLavaWhatsappSentAction,
  sendLavaWhatsappMessageAction,
  sendPendingLavaWhatsappMessagesAction
} from "@/lib/actions/lavagestor-whatsapp-actions";
import { firstParam } from "@/lib/form-utils";
import {
  getLavaWhatsappPageData,
  WHATSAPP_EVENT_OPTIONS,
  WHATSAPP_PROVIDER_OPTIONS,
  WHATSAPP_STATUS_OPTIONS
} from "@/lib/lavagestor-whatsapp-data";

export const dynamic = "force-dynamic";

export default async function LavaWhatsappPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = {
    status: firstParam(params.status) ?? "",
    evento: firstParam(params.evento) ?? "",
    provider: firstParam(params.provider) ?? "",
    q: firstParam(params.q) ?? ""
  };
  const data = await getLavaWhatsappPageData(filters);
  const returnTo = buildReturn(filters);

  return (
    <LavaGestorShell activePath="/lavagestor/whatsapp">
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="WhatsApp"
          description="Fila real de mensagens: manual, aprovacao e envio automatico quando houver provedor configurado."
          actions={<><BackButton href="/lavagestor" /><Link className="button-secondary" href="/lavagestor/configuracoes">Configurar</Link></>}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Metric label="Pendentes" value={data.stats.pendentes} />
          <Metric label="Aguardando aprovacao" value={data.stats.aprovacao} warning />
          <Metric label="Enviados hoje" value={data.stats.enviadosHoje} green />
          <Metric label="Com erro" value={data.stats.erro} danger />
          <Metric label="Cancelados" value={data.stats.cancelados} />
        </div>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <form className="grid gap-3 md:grid-cols-5" action="/lavagestor/whatsapp">
            <Select label="Status" name="status" value={filters.status} options={WHATSAPP_STATUS_OPTIONS} />
            <Select label="Evento" name="evento" value={filters.evento} options={WHATSAPP_EVENT_OPTIONS} />
            <Select label="Provider" name="provider" value={filters.provider} options={WHATSAPP_PROVIDER_OPTIONS} />
            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm font-black">Buscar</span>
              <input className="input" name="q" defaultValue={filters.q} placeholder="Cliente, telefone, mensagem" />
            </label>
            <button className="button-secondary md:col-span-5" type="submit">Filtrar</button>
          </form>
          <form action={sendPendingLavaWhatsappMessagesAction}>
            <input name="return_to" type="hidden" value={returnTo} />
            <button className="button-primary" type="submit">Enviar pendentes</button>
          </form>
        </section>

        <section className="grid gap-3">
          {data.rows.length === 0 ? <p className="rounded-xl border border-border bg-white p-4 text-sm font-semibold text-muted-foreground">Nenhuma mensagem neste filtro.</p> : null}
          {data.rows.map((row) => (
            <article className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm" key={String(row.id)}>
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="break-words text-lg">{String(row.cliente || "Cliente nao informado")}</strong>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(String(row.status))}`}>{String(row.status_label)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{String(row.telefone || "Telefone nao informado")} - {String(row.evento_label)}</p>
                </div>
                <div className="grid gap-1 text-xs font-bold text-muted-foreground md:text-right">
                  <span>{String(row.provider_label)}</span>
                  <span>Gerada por {String(row.mensagem_gerada_por || "modelo")}</span>
                  <span>{formatDateTime(row.created_at)}</span>
                </div>
              </div>

              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm font-semibold leading-6">{String(row.mensagem || "")}</p>
              {row.erro ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-950">{String(row.erro)}</p> : null}
              {row.agendado_para || row.enviado_em ? (
                <div className="grid gap-2 text-xs font-semibold text-muted-foreground md:grid-cols-2">
                  {row.agendado_para ? <span>Agendado para {formatDateTime(row.agendado_para)}</span> : null}
                  {row.enviado_em ? <span>Enviado em {formatDateTime(row.enviado_em)}</span> : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <MessageActions message={String(row.mensagem || "")} phone={String(row.telefone || "")} />
                {String(row.status) === "aguardando_aprovacao" ? <ActionButton action={approveLavaWhatsappMessageAction} id={String(row.id)} label="Aprovar" returnTo={returnTo} /> : null}
                {["pendente", "aprovado", "erro"].includes(String(row.status)) ? <ActionButton action={sendLavaWhatsappMessageAction} id={String(row.id)} label="Enviar agora" returnTo={returnTo} primary /> : null}
                {!String(row.status).startsWith("enviado") ? <ActionButton action={markLavaWhatsappSentAction} id={String(row.id)} label="Marcar enviado" returnTo={returnTo} /> : <span className="button-secondary opacity-70">Enviado</span>}
                {String(row.status) !== "cancelado" ? <ActionButton action={cancelLavaWhatsappMessageAction} id={String(row.id)} label="Cancelar" returnTo={returnTo} danger /> : null}
              </div>
            </article>
          ))}
        </section>
      </section>
    </LavaGestorShell>
  );
}

function Metric({ label, value, green = false, warning = false, danger = false }: { label: string; value: number; green?: boolean; warning?: boolean; danger?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : warning ? "border-amber-200 bg-amber-50" : danger ? "border-red-200 bg-red-50" : "border-border bg-white";
  return <div className={`rounded-xl border p-3 shadow-sm ${tone}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-2 block text-2xl font-black">{value}</strong></div>;
}

function Select({ label, name, value, options }: { label: string; name: string; value: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <select className="input" name={name} defaultValue={value}>
        {options.map((item) => <option key={item.value || "all"} value={item.value}>{item.label}</option>)}
      </select>
    </label>
  );
}

function ActionButton({ action, id, label, returnTo, primary = false, danger = false }: { action: (formData: FormData) => Promise<void>; id: string; label: string; returnTo: string; primary?: boolean; danger?: boolean }) {
  return (
    <form action={action}>
      <input name="id" type="hidden" value={id} />
      <input name="return_to" type="hidden" value={returnTo} />
      <button className={primary ? "button-primary" : danger ? "button-danger" : "button-secondary"} type="submit">{label}</button>
    </form>
  );
}

function buildReturn(filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/lavagestor/whatsapp?${query}` : "/lavagestor/whatsapp";
}

function statusTone(status: string) {
  if (status === "enviado" || status === "enviado_manual") return "bg-emerald-50 text-emerald-900";
  if (status === "erro") return "bg-red-50 text-red-900";
  if (status === "aguardando_aprovacao") return "bg-amber-50 text-amber-900";
  if (status === "cancelado") return "bg-muted text-muted-foreground";
  return "bg-sky-50 text-sky-900";
}
