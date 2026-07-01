import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDate, formatDateTime, formatMoney } from "@/components/ui-kit";
import { PrintButton } from "@/components/lavagestor/PrintButton";
import { firstParam } from "@/lib/form-utils";
import { requireLavaGestorFinanceAccess } from "@/lib/lavagestor-permissions";
import { getLavaRelatorio } from "@/lib/lavagestor-relatorios-data";

export const dynamic = "force-dynamic";

type GroupRow = Record<string, unknown>;
type AnyRow = Record<string, unknown>;

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireLavaGestorFinanceAccess("/lavagestor/relatorios");
  const params = await searchParams;
  const relatorio = await getLavaRelatorio({ inicio: firstParam(params.inicio), fim: firstParam(params.fim) });
  const lavagens = relatorio.lavagens as AnyRow[];
  const comissoes = relatorio.comissoes as AnyRow[];
  const comissoesResumo = relatorio.comissoesResumo as AnyRow[];
  const vales = relatorio.vales as AnyRow[];
  const alertas = relatorio.alertas as AnyRow[];

  return (
    <LavaGestorShell activePath="/lavagestor/relatorios" companyName={relatorio.companyName}>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <section className="grid max-w-full gap-6 overflow-x-hidden">
        <div className="report-no-print">
          <PageHeader
            eyebrow="LavaGestor"
            title="Relatórios"
            description="Fechamento completo por páginas: resumo, análises, lavagens, comissões e vales. No celular, as tabelas aparecem em cards para não quebrar."
            actions={<><BackButton href="/lavagestor" /><PrintButton label="Imprimir relatório" /><Link className="button-primary" href="/lavagestor/fila">Ver fila</Link></>}
          />
        </div>
        <MessageBanner error={relatorio.error ?? undefined} />

        <form className="report-no-print panel grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto]" action="">
          <label className="grid gap-2"><span className="text-sm font-bold">Início</span><input className="input" name="inicio" type="date" defaultValue={relatorio.filters.inicio} /></label>
          <label className="grid gap-2"><span className="text-sm font-bold">Fim</span><input className="input" name="fim" type="date" defaultValue={relatorio.filters.fim} /></label>
          <button className="button-secondary self-end" type="submit">Filtrar</button>
        </form>

        <article className="report-print grid max-w-full gap-5 overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
          <ReportPage title="Relatório do período" companyName={relatorio.companyName} filters={relatorio.filters} generatedAt={relatorio.generatedAt} page="1">
            <h3 className="report-section-title">Resumo executivo</h3>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Card label="Lavagens" value={relatorio.cards.lavagens} helper="Total do período" />
              <Card label="Pagas" value={relatorio.cards.lavagensPagas} helper="Recebidas integralmente" green />
              <Card label="Abertas / fiado" value={relatorio.cards.lavagensAbertas} helper="Precisam de cobrança" yellow />
              <Card label="Recebido" value={formatMoney(relatorio.cards.recebido)} helper="Dinheiro que entrou" green />
              <Card label="A receber" value={formatMoney(relatorio.cards.pendente)} helper="Pagamentos em aberto" yellow />
              <Card label="Faturamento bruto" value={formatMoney(relatorio.cards.entradaBruta)} helper="Valor total das lavagens" />
              <Card label="Comissões pagas" value={formatMoney(relatorio.cards.comissoesPagas)} helper="Já baixadas no período" />
              <Card label="Comissões pendentes" value={formatMoney(relatorio.cards.comissoesPendentes)} helper="Ainda a pagar" yellow />
              <Card label="Vales em aberto" value={formatMoney(relatorio.cards.valesAbertos)} helper="Adiantamentos não baixados" yellow />
              <Card label="Caixa real" value={formatMoney(relatorio.cards.caixaReal)} helper="Recebido - comissões pagas - vales baixados" green />
            </section>
            <h3 className="report-section-title">Resumo financeiro</h3>
            <Table headers={["Indicador", "Como interpretar", "Valor"]} rows={resumoFinanceiroRows(relatorio)} />
            <h3 className="report-section-title">Alertas automáticos</h3>
            <Table headers={["Alerta", "O que fazer", "Impacto"]} rows={alertas.length ? alertas.map((row) => [String(row.alerta), String(row.acao), String(row.impacto)]) : [["Sem alerta crítico", "Manter rotina atual de conferência.", "Operação saudável"]]} />
          </ReportPage>

          <ReportPage title="Análises do período" companyName={relatorio.companyName} filters={relatorio.filters} page="2">
            <h3 className="report-section-title">Por forma de pagamento</h3>
            <GroupTable headers={["Forma", "Registros", "Valor total", "Recebido", "Pendente"]} rows={relatorio.porPagamento as GroupRow[]} />
            <h3 className="report-section-title">Por funcionário</h3>
            <Table headers={["Funcionário", "Lavagens", "Faturado", "Recebido", "Com. pagas", "Com. pend.", "Vales abertos", "Saldo"]} rows={(relatorio.porFuncionario as GroupRow[]).map((row) => [String(row.label), String(row.quantidade ?? 0), formatMoney(row.valor), formatMoney(row.recebido), formatMoney(row.comissoes_pagas), formatMoney(row.comissoes_pendentes), formatMoney(row.vales_abertos), formatMoney(row.saldo_a_pagar)])} />
            <p className="text-xs font-semibold text-muted-foreground">Leitura rápida: saldo considera comissão pendente menos vales em aberto. Se ficar negativo, o funcionário ainda possui vale para descontar no próximo acerto.</p>
            <h3 className="report-section-title">Por status da lavagem</h3>
            <GroupTable headers={["Status", "Registros", "Valor", "Recebido", "Pendente"]} rows={relatorio.porStatus as GroupRow[]} />
          </ReportPage>

          <ReportPage title="Detalhamento das lavagens" companyName={relatorio.companyName} filters={relatorio.filters} page="3">
            <h3 className="report-section-title">Lavagens do período</h3>
            <Table headers={["Data", "Cliente", "Placa", "Veículo / serviço", "Func.", "Status / pag.", "Valor", "Receb."]} rows={lavagens.length ? lavagens.map((row) => [shortDate(row.data_ref), String(row.cliente || "-"), String(row.placa || "-"), `${String(row.veiculo || "-")} · ${String(row.servico || "-")}`, String(row.funcionario || "-"), `${String(row.status_label || "-")} / ${String(row.status_pagamento_label || "-")}`, formatMoney(row.valor_final ?? row.valor), formatMoney(row.valor_recebido)]) : [["-", "Nenhuma lavagem no período", "-", "-", "-", "-", formatMoney(0), formatMoney(0)]]} />
          </ReportPage>

          <ReportPage title="Comissões" companyName={relatorio.companyName} filters={relatorio.filters} page="4">
            <h3 className="report-section-title">Comissões - resumo</h3>
            <Table headers={["Funcionário", "Pagas", "Pendentes", "Canceladas", "Total válido"]} rows={comissoesResumo.length ? comissoesResumo.map((row) => [String(row.funcionario), formatMoney(row.pagas), formatMoney(row.pendentes), formatMoney(row.canceladas), formatMoney(row.total_valido)]) : [["-", formatMoney(0), formatMoney(0), formatMoney(0), formatMoney(0)]]} />
            <h3 className="report-section-title">Comissões - lançamentos</h3>
            <Table headers={["Funcionário", "Data", "Status", "Valor"]} rows={comissoes.length ? comissoes.map((row) => [String(row.funcionario || "-"), formatDate(row.pago_em ?? row.created_at), String(row.status || "-"), formatMoney(row.valor)]) : [["-", "-", "Sem lançamentos", formatMoney(0)]]} />
          </ReportPage>

          <ReportPage title="Vales e descontos" companyName={relatorio.companyName} filters={relatorio.filters} page="5">
            <h3 className="report-section-title">Vales - saldos</h3>
            <Table headers={["Funcionário", "Data", "Status", "Vale original", "Já descontado", "Saldo a debitar", "Observação"]} rows={vales.length ? vales.map((row) => [String(row.funcionario || "-"), formatDate(row.data_vale ?? row.created_at), String(row.status || "-"), formatMoney(row.valor_original ?? row.valor), formatMoney(row.valor_descontado), formatMoney(row.saldo_restante), String(row.descricao || "-")]) : [["-", "-", "Sem vales", formatMoney(0), formatMoney(0), formatMoney(0), "-"]]} />
            <h3 className="report-section-title">Histórico de abatimentos</h3>
            <div className="grid gap-3">
              {vales.length === 0 ? <Empty text="Nenhum vale no período." /> : vales.map((vale, index) => <ValeHistory key={String(vale.id ?? index)} vale={vale} />)}
            </div>
          </ReportPage>
        </article>
      </section>
    </LavaGestorShell>
  );
}

function ReportPage({ title, companyName, filters, generatedAt, page, children }: { title: string; companyName: string; filters: { inicio: string; fim: string }; generatedAt?: string; page: string; children: React.ReactNode }) {
  return <section className="report-sheet grid min-w-0 max-w-full gap-4 overflow-hidden"><header className="min-w-0 border-b border-border pb-3"><div className="grid gap-2 sm:flex sm:items-start sm:justify-between"><p className="text-sm font-black uppercase tracking-[0.14em] text-emerald-700">LavaGestor</p><p className="break-words text-xs font-semibold text-muted-foreground sm:text-right">Relatório do período - MBA Labs</p></div><h2 className="mt-5 break-words text-3xl font-black leading-tight sm:text-4xl">{title}</h2><p className="mt-2 break-words text-sm font-semibold text-muted-foreground">{companyName} · {formatDate(filters.inicio)} até {formatDate(filters.fim)}{generatedAt ? ` · Gerado em ${formatDateTime(generatedAt)}` : ""}</p></header>{children}<footer className="mt-auto grid gap-1 border-t border-border pt-3 text-xs font-semibold text-muted-foreground sm:grid-cols-3"><span>Gerado pelo LavaGestor - MBA Labs</span><span className="sm:text-center">Relatório financeiro</span><span className="sm:text-right">Página {page}</span></footer></section>;
}

function Card({ label, value, helper, green, yellow }: { label: string; value: string | number; helper: string; green?: boolean; yellow?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : yellow ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return <div className={`min-w-0 rounded-xl border p-3 ${tone}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-3 block break-words text-2xl font-black">{value}</strong><p className="mt-2 text-xs font-semibold text-muted-foreground">{helper}</p></div>;
}

function GroupTable({ headers, rows }: { headers: string[]; rows: GroupRow[] }) {
  const body = rows.length ? rows.map((row) => [String(row.label), String(row.quantidade ?? 0), formatMoney(row.valor), formatMoney(row.recebido), formatMoney(row.pendente)]) : [["Sem dados", "0", formatMoney(0), formatMoney(0), formatMoney(0)]];
  return <Table headers={headers} rows={body} />;
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="max-w-full min-w-0">
      <div className="report-table-mobile grid gap-2 md:hidden">
        {rows.map((row, index) => (
          <div className={`rounded-xl border border-border p-3 text-sm shadow-sm ${index === rows.length - 1 && rows.length > 1 ? "bg-emerald-50" : "bg-white"}`} key={index}>
            {row.map((cell, cellIndex) => (
              <div className="grid grid-cols-[minmax(90px,42%)_1fr] gap-2 border-b border-border py-2 last:border-0" key={`${index}-${cellIndex}`}>
                <span className="break-words text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{headers[cellIndex] ?? "Info"}</span>
                <span className="min-w-0 break-words text-right font-bold text-foreground">{String(cell)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="report-table-desktop hidden w-full overflow-x-auto rounded-sm border border-border md:block">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <thead><tr className="bg-emerald-700 text-white">{headers.map((header) => <th className="border border-emerald-600 px-2 py-2 font-black" key={header}>{header}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr className={index === rows.length - 1 && rows.length > 1 ? "bg-emerald-50 font-bold" : index % 2 ? "bg-slate-50" : "bg-white"} key={index}>{row.map((cell, cellIndex) => <td className={`border border-border px-2 py-2 ${cellIndex > 1 ? "text-right" : ""}`} key={`${index}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function ValeHistory({ vale }: { vale: AnyRow }) {
  const movimentos = Array.isArray(vale.movimentos) ? (vale.movimentos as AnyRow[]) : [];
  return <div className="grid min-w-0 gap-3 rounded-xl border border-border p-3"><div><h4 className="break-words text-sm font-black">{String(vale.funcionario || "Funcionário")} · vale de {formatMoney(vale.valor_original ?? vale.valor)}</h4><p className="mt-1 text-xs font-semibold text-muted-foreground">Descontado: {formatMoney(vale.valor_descontado)} · Saldo para próxima vez: {formatMoney(vale.saldo_restante)}</p></div>{movimentos.length ? <Table headers={["Data", "Valor descontado", "Saldo antes", "Saldo depois", "Observação"]} rows={movimentos.map((mov) => [formatDateTime(mov.created_at), formatMoney(mov.valor_descontado), formatMoney(mov.saldo_antes), formatMoney(mov.saldo_depois), String(mov.observacao || "-")])} /> : <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-950">Sem movimento detalhado salvo ainda. O relatório mostra o total já descontado e o saldo restante do vale.</p>}</div>;
}

function resumoFinanceiroRows(relatorio: Awaited<ReturnType<typeof getLavaRelatorio>>) {
  return [
    ["Faturamento bruto", "Tudo que foi vendido no período", formatMoney(relatorio.cards.entradaBruta)],
    ["Recebido", "Total que entrou no caixa", formatMoney(relatorio.cards.recebido)],
    ["A receber", "Lavagens em aberto/fiado", formatMoney(relatorio.cards.pendente)],
    ["Descontos", "Reduções aplicadas", formatMoney(relatorio.cards.descontos)],
    ["Comissões pagas", "Comissões já quitadas", formatMoney(relatorio.cards.comissoesPagas)],
    ["Comissões pendentes", "Comissões ainda não pagas", formatMoney(relatorio.cards.comissoesPendentes)],
    ["Vales baixados", "Vales abatidos do caixa", formatMoney(relatorio.cards.valesBaixados)],
    ["Vales em aberto", "Adiantamentos ainda em aberto", formatMoney(relatorio.cards.valesAbertos)],
    ["Caixa real do período", "Recebido - comissões pagas - vales baixados", formatMoney(relatorio.cards.caixaReal)],
    ["Saldo previsto após vales", "Caixa real - vales em aberto", formatMoney(relatorio.cards.saldoPrevistoAposVales)]
  ];
}

function Empty({ text }: { text: string }) { return <p className="rounded-xl bg-muted p-3 text-sm font-semibold text-muted-foreground">{text}</p>; }
function shortDate(value: unknown) { const date = value ? new Date(String(value)) : null; return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"; }

const printCss = `
.report-section-title { font-size: 1.25rem; font-weight: 900; margin-top: 0.5rem; }
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  body * { visibility: hidden !important; }
  .report-print, .report-print * { visibility: visible !important; }
  .report-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; gap: 0 !important; font-size: 8pt !important; overflow: visible !important; }
  .report-no-print { display: none !important; }
  .report-sheet { min-height: 276mm !important; page-break-after: always !important; break-after: page !important; padding: 0 !important; gap: 7px !important; overflow: visible !important; }
  .report-sheet:last-child { page-break-after: auto !important; break-after: auto !important; }
  .report-sheet h2 { font-size: 22pt !important; line-height: 1.05 !important; }
  .report-section-title { font-size: 13pt !important; margin-top: 5px !important; }
  .report-table-mobile { display: none !important; }
  .report-table-desktop { display: block !important; overflow: visible !important; }
  table { min-width: 0 !important; width: 100% !important; font-size: 7pt !important; }
  th, td { padding: 4px !important; }
}
`;
