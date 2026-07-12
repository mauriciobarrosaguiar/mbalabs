import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDate, formatDateTime, formatMoney } from "@/components/ui-kit";
import { fecharLavaCaixa, reabrirLavaCaixa } from "@/lib/actions/lavagestor-caixa-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaCaixa } from "@/lib/lavagestor-caixa-data";
import { requireLavaGestorFinanceAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { current, perfil } = await requireLavaGestorFinanceAccess("/lavagestor/financeiro");
  const tipo = firstParam(params.tipo) === "mes" ? "mes" : "dia";
  const caixa = await getLavaCaixa({
    tipo,
    data: firstParam(params.data),
    mes: firstParam(params.mes)
  });
  const returnTo = `/lavagestor/financeiro?tipo=${caixa.period.tipo}&data=${caixa.period.data}&mes=${caixa.period.mes}`;
  const fechado = caixa.fechamento?.status === "fechado";

  return (
    <LavaGestorShell activePath="/lavagestor/financeiro" companyName={caixa.companyName} perfil={perfil} userName={current.usuario.nome} roleLabel={perfil}>
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Caixa e fechamento"
          description="Confira o dinheiro que entrou, separe por forma de pagamento e feche o caixa por dia ou por mês."
          actions={<><BackButton href="/lavagestor/operacao" /><Link className="button-secondary" href="/lavagestor/relatorios">Relatório completo</Link></>}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? caixa.error ?? undefined} />

        <section className="grid gap-3 rounded-xl border border-border bg-white p-3 shadow-sm">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <ModeLink label="Caixa do dia" href={`/lavagestor/financeiro?tipo=dia&data=${caixa.period.data}`} active={caixa.period.tipo === "dia"} />
            <ModeLink label="Fechamento mensal" href={`/lavagestor/financeiro?tipo=mes&mes=${caixa.period.mes}`} active={caixa.period.tipo === "mes"} />
            <Link className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-black" href={`/lavagestor/financeiro?tipo=dia&data=${todayInput()}`}>Hoje</Link>
            <Link className="shrink-0 rounded-lg border border-border bg-white px-3 py-2 text-sm font-black" href={`/lavagestor/financeiro?tipo=mes&mes=${monthInput()}`}>Mês atual</Link>
          </div>

          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" action="/lavagestor/financeiro">
            <input name="tipo" type="hidden" value={caixa.period.tipo} />
            {caixa.period.tipo === "mes" ? (
              <label className="grid gap-2 md:max-w-xs">
                <span className="text-sm font-black">Mês</span>
                <input className="input" name="mes" type="month" defaultValue={caixa.period.mes} />
              </label>
            ) : (
              <label className="grid gap-2 md:max-w-xs">
                <span className="text-sm font-black">Dia</span>
                <input className="input" name="data" type="date" defaultValue={caixa.period.data} />
              </label>
            )}
            <div className="grid content-end rounded-lg bg-muted px-3 py-2 text-sm font-bold text-muted-foreground">
              <span>{caixa.period.label}</span>
              <span>{formatDate(caixa.period.inicio)} até {formatDate(caixa.period.fim)}</span>
            </div>
            <button className="button-primary self-end" type="submit">Aplicar</button>
          </form>
        </section>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Recebido no caixa" value={formatMoney(caixa.resumo.cards.totalRecebido)} green />
          <Metric label="Dinheiro" value={formatMoney(caixa.resumo.cards.totalDinheiro)} />
          <Metric label="Pix" value={formatMoney(caixa.resumo.cards.totalPix)} />
          <Metric label="Cartão" value={formatMoney(caixa.resumo.cards.totalCartao)} />
          <Metric label="Outros" value={formatMoney(caixa.resumo.cards.totalOutros)} />
          <Metric label="Fiado lançado" value={formatMoney(caixa.resumo.cards.totalFiado)} warning />
          <Metric label="A receber" value={formatMoney(caixa.resumo.cards.totalPendente)} warning />
          <Metric label="Comissões pagas" value={formatMoney(caixa.resumo.cards.totalComissoesPagas)} warning />
          <Metric label="Vales baixados" value={formatMoney(caixa.resumo.cards.totalValesBaixados)} warning />
          <Metric label="Caixa real" value={formatMoney(caixa.resumo.cards.caixaReal)} green />
        </div>

        <section className="grid gap-4 rounded-xl border border-border bg-white p-4 shadow-sm lg:grid-cols-[1fr_360px]">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">Fechamento {caixa.period.tipo === "mes" ? "mensal" : "do dia"}</h2>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">O valor esperado usa: recebido - comissões pagas - vales baixados.</p>
              </div>
              {caixa.fechamento ? <StatusBadge status={String(caixa.fechamento.status)} /> : <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-900">Aberto</span>}
            </div>

            {caixa.fechamento ? (
              <div className="grid gap-2 rounded-xl border border-border bg-muted/40 p-3 sm:grid-cols-3">
                <MiniStat label="Esperado" value={formatMoney(caixa.fechamento.caixa_real)} />
                <MiniStat label="Informado" value={formatMoney(caixa.fechamento.valor_informado)} />
                <MiniStat label="Diferença" value={formatMoney(caixa.fechamento.diferenca)} warning={Number(caixa.fechamento.diferenca ?? 0) !== 0} />
                <MiniStat label="Fechado em" value={formatDateTime(caixa.fechamento.fechado_em)} />
                <MiniStat label="Período" value={`${formatDate(caixa.fechamento.periodo_inicio)} até ${formatDate(caixa.fechamento.periodo_fim)}`} />
                <MiniStat label="Status" value={String(caixa.fechamento.status === "fechado" ? "Fechado" : "Reaberto")} />
              </div>
            ) : null}

            <form action={fecharLavaCaixa} className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 md:grid-cols-[1fr_1fr_auto]">
              <input name="return_to" type="hidden" value={returnTo} />
              <input name="tipo" type="hidden" value={caixa.period.tipo} />
              <input name="data" type="hidden" value={caixa.period.data} />
              <input name="mes" type="hidden" value={caixa.period.mes} />
              <label className="grid gap-2">
                <span className="text-sm font-black">Valor contado</span>
                <input className="input bg-white" name="valor_informado" type="number" min="0" step="0.01" defaultValue={Number(caixa.fechamento?.valor_informado ?? caixa.resumo.cards.caixaReal).toFixed(2)} />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black">Observação</span>
                <input className="input bg-white" name="observacoes" defaultValue={String(caixa.fechamento?.observacoes ?? "")} placeholder="Ex.: conferido por duas pessoas" />
              </label>
              <button className="button-primary self-end" type="submit">{fechado ? "Refazer fechamento" : "Fechar caixa"}</button>
            </form>

            {fechado && caixa.fechamento?.id ? (
              <form action={reabrirLavaCaixa}>
                <input name="id" type="hidden" value={String(caixa.fechamento.id)} />
                <input name="return_to" type="hidden" value={returnTo} />
                <button className="button-secondary" type="submit">Reabrir para conferência</button>
              </form>
            ) : null}
          </div>

          <aside className="grid content-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <h3 className="text-base font-black">Resumo operacional</h3>
            <MiniStat label="Pagamentos recebidos" value={String(caixa.resumo.cards.pagamentos)} />
            <MiniStat label="Lavagens no período" value={String(caixa.resumo.cards.lavagens)} />
            <MiniStat label="Comissões pagas" value={String(caixa.resumo.cards.comissoesPagas)} />
            <MiniStat label="Vales baixados" value={String(caixa.resumo.cards.valesBaixados)} />
          </aside>
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Pagamentos do período</h2>
          {caixa.resumo.pagamentos.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhum pagamento recebido neste período.</p>
          ) : (
            <div className="grid gap-2">
              {caixa.resumo.pagamentos.map((pagamento) => (
                <div className="grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center" key={String(pagamento.id)}>
                  <div className="min-w-0">
                    <strong className="block truncate">{String(pagamento.cliente || "Cliente")}</strong>
                    <span className="text-xs font-semibold text-muted-foreground">{String(pagamento.veiculo || "-")} · {formatDateTime(pagamento.data_pagamento)}</span>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">{String(pagamento.forma_label)}</span>
                  <strong className="text-base">{formatMoney(pagamento.valor)}</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Histórico de fechamentos</h2>
          {caixa.historico.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhum fechamento registrado ainda.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {caixa.historico.map((row) => (
                <article className="grid gap-2 rounded-lg border border-border p-3" key={String(row.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <strong>{row.periodo_tipo === "mes" ? "Mensal" : "Diário"}</strong>
                    <StatusBadge status={String(row.status)} />
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">{formatDate(row.periodo_inicio)} até {formatDate(row.periodo_fim)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <MiniStat label="Esperado" value={formatMoney(row.caixa_real)} />
                    <MiniStat label="Diferença" value={formatMoney(row.diferenca)} warning={Number(row.diferenca ?? 0) !== 0} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </LavaGestorShell>
  );
}

function ModeLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return <Link className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-black ${active ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-border bg-white"}`} href={href}>{label}</Link>;
}

function Metric({ label, value, green = false, warning = false }: { label: string; value: string | number; green?: boolean; warning?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : warning ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return <div className={`rounded-xl border p-3 shadow-sm ${tone}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-2 block break-words text-xl font-black">{value}</strong></div>;
}

function MiniStat({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={`min-w-0 rounded-lg px-2.5 py-2 ${warning ? "bg-amber-50 text-amber-950" : "bg-white"}`}><p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-black">{value}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  const fechado = status === "fechado";
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${fechado ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>{fechado ? "Fechado" : "Reaberto"}</span>;
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function monthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
