import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime } from "@/components/ui-kit";
import { gerarFilaLavaAutomacao, saveLavaAutomacao, updateLavaAutomacaoFilaStatus } from "@/lib/actions/lavagestor-automacoes-actions";
import { firstParam } from "@/lib/form-utils";
import { LAVA_AUTOMACAO_TIPOS, getLavaAutomacoesData } from "@/lib/lavagestor-automacoes-data";

export const dynamic = "force-dynamic";

const defaultMessage = "Ola, {cliente}! A {empresa} tem uma mensagem para voce sobre {veiculo}.";

export default async function AutomacoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await getLavaAutomacoesData();

  return (
    <LavaGestorShell activePath="/lavagestor/automacoes">
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Automacoes"
          description="Crie regras e gere uma fila manual de WhatsApp. O LavaGestor nao envia mensagens automaticamente."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="Ativas" value={data.summary.ativas} green />
          <Metric label="Pendentes" value={data.summary.pendentes} warning />
          <Metric label="Enviadas" value={data.summary.enviados} />
          <Metric label="Canceladas" value={data.summary.cancelados} />
        </div>

        <form action={saveLavaAutomacao} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Nova automacao</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Nome" name="nome" required placeholder="Ex.: Retorno 30 dias" />
            <label className="grid gap-2">
              <span className="text-sm font-black">Tipo</span>
              <select className="input" name="tipo">
                {LAVA_AUTOMACAO_TIPOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <Input label="Gatilho" name="gatilho" placeholder="Ex.: apos entrega" />
            <Input label="Atraso em dias" name="atraso_dias" type="number" defaultValue="0" />
            <label className="grid gap-2 md:col-span-2 xl:col-span-4">
              <span className="text-sm font-black">Mensagem</span>
              <textarea className="input min-h-24" name="mensagem" defaultValue={defaultMessage} />
            </label>
          </div>
          <button className="button-primary w-fit" type="submit">Salvar automacao</button>
        </form>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Regras</h2>
          {data.automacoes.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhuma automacao cadastrada.</p> : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.automacoes.map((row) => (
              <article className="grid gap-3 rounded-lg border border-border p-3" key={String(row.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <strong>{String(row.nome)}</strong>
                    <p className="mt-1 text-sm font-semibold text-muted-foreground">{String(row.tipo)} - {String(row.gatilho || "manual")}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-black">{row.ativo === false ? "Inativa" : "Ativa"}</span>
                </div>
                <p className="text-sm font-semibold leading-6 text-muted-foreground">{String(row.mensagem || defaultMessage)}</p>
                <form action={gerarFilaLavaAutomacao}>
                  <input name="automacao_id" type="hidden" value={String(row.id)} />
                  <button className="button-primary w-full" type="submit">Gerar fila manual</button>
                </form>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Fila manual</h2>
          {data.fila.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhum item na fila.</p> : null}
          <div className="grid gap-2">
            {data.fila.map((row) => (
              <article className="grid gap-3 rounded-lg border border-border p-3 lg:grid-cols-[1fr_auto]" key={String(row.id)}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <strong className="break-words">{String(row.cliente || "Cliente")}</strong>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">{String(row.status)}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-muted-foreground">{String(row.veiculo || "-")} - {formatDateTime(row.agendado_para || row.created_at)}</p>
                  <p className="mt-2 rounded-lg bg-muted p-3 text-sm font-semibold leading-6">{String(row.mensagem || "")}</p>
                </div>
                <div className="grid content-start gap-2 sm:grid-cols-3 lg:w-64 lg:grid-cols-1">
                  {row.whatsapp_url ? <a className="button-primary justify-center text-center" href={String(row.whatsapp_url)} target="_blank" rel="noreferrer">Abrir WhatsApp</a> : null}
                  <QueueButton id={String(row.id)} status="enviado_manual" label="Marcar enviado" />
                  <QueueButton id={String(row.id)} status="cancelado" label="Cancelar" danger />
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </LavaGestorShell>
  );
}

function QueueButton({ id, status, label, danger = false }: { id: string; status: string; label: string; danger?: boolean }) {
  return (
    <form action={updateLavaAutomacaoFilaStatus}>
      <input name="id" type="hidden" value={id} />
      <input name="status" type="hidden" value={status} />
      <button className={`${danger ? "button-danger" : "button-secondary"} w-full`} type="submit">{label}</button>
    </form>
  );
}

function Metric({ label, value, green = false, warning = false }: { label: string; value: string | number; green?: boolean; warning?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : warning ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return <div className={`rounded-xl border p-3 shadow-sm ${tone}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-2 block text-xl font-black">{value}</strong></div>;
}

function Input({ label, name, type = "text", required = false, defaultValue, placeholder }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string }) {
  return <label className="grid gap-2"><span className="text-sm font-black">{label}</span><input className="input" name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} /></label>;
}
