import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDate, formatDateTime, formatMoney } from "@/components/ui-kit";
import { PrintButton } from "@/components/lavagestor/PrintButton";
import { firstParam } from "@/lib/form-utils";
import { getLavaRelatorio } from "@/lib/lavagestor-relatorios-data";

export const dynamic = "force-dynamic";

type GroupRow = { label: string; quantidade: number; valor: number; recebido: number; pendente: number };
type AnyRow = Record<string, unknown>;

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const relatorio = await getLavaRelatorio({ inicio: firstParam(params.inicio), fim: firstParam(params.fim) });

  return (
    <LavaGestorShell activePath="/lavagestor/relatorios" companyName={relatorio.companyName}>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <section className="grid gap-6">
        <div className="report-no-print">
          <PageHeader
            eyebrow="LavaGestor"
            title="Relatórios"
            description="Fechamento financeiro e operacional por período."
            actions={<><BackButton href="/lavagestor" /><PrintButton label="Imprimir relatório" /><Link className="button-primary" href="/lavagestor/fila">Ver fila</Link></>}
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
            <Card label="Lavagens" value={relatorio.cards.lavagens} />
            <Card label="Pagas" value={relatorio.cards.lavagensPagas} />
            <Card label="Abertas/fiado" value={relatorio.cards.lavagensAbertas} />
            <Card label="Entrada líquida" value={formatMoney(relatorio.cards.entradaLiquida)} green />
            <Card label="Recebido" value={formatMoney(relatorio.cards.recebido)} green />
            <Card label="Pendente" value={formatMoney(relatorio.cards.pendente)} yellow />
            <Card label="Comissões pendentes" value={formatMoney(relatorio.cards.comissoesPendentes)} yellow />
            <Card label="Vales em aberto" value={formatMoney(relatorio.cards.valesAbertos)} yellow />
            <Card label="Entrada bruta" value={formatMoney(relatorio.cards.entradaBruta)} />
            <Card label="Descontos" value={formatMoney(relatorio.cards.descontos)} />
            <Card label="Comissões pagas" value={formatMoney(relatorio.cards.comissoesPagas)} />
            <Card label="Vales baixados" value={formatMoney(relatorio.cards.valesBaixados)} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Group title="Por forma de pagamento" rows={relatorio.porPagamento} />
            <Group title="Por funcionário" rows={relatorio.porFuncionario} />
            <Group title="Por status da lavagem" rows={relatorio.porStatus} />
            <Group title="Por status do pagamento" rows={relatorio.porPagamentoStatus} />
          </section>

          <section className="grid gap-3">
            <h3 className="text-xl font-black">Lavagens do período</h3>
            {relatorio.lavagens.length === 0 ? <Empty text="Nenhuma lavagem no período." /> : relatorio.lavagens.map((row) => <Lavagem key={String(row.id)} row={row as AnyRow} />)}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Simple title="Comissões" rows={relatorio.comissoes as AnyRow[]} dateKey="created_at" />
            <Simple title="Vales" rows={relatorio.vales as AnyRow[]} dateKey="data_vale" />
          </section>
        </article>
      </section>
    </LavaGestorShell>
  );
}

function Card({ label, value, green, yellow }: { label: string; value: string | number; green?: boolean; yellow?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : yellow ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return <div className={`rounded-lg border p-4 ${tone}`}><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p><strong className="mt-2 block text-2xl font-black">{value}</strong></div>;
}

function Group({ title, rows }: { title: string; rows: GroupRow[] }) {
  return <div className="rounded-lg border border-border p-3"><h3 className="mb-3 text-lg font-black">{title}</h3><div className="grid gap-2">{rows.length === 0 ? <Empty text="Sem dados." /> : rows.map((row) => <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-muted p-2 text-sm" key={row.label}><div><strong>{row.label}</strong><p className="text-xs text-muted-foreground">{row.quantidade} registro(s)</p></div><div className="text-right"><strong>{formatMoney(row.valor)}</strong><p className="text-xs text-muted-foreground">Recebido {formatMoney(row.recebido)}</p></div></div>)}</div></div>;
}

function Lavagem({ row }: { row: AnyRow }) {
  return <div className="grid gap-2 rounded-lg border border-border p-3 text-sm sm:grid-cols-[1fr_auto]"><div><strong>{String(row.cliente || "Cliente")}</strong><p className="text-muted-foreground">{String(row.veiculo || "-")} · {String(row.servico || "-")}</p><p className="text-xs text-muted-foreground">{formatDateTime(row.data_ref)} · {String(row.status_label || "-")} · {String(row.status_pagamento_label || "-")}</p></div><div className="text-left sm:text-right"><strong>{formatMoney(row.valor_final ?? row.valor)}</strong><p className="text-xs text-muted-foreground">Recebido {formatMoney(row.valor_recebido)}</p></div></div>;
}

function Simple({ title, rows, dateKey }: { title: string; rows: AnyRow[]; dateKey: string }) {
  return <div className="rounded-lg border border-border p-3"><h3 className="mb-3 text-lg font-black">{title}</h3><div className="grid gap-2">{rows.length === 0 ? <Empty text="Sem dados." /> : rows.map((row) => <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-muted p-2 text-sm" key={String(row.id)}><div><strong>{String(row.funcionario || "-")}</strong><p className="text-xs text-muted-foreground">{String(row.status || "-")} · {formatDate(row[dateKey])}</p></div><strong>{formatMoney(row.valor)}</strong></div>)}</div></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">{text}</p>;
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
