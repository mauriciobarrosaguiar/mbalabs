import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { registrarPagamentoLavagem, updateLavagemStatus } from "@/lib/actions/lavagestor-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { listLavaFila } from "@/lib/lavagestor-fila-data";

export const dynamic = "force-dynamic";

const groups = [
  { title: "Na fila", statuses: ["na_fila"] },
  { title: "Em lavagem", statuses: ["em_lavagem"] },
  { title: "Finalizadas", statuses: ["aguardando_finalizacao", "finalizado"] },
  { title: "Retirada", statuses: ["cliente_avisado", "pago"] }
];

type LavaConfig = Awaited<ReturnType<typeof getLavaConfiguracoesEmpresa>>["config"];

export default async function FilaLavagemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const [{ rows, error }, { config, error: configError }] = await Promise.all([listLavaFila(), getLavaConfiguracoesEmpresa()]);

  return (
    <LavaGestorShell activePath="/lavagestor/fila" companyName={config.nome_exibicao}>
      <section className="grid max-w-full gap-6 overflow-x-hidden">
        <PageHeader eyebrow="LavaGestor" title="Fila de lavagem" description="Acompanhe cada veículo da entrada até pagamento e entrega." actions={<><BackButton href="/lavagestor" /><Link className="button-primary" href="/lavagestor/nova-lavagem">Nova lavagem</Link></>} />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? configError ?? undefined} />
        <div className="grid max-w-full gap-4 xl:grid-cols-4">
          {groups.map((group) => {
            const items = rows.filter((row) => group.statuses.includes(String(row.status)));
            return <section className="grid min-w-0 max-w-full content-start gap-3 rounded-lg border border-border bg-white p-3 shadow-sm xl:max-h-[calc(100vh-260px)] xl:overflow-y-auto" key={group.title}><div className="sticky top-0 z-[1] bg-white pb-1"><h2 className="text-lg font-black">{group.title}</h2><p className="text-sm text-muted-foreground">{items.length} lavagem(ns)</p></div>{items.length === 0 ? <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Nenhuma lavagem nesta etapa.</p> : items.map((row) => <FilaCard key={String(row.id)} row={row} config={config} />)}</section>;
          })}
        </div>
      </section>
    </LavaGestorShell>
  );
}

function FilaCard({ row, config }: { row: Record<string, unknown>; config: LavaConfig }) {
  const status = String(row.status);
  const id = String(row.id);
  const phone = phoneFromRow(row);
  const isPaid = row.status_pagamento === "pago";

  return (
    <details className="group min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-[#fbfdfc] shadow-sm">
      <summary className="grid min-w-0 cursor-pointer list-none gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <div className="grid min-w-0 grid-cols-[1fr_auto] items-start gap-2"><div className="min-w-0"><h3 className="truncate font-black" title={String(row.cliente || "Cliente")}>{String(row.cliente || "Cliente")}</h3><p className="truncate text-xs font-semibold text-muted-foreground" title={String(row.veiculo || "-")}>{String(row.veiculo || "-")}</p></div><span className="max-w-[92px] shrink-0 truncate rounded-full bg-[#dff7ec] px-2 py-1 text-center text-[11px] font-black text-[#0f5132]" title={String(row.status_label ?? status)}>{String(row.status_label ?? status)}</span></div>
        <div className="grid min-w-0 grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2"><MiniInfo label="Pagamento" value={String(row.status_pagamento_label ?? "Aberto")} /><MiniInfo label="Valor" value={formatMoney(row.valor_final ?? row.valor)} strong /><MiniInfo label="Funcionário" value={String(row.funcionario || "-")} /><MiniInfo label="Entrega" value={String(row.entrega_label || "Cliente retira")} /></div>
        <span className="text-xs font-black uppercase tracking-[0.1em] text-primary group-open:hidden">Expandir</span><span className="hidden text-xs font-black uppercase tracking-[0.1em] text-primary group-open:inline">Recolher</span>
      </summary>
      <div className="grid min-w-0 gap-4 border-t border-border p-3">
        <dl className="grid min-w-0 gap-3 text-sm"><Info label="Serviços" value={String(row.servicos_resumo || row.servico || "-")} /><Info label="WhatsApp" value={String(row.whatsapp || "Não informado")} /><Info label="Entrada" value={formatDateTime(row.data_entrada ?? row.data_lavagem)} /><Info label="Entrega" value={entregaInfo(row)} /><Info label="Observações" value={String(row.observacoes || "-")} /></dl>
        <div className="grid min-w-0 gap-2">
          {status === "na_fila" ? <><StatusButton id={id} action="iniciar" label="Iniciar lavagem" /><CancelForm id={id} reasons={config.motivos_cancelamento} /></> : null}
          {status === "em_lavagem" ? <StatusButton id={id} action="finalizar" label="Finalizar lavagem" /> : null}
          {status === "finalizado" || status === "aguardando_finalizacao" ? <>{phone ? <a className="button-secondary" href={whatsappLink(row, config)} target="_blank" rel="noreferrer">Avisar veículo finalizado</a> : <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">WhatsApp não informado para este cliente.</p>}<StatusButton id={id} action="avisar_cliente" label="Marcar cliente avisado" /><Link className="button-primary" href={`/lavagestor/pagamentos?lavagem=${id}`}>Registrar pagamento</Link><p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Recibo liberado somente após pagamento.</p></> : null}
          {status === "cliente_avisado" || status === "pago" ? <><MiniPaymentForm row={row} config={config} />{isPaid ? <Link className="button-secondary" href={`/lavagestor/recibos/${id}`}>Ver recibo</Link> : <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Registre o pagamento para liberar o recibo.</p>}{isPaid ? <StatusButton id={id} action="entregar" label={row.entrega_tipo === "levar" ? "Marcar entregue ao cliente" : "Entregar veículo"} returnTo={`/lavagestor/recibos/${id}`} /> : null}</> : null}
        </div>
      </div>
    </details>
  );
}

function MiniInfo({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="min-w-0 rounded-lg bg-muted px-2 py-2"><dt className="truncate font-black uppercase tracking-[0.08em]">{label}</dt><dd className={`mt-1 truncate ${strong ? "font-black text-foreground" : "font-semibold text-foreground"}`} title={value}>{value}</dd></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>; }
function StatusButton({ id, action, label, returnTo = "/lavagestor/fila" }: { id: string; action: string; label: string; returnTo?: string }) { return <form action={updateLavagemStatus} className="min-w-0"><input name="id" type="hidden" value={id} /><input name="acao" type="hidden" value={action} /><input name="return_to" type="hidden" value={returnTo} /><button className="button-primary w-full" type="submit">{label}</button></form>; }
function CancelForm({ id, reasons }: { id: string; reasons: string[] }) { const options = reasons.length ? reasons : ["Cliente desistiu", "Serviço lançado errado", "Outro motivo"]; return <form action={updateLavagemStatus} className="grid min-w-0 gap-2 rounded-lg border border-red-200 bg-red-50 p-3"><input name="id" type="hidden" value={id} /><input name="acao" type="hidden" value="cancelar" /><input name="return_to" type="hidden" value="/lavagestor/fila" /><label className="grid gap-2 text-sm font-bold text-red-900">Motivo do cancelamento<select className="input border-red-200 bg-white" name="motivo_cancelamento" required defaultValue=""><option value="">Selecione o motivo</option>{options.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label><button className="button-danger w-full" type="submit">Cancelar lavagem</button></form>; }
function MiniPaymentForm({ row, config }: { row: Record<string, unknown>; config: LavaConfig }) { if (row.status_pagamento === "pago") return null; return <form action={registrarPagamentoLavagem} className="grid min-w-0 gap-2"><input name="id" type="hidden" value={String(row.id)} /><input name="return_to" type="hidden" value="/lavagestor/fila" /><input name="status_pagamento" type="hidden" value="pago" /><input className="input" name="valor_recebido" placeholder="Valor recebido" type="number" min="0" step="0.01" /><select className="input" name="forma_pagamento" defaultValue={config.forma_pagamento_padrao || "pix"}><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="cartao">Cartão</option>{config.permitir_fiado ? <option value="fiado">Fiado</option> : null}</select><button className="button-primary w-full" type="submit">Registrar pagamento</button></form>; }
function whatsappLink(row: Record<string, unknown>, config: LavaConfig) { const phone = phoneFromRow(row); const vehicle = String(row.veiculo ?? "-"); const value = formatMoney(row.valor_final ?? row.valor); const entrega = entregaInfo(row); const variables: Record<string, string> = { cliente: String(row.cliente ?? ""), veiculo: vehicle, total: value, entrega, empresa: config.nome_exibicao, recibo: String(row.id ?? "").slice(0, 8).toUpperCase() }; const fallback = "Olá, {cliente}! Seu veículo/item {veiculo} está pronto. Total: {total}. {entrega}"; const text = applyTemplate(config.mensagem_veiculo_pronto || fallback, variables); return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`; }
function entregaInfo(row: Record<string, unknown>) { const entregaTipo = String(row.entrega_tipo ?? "retirar"); if (entregaTipo !== "levar") return "Cliente irá retirar"; const endereco = String(row.endereco_entrega ?? "").trim(); return endereco ? `Levar ao cliente: ${endereco}` : "Levar ao cliente"; }
function phoneFromRow(row: Record<string, unknown>) { return String(row.whatsapp ?? "").replace(/\D/g, ""); }
function applyTemplate(template: string, variables: Record<string, string>) { return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template); }
