/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { LavaPhotoCard, LavaSyncPendingButton } from "@/components/lavagestor/LavaPhotoCard";
import { PrintButton } from "@/components/lavagestor/PrintButton";
import { updateLavagemStatus } from "@/lib/actions/lavagestor-actions";
import { getLavaRecibo } from "@/lib/lavagestor-recibo-data";

export const dynamic = "force-dynamic";

type Recibo = NonNullable<Awaited<ReturnType<typeof getLavaRecibo>>["recibo"]>;

export default async function ReciboLavagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recibo, error } = await getLavaRecibo(id);

  if (!recibo) {
    return (
      <LavaGestorShell activePath="/lavagestor/fila">
        <section className="grid gap-6">
          <PageHeader eyebrow="LavaGestor" title="Recibo não encontrado" actions={<BackButton href="/lavagestor/fila" />} />
          <MessageBanner error={error ?? "Não foi possível abrir o recibo."} />
        </section>
      </LavaGestorShell>
    );
  }

  const isCanceled = recibo.status === "cancelado" || recibo.status_pagamento === "cancelado";

  if (isCanceled) {
    return <CanceledReceipt recibo={recibo} error={error ?? undefined} />;
  }

  if (recibo.status_pagamento !== "pago") {
    return <BlockedReceipt recibo={recibo} reason="pagamento" />;
  }

  if (!recibo.empresa.permitir_recibo_sem_checklist && recibo.checklist?.status !== "concluido") {
    return <BlockedReceipt recibo={recibo} reason="checklist" />;
  }

  return (
    <LavaGestorShell activePath="/lavagestor/fila" companyName={recibo.empresa.nome}>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <section className="grid max-w-full gap-6 overflow-x-hidden">
        <div className="receipt-no-print">
          <PageHeader
            eyebrow="LavaGestor"
            title={`Recibo ${recibo.numero}`}
            description="Recibo profissional para imprimir ou salvar em PDF. O envio ao cliente é feito automaticamente pela API do WhatsApp quando configurada."
            actions={<><BackButton href="/lavagestor/fila" /><PrintButton /></>}
          />
        </div>
        <MessageBanner error={error ?? undefined} />

        <article className="receipt-print mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-emerald-100 bg-white text-[#10201a] shadow-sm">
          <header className="grid gap-4 border-b border-emerald-100 p-5 sm:grid-cols-[1fr_auto] sm:p-7">
            <div className="flex items-center gap-4">
              {recibo.empresa.logo_url ? <img className="h-16 w-16 rounded-xl object-contain" src={recibo.empresa.logo_url} alt={recibo.empresa.nome} /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-emerald-50 text-3xl">🚗</div>}
              <div>
                <h2 className="text-3xl font-black text-emerald-950">{recibo.empresa.nome}</h2>
                <p className="text-sm font-bold text-slate-600">Powered by LavaGestor</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{[recibo.empresa.cnpj, recibo.empresa.telefone, recibo.empresa.cidade_uf].filter(Boolean).join(" - ")}</p>
              </div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 text-left sm:text-right">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">Recibo de serviço</p>
              <p className="mt-2 text-2xl font-black">Nº {recibo.numero}</p>
              <p className="text-sm font-semibold text-slate-600">{formatDateTime(recibo.data_entrada)}</p>
            </div>
          </header>

          <section className="grid gap-0 border-b border-emerald-100 p-5 sm:grid-cols-4 sm:p-7">
            <Info icon="👤" label="Cliente" value={recibo.cliente} sub={recibo.empresa.cidade_uf} />
            <Info icon="🟢" label="WhatsApp" value={recibo.whatsapp || "Não informado"} />
            <Info icon="🚘" label="Veículo / item" value={recibo.veiculo} />
            <Info icon="💧" label="Lavador" value={recibo.funcionario} />
          </section>

          <section className="grid gap-0 border-b border-emerald-100 p-5 sm:grid-cols-4 sm:p-7">
            <Info icon="↪" label="Entrada" value={formatDateTime(recibo.data_entrada)} />
            <Info icon="🏁" label="Finalização" value={formatDateTime(recibo.data_finalizacao)} />
            <Info icon="💳" label="Pagamento" value={paymentLabel(recibo)} />
            <Info icon="✅" label="Entrega" value={deliveryLabel(recibo)} />
          </section>

          <section className="grid gap-3 p-5 sm:p-7">
            <SectionTitle icon="🧼" title="Serviços" />
            <div className="overflow-hidden rounded-xl border border-emerald-100">
              <div className="grid grid-cols-[1fr_auto] bg-emerald-50 px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-emerald-900"><span>Descrição</span><span>Valor</span></div>
              {recibo.servicos.length === 0 ? <div className="px-4 py-3 text-sm font-semibold text-slate-600">Nenhum serviço detalhado.</div> : null}
              {recibo.servicos.map((servico) => <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-emerald-100 px-4 py-3 text-sm" key={servico.id}><span className="font-bold">{servico.descricao}</span><strong>{formatMoney(servico.valor)}</strong></div>)}
            </div>
          </section>

          <section className="grid gap-5 p-5 pt-0 lg:grid-cols-[1fr_0.95fr] sm:p-7 sm:pt-0">
            <ChecklistSection recibo={recibo} />
            <aside className="grid content-start gap-4">
              <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <div className="bg-emerald-800 px-4 py-4 text-white"><SectionTitle icon="💲" title="Resumo financeiro" light /></div>
                <div className="grid gap-3 p-4">
                  <MoneyLine label="Total bruto" value={recibo.valor_total} />
                  <MoneyLine label="Desconto" value={recibo.valor_desconto} />
                  <div className="my-1 border-t border-dashed border-slate-200" />
                  <MoneyLine label="Total final" value={recibo.valor_final} strong />
                  <MoneyLine label="Valor recebido" value={recibo.valor_recebido} positive />
                  <MoneyLine label="Valor pendente" value={recibo.valor_pendente} danger={recibo.valor_pendente > 0} />
                  <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-black text-emerald-900">Valor recebido integralmente.</p>
                </div>
              </section>
              {recibo.pagamentos.length > 0 ? <section className="grid gap-3"><SectionTitle icon="💳" title="Pagamentos" />{recibo.pagamentos.map((pagamento) => <div className="rounded-xl border border-emerald-100 p-3 text-sm" key={pagamento.id}><strong>{formatMoney(pagamento.valor)}</strong><span className="ml-2 text-slate-600">{pagamento.forma_pagamento} - {formatDateTime(pagamento.data_pagamento)}</span></div>)}</section> : null}
            </aside>
          </section>

          {recibo.observacoes ? <div className="px-5 pb-5 sm:px-7"><Info icon="📝" label="Observações" value={recibo.observacoes} /></div> : null}
          <footer className="border-t border-emerald-100 bg-emerald-900 px-5 py-4 text-center text-sm font-bold text-white sm:px-7"><p>Obrigado pela preferência.</p><p className="text-xs font-semibold opacity-90">Recibo gerado pelo LavaGestor - MBA Labs</p></footer>
        </article>

        <div className="receipt-no-print">
          {recibo.status !== "entregue" ? <form action={updateLavagemStatus} className="mx-auto grid w-full max-w-3xl gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><input name="id" type="hidden" value={recibo.id} /><input name="acao" type="hidden" value="entregar" /><input name="return_to" type="hidden" value={`/lavagestor/recibos/${recibo.id}`} /><button className="button-primary" type="submit">{recibo.entrega_tipo === "levar" ? "Marcar entregue ao cliente" : "Marcar veículo retirado"}</button></form> : <div className="mx-auto w-full max-w-3xl rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-black text-emerald-950">Entrega concluída em {formatDateTime(recibo.data_entrega)}.</div>}
        </div>
      </section>
    </LavaGestorShell>
  );
}

function CanceledReceipt({ recibo, error }: { recibo: Recibo; error?: string }) {
  return (
    <LavaGestorShell activePath="/lavagestor/fila" companyName={recibo.empresa.nome}>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <section className="grid gap-6">
        <div className="receipt-no-print">
          <PageHeader eyebrow="LavaGestor" title={`Registro ${recibo.numero}`} description="Lavagem cancelada. Sem cobrança e sem recibo financeiro." actions={<><BackButton href="/lavagestor/fila" /><PrintButton /></>} />
        </div>
        <MessageBanner error={error} />
        <article className="receipt-print mx-auto grid w-full max-w-2xl gap-5 rounded-2xl border border-red-200 bg-white p-6 text-[#10201a] shadow-sm">
          <header className="border-b border-red-100 pb-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Registro cancelado</p>
            <h2 className="mt-2 text-3xl font-black">{recibo.empresa.nome}</h2>
            <p className="text-sm font-semibold text-slate-600">Nº {recibo.numero} · {formatDateTime(recibo.data_entrada)}</p>
          </header>
          <div className="rounded-2xl bg-red-50 p-5 text-center text-3xl font-black uppercase text-red-700">Cancelado</div>
          <section className="grid gap-3 sm:grid-cols-2">
            <Info icon="👤" label="Cliente" value={recibo.cliente} />
            <Info icon="🟢" label="WhatsApp" value={recibo.whatsapp || "Não informado"} />
            <Info icon="🚘" label="Veículo / item" value={recibo.veiculo} />
            <Info icon="📅" label="Entrada" value={formatDateTime(recibo.data_entrada)} />
          </section>
          <footer className="border-t border-red-100 pt-3 text-center text-xs font-bold text-slate-500">Registro mantido somente para histórico. Sem cobrança.</footer>
        </article>
      </section>
    </LavaGestorShell>
  );
}

function BlockedReceipt({ recibo, reason }: { recibo: Recibo; reason: "pagamento" | "checklist" }) {
  const isPayment = reason === "pagamento";
  return (
    <LavaGestorShell activePath="/lavagestor/fila" companyName={recibo.empresa.nome}>
      <section className="grid gap-6">
        <PageHeader eyebrow="LavaGestor" title="Recibo bloqueado" description={isPayment ? "O recibo só é liberado depois que o pagamento for registrado." : "A empresa exige checklist concluído antes de emitir recibo."} actions={<BackButton href="/lavagestor/fila" />} />
        <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <h2 className="text-2xl font-black">{isPayment ? "Pagamento ainda não foi feito" : "Checklist pendente"}</h2>
          <p className="text-sm font-semibold leading-6">{isPayment ? "Registre o pagamento primeiro. Depois o sistema libera imprimir e salvar o recibo. O envio ao cliente é automático pela API quando o WhatsApp estiver configurado." : "Conclua o checklist de entrada para liberar o recibo desta lavagem."}</p>
          <div className="flex flex-wrap gap-2">
            {isPayment ? <Link className="button-primary" href={`/lavagestor/pagamentos?lavagem=${recibo.id}`}>Registrar pagamento</Link> : <Link className="button-primary" href={`/lavagestor/checklists/${recibo.id}`}>Abrir checklist</Link>}
            <BackButton href="/lavagestor/fila" />
          </div>
        </div>
      </section>
    </LavaGestorShell>
  );
}

function ChecklistSection({ recibo }: { recibo: Recibo }) {
  const entradaFotos = recibo.checklist_fotos_entrada ?? [];
  const checkoutFotos = recibo.checklist_fotos_checkout ?? [];
  return (
    <section className="grid content-start gap-3">
      <SectionTitle icon="📷" title="Checklist e fotos" />
      {recibo.checklist ? (
        <div className="grid gap-3 rounded-2xl border border-emerald-100 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3">
            <p className="text-sm font-black text-emerald-950">Status: {String(recibo.checklist.status)}</p>
            <LavaSyncPendingButton compact lavagemId={recibo.id} returnTo={`/lavagestor/recibos/${recibo.id}`} />
          </div>
          {recibo.checklist_avarias.length ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-950">{recibo.checklist_avarias.join(" - ")}</p> : <p className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600">Sem avarias marcadas.</p>}
          <PhotoGroup returnTo={`/lavagestor/recibos/${recibo.id}`} title="Antes" fotos={entradaFotos} />
          <PhotoGroup returnTo={`/lavagestor/recibos/${recibo.id}`} title="Depois" fotos={checkoutFotos} />
        </div>
      ) : <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-950">Lavagem sem checklist registrado.</p>}
    </section>
  );
}

function PhotoGroup({ title, fotos, returnTo }: { title: string; fotos: Record<string, unknown>[]; returnTo: string }) {
  if (!fotos.length) return <p className="rounded-lg bg-slate-50 p-2 text-xs font-bold text-slate-600">{title}: sem fotos.</p>;
  return (
    <div className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{title}</p>
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
        {fotos.slice(0, 4).map((foto, index) => (
          <LavaPhotoCard className="w-[min(76vw,18rem)] shrink-0 snap-start sm:w-64" compact foto={foto} gallery={fotos.slice(0, 4)} galleryIndex={index} key={String(foto.id)} returnTo={returnTo} subtitle={title} title={String(foto.legenda || foto.tipo)} />
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, light = false }: { icon: string; title: string; light?: boolean }) { return <h3 className={`flex items-center gap-2 text-lg font-black uppercase tracking-[0.08em] ${light ? "text-white" : "text-emerald-900"}`}><span>{icon}</span>{title}</h3>; }
function Info({ icon, label, value, sub }: { icon?: string; label: string; value: string; sub?: string }) { return <div className="receipt-info border-slate-100 p-3 sm:border-r"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-800"><span>{icon}</span>{label}</p><p className="mt-2 break-words text-base font-black">{value}</p>{sub ? <p className="text-sm font-semibold text-slate-600">{sub}</p> : null}</div>; }
function MoneyLine({ label, value, strong = false, positive = false, danger = false }: { label: string; value: number; strong?: boolean; positive?: boolean; danger?: boolean }) { return <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-600">{label}</span><strong className={`${strong ? "text-2xl text-emerald-800" : "text-sm"} ${positive ? "text-emerald-700" : ""} ${danger ? "text-red-600" : ""}`}>{formatMoney(value)}</strong></div>; }
function paymentLabel(recibo: Recibo) { return ["Pago", recibo.forma_pagamento].filter(Boolean).join(" - "); }
function deliveryLabel(recibo: Recibo) { if (recibo.entrega_tipo === "levar") return recibo.endereco_entrega ? `Levar ao cliente: ${recibo.endereco_entrega}` : "Levar ao cliente"; return "Cliente retira"; }

const printCss = `
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  html, body { background: #ffffff !important; }
  body * { visibility: hidden !important; }
  .receipt-print, .receipt-print * { visibility: visible !important; }
  .receipt-print {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    font-size: 9pt !important;
  }
  .receipt-no-print { display: none !important; }
  .receipt-print h2 { font-size: 22pt !important; line-height: 1.05 !important; }
  .receipt-print p { margin: 0 !important; }
  .receipt-info { padding: 5px !important; }
}
`;
