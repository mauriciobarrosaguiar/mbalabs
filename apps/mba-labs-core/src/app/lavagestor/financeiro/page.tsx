import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatMoney } from "@/components/ui-kit";
import { firstParam } from "@/lib/form-utils";
import { getLavaRelatorio } from "@/lib/lavagestor-relatorios-data";
import { requireLavaGestorFinanceAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireLavaGestorFinanceAccess("/lavagestor/financeiro");
  const params = await searchParams;
  const preset = firstParam(params.preset) ?? "mes";
  const period = resolvePeriod(preset, firstParam(params.inicio), firstParam(params.fim));
  const relatorio = await getLavaRelatorio(period);

  return (
    <LavaGestorShell activePath="/lavagestor/financeiro" companyName={relatorio.companyName}>
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Financeiro"
          description="Visao simples do dinheiro do lava-jato: recebido, a receber, fiado, comissoes, vales, caixa real e formas de pagamento."
          actions={<><BackButton href="/lavagestor" /><Link className="button-secondary" href="/lavagestor/relatorios">Relatorio completo</Link></>}
        />
        <MessageBanner error={relatorio.error ?? undefined} />

        <nav className="flex gap-2 overflow-x-auto pb-1">
          <PresetLink label="Hoje" value="hoje" active={preset === "hoje"} />
          <PresetLink label="Semana" value="semana" active={preset === "semana"} />
          <PresetLink label="Mes" value="mes" active={preset === "mes"} />
          <PresetLink label="Periodo" value="custom" active={preset === "custom"} />
        </nav>

        <form className="grid gap-3 rounded-xl border border-border bg-white p-3 shadow-sm md:grid-cols-[1fr_1fr_auto]" action="/lavagestor/financeiro">
          <input name="preset" type="hidden" value="custom" />
          <label className="grid gap-2"><span className="text-sm font-black">Inicio</span><input className="input" name="inicio" type="date" defaultValue={relatorio.filters.inicio} /></label>
          <label className="grid gap-2"><span className="text-sm font-black">Fim</span><input className="input" name="fim" type="date" defaultValue={relatorio.filters.fim} /></label>
          <button className="button-primary self-end" type="submit">Aplicar</button>
        </form>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Recebido no periodo" value={formatMoney(relatorio.cards.recebido)} green />
          <Metric label="A receber" value={formatMoney(relatorio.cards.pendente)} warning />
          <Metric label="Fiado / aberto" value={relatorio.cards.lavagensAbertas} warning />
          <Metric label="Ticket medio" value={formatMoney(avg(relatorio.cards.entradaLiquida, relatorio.cards.lavagens))} />
          <Metric label="Comissoes pendentes" value={formatMoney(relatorio.cards.comissoesPendentes)} warning />
          <Metric label="Vales abertos" value={formatMoney(relatorio.cards.valesAbertos)} warning />
          <Metric label="Caixa real" value={formatMoney(relatorio.cards.caixaReal)} green />
          <Metric label="Lavagens pagas" value={relatorio.cards.lavagensPagas} />
        </div>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Formas de pagamento</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {(relatorio.porPagamento as Array<Record<string, unknown>>).map((row) => (
              <div className="rounded-lg border border-border bg-muted/40 p-3" key={String(row.label)}>
                <p className="text-sm font-black">{String(row.label)}</p>
                <p className="mt-2 text-2xl font-black">{formatMoney(row.recebido)}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{String(row.quantidade)} registro(s), pendente {formatMoney(row.pendente)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Alertas financeiros</h2>
          {(relatorio.alertas as Array<Record<string, unknown>>).length === 0 ? <p className="rounded-lg bg-emerald-50 p-3 text-sm font-black text-emerald-950">Sem alerta financeiro critico no periodo.</p> : null}
          {(relatorio.alertas as Array<Record<string, unknown>>).map((alerta) => (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-950" key={String(alerta.alerta)}>
              <strong>{String(alerta.alerta)}</strong>
              <p className="mt-1">{String(alerta.acao)} - {String(alerta.impacto)}</p>
            </div>
          ))}
        </section>
      </section>
    </LavaGestorShell>
  );
}

function PresetLink({ label, value, active }: { label: string; value: string; active: boolean }) {
  return <Link className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-black ${active ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-border bg-white"}`} href={`/lavagestor/financeiro?preset=${value}`}>{label}</Link>;
}

function Metric({ label, value, green = false, warning = false }: { label: string; value: string | number; green?: boolean; warning?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : warning ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return <div className={`rounded-xl border p-3 shadow-sm ${tone}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-2 block break-words text-xl font-black">{value}</strong></div>;
}

function resolvePeriod(preset: string, inicio?: string, fim?: string) {
  if (preset === "custom") return { inicio, fim };
  const now = new Date();
  if (preset === "hoje") {
    const today = toDateInput(now);
    return { inicio: today, fim: today };
  }
  if (preset === "semana") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { inicio: toDateInput(start), fim: toDateInput(now) };
  }
  return { inicio: undefined, fim: undefined };
}

function avg(total: number, count: number) {
  return count > 0 ? total / count : 0;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
