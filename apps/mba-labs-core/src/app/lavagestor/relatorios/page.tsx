import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDate, formatDateTime, formatMoney } from "@/components/ui-kit";
import { PrintButton } from "@/components/lavagestor/PrintButton";
import { firstParam } from "@/lib/form-utils";
import { getLavaRelatorio } from "@/lib/lavagestor-relatorios-data";

export const dynamic = "force-dynamic";

type GroupRow = { label: string; quantidade: number; valor: number; recebido: number; pendente: number };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RelatoriosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const relatorio = await getLavaRelatorio({ inicio: firstParam(params.inicio), fim: firstParam(params.fim) });

  return (
    <LavaGestorShell activePath="/lavagestor/relatorios" companyName={relatorio.companyName}>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <section className="report-page grid gap-6">
        <div className="report-no-print">
          <PageHeader
            eyebrow="LavaGestor"
            title="Relatórios"
            description="Fechamento financeiro e operacional por período."
            actions={
              <>
                <BackButton href="/lavagestor" />
                <PrintButton label="Imprimir relatório" />
                <Link className="button-primary" href="/lavagestor/fila">Ver fila</Link>
              </>
            }
          />
        </div>
        <MessageBanner error={relatorio.error ?? undefined} />

        <form className="report-no-print panel grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]" action="">
          <label className="grid gap-2"><span className="text-sm font-bold">Início</span><input className="input" name="inicio" type="date" defaultValue={relatorio.filters.inicio} /></label>
          <label className="grid gap-2"><span className="text-sm font-bold">Fim</span><input className="input" name="fim" type="date" defaultValue={relatorio.filters.fim} /></label>
          <button className="button-secondary self-end" type="submit">Filtrar</button>
        </form>

        <article className="report-print grid gap-5 rounded-xl border border-border bg-white p-5 shadow-sm">
          <header className="grid gap-2 border-b border-border pb-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">LavaGestor</p>
            <h2 className="text-3xl font-black">Relatório do período</h2>
            <p className="text-sm font-semibold text-muted-foreground">{relatorio.companyName} · {formatDate(relatorio.filters.inicio)} até {formatDate(relatorio.filters.fim)}</p>
          </header>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReportCard label="Lavagens" value={relatorio.cards.lavagens} />
            <ReportCard label="Pagas" value={relatorio.cards.lavagensPagas} />
            <ReportCard label="Abertas/fiado" value={relatorio.cards.lavagensAbertas} />
            <ReportCard label="Entrada líquida" value={formatMoney(relatorio.cards.entradaLiquida)} highlight />
            <ReportCard label="Recebido" value={formatMoney(relatorio.cards.recebido)} highlight />
            <ReportCard label="Pendente" value={formatMoney(relatorio.cards.pendente)} warn />
            <ReportCard label="Comissões pendentes" value={formatMoney(relatorio.cards.comissoesPendentes)} warn />
            <ReportCard label="Vales em aberto" value={formatMoney(relatorio.cards.valesAbertos)} warn />
            <ReportCard label="Entrada bruta" value={formatMoney(relatorio.cards.entradaBruta)} />
            <ReportCard label="Descontos" value={formatMoney(relatorio.cards.descontos)} />
            <ReportCard label="Comissões pagas" value={formatMoney(relatorio.cards.comissoesPagas)} />
            <ReportCard label="Vales baixados" value={formatMoney(relatorio.cards.valesBaixados)} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <GroupTable title="Por forma de pagamento" rows={relatorio.porPagamento} />
            <GroupTable title="Por funcionário" rows={relatorio.porFuncionario} />
            <GroupTable title="Por status da lavagem" rows={relatorio.porStatus} />
            <GroupTable title="Por status de pagamento" rows={relatorio.porPagamentoStatus} />
          </section>

          <section className="grid gap-3">
            <h3 className="text-xl font-black">Lavagens do período</h3>
            <div className="grid gap-2">
              {relatorio.lavagens.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhuma lavagem no período.</p> : relatorio.lavagens.map((row) => <LavagemLine key={String(row.id)} row={row} />)}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <SimpleList title="Comissões" rows={relatorio.comissoes} valueKey="valor" dateKey="created_at" />
            <SimpleList title="Vales" rows={relatorio.vales} valueKey="valor" dateKey="data_vale" />
          </section>
        </article>
      </section>
    </LavaGestorShell>
  );
}

function ReportCard({ label, value, highlight = false, warn = false }: { label: string; value: string | number; highlight?: boolean; warn?: boolean }) {
  return <div className={`rounded-lg border p-4 ${highlight ? "border-emerald-200 bg-emerald-50" : warn ? "border-amber-200 bg-amber-50" : "border-border bg-white"}`}><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p><strong className="mt-2 block text-2xl font-black">{value}</strong></div>;
}

function GroupTable({ title, rows }: { title: string; rows: GroupRow[] }) {
  return <div className="rounded-lg border border-border p-3"><h3 className="mb-3 text-lg font-black">{title}</h3><div className="grid gap-2">{rows.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">Sem dados.</p> : rows.map((row) => <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-muted p-2 text-sm" key={row.label}><div><strong>{row.label}</strong><p className="text-xs text-muted-foreground">{row.quantidade} registro(s)</p></div><div className="text-right"><strong>{formatMoney(row.valor)}</strong><p className="text-xs text-muted-foreground">Recebido {formatMoney(row.recebido)}</p></div></div>)}</div></div>;
}

function LavagemLine({ row }: { row: Record<string, unknown> }) {
  return <div className="grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-[1fr_auto]"><div><strong>{String(row.cliente || "Cliente")}</strong><p className="text-muted-foreground">{String(row.veiculo || "-")} · {String(row.servico || "-")}</p><p className="text-xs text-muted-foreground">{formatDateTime(row.data_ref)} · {String(row.status_label || "-")} · {String(row.status_pagamento_label || "-")}</p></div><div className="text-left sm:text-right"><strong>{formatMoney(row.valor_final ?? row.valor)}</strong><p className="text-xs text-muted-foreground">Recebido {formatMoney(row.valor_recebido)}</p></div></div>;
}

function SimpleList({ title, rows, valueKey, dateKey }: { title: string; rows: Record<string, unknown>[]; valueKey: string; dateKey: string }) {
  return <div className="rounded-lg border border-border p-3"><h3 className="mb-3 text-lg font-black">{title}</h3><div className="grid gap-2">{rows.length === 0 ? <p className="text-sm font-semibold text-muted-foreground">Sem dados.</p> : rows.map((row) => <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-muted p-2 text-sm" key={String(row.id)}><div><strong>{String(row.funcionario || "-")}</strong><p className="text-xs text-muted-foreground">{String(row.status || "-")} · {formatDate(row[dateKey])}</p></div><strong>{formatMoney(row[valueKey])}</strong></div>)}</div></div>;
}

const printCss = `
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  body * { visibility: hidden !important; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; gap: 8px !important; font-size: 9pt !important; }
  .report-no-print { display: none !important; }
  .report-print h2 { font-size: 18pt !important; }
  .report-print h3 { font-size: 12pt !important; }
}
`;
