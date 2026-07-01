import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { PrintButton } from "@/components/lavagestor/PrintButton";
import { ReceiptImageShareButton, type ReceiptImageData } from "@/components/lavagestor/ReceiptImageShareButton";
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
          <PageHeader eyebrow="LavaGestor" title="Recibo nao encontrado" actions={<BackButton href="/lavagestor/fila" />} />
          <MessageBanner error={error ?? "Nao foi possivel abrir o recibo."} />
        </section>
      </LavaGestorShell>
    );
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
            description="Comprovante da lavagem para imprimir, salvar em PDF ou enviar como imagem ao cliente."
            actions={<><BackButton href="/lavagestor/fila" /><PrintButton /><ReceiptImageShareButton receipt={receiptImageData(recibo)} /></>}
          />
        </div>
        <MessageBanner error={error ?? undefined} />

        <article className="receipt-print mx-auto grid w-full max-w-3xl gap-4 rounded-xl border border-border bg-white p-5 text-[#10201a] shadow-sm">
          <header className="grid gap-3 border-b border-border pb-3 sm:grid-cols-[1fr_auto]">
            <div>
              {recibo.empresa.logo_url ? <img className="mb-2 max-h-16 max-w-40 object-contain" src={recibo.empresa.logo_url} alt={recibo.empresa.nome} /> : null}
              <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: recibo.empresa.cor_principal }}>Recibo de servico</p>
              <h2 className="mt-1 text-2xl font-black">{recibo.empresa.nome}</h2>
              {recibo.empresa.razao_social ? <p className="text-sm font-semibold text-slate-600">{recibo.empresa.razao_social}</p> : null}
              <p className="text-sm text-slate-600">{[recibo.empresa.cnpj, recibo.empresa.telefone, recibo.empresa.cidade_uf].filter(Boolean).join(" - ")}</p>
              {recibo.empresa.endereco ? <p className="text-sm text-slate-600">{recibo.empresa.endereco}</p> : null}
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-left sm:text-right">
              <p className="text-xs font-black uppercase text-emerald-800">Numero</p>
              <p className="text-xl font-black">{recibo.numero}</p>
              <p className="text-xs font-semibold text-slate-600">{formatDateTime(recibo.data_entrada)}</p>
            </div>
          </header>

          <section className="grid gap-2 sm:grid-cols-2">
            <Info label="Cliente" value={recibo.cliente} />
            <Info label="WhatsApp" value={recibo.whatsapp || "Nao informado"} />
            <Info label="Veiculo / item" value={recibo.veiculo} />
            <Info label="Lavador" value={recibo.funcionario} />
            <Info label="Entrada" value={formatDateTime(recibo.data_entrada)} />
            <Info label="Finalizacao" value={formatDateTime(recibo.data_finalizacao)} />
            <Info label="Pagamento" value={paymentLabel(recibo)} />
            <Info label="Entrega" value={deliveryLabel(recibo)} />
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Servicos</h3>
            <div className="grid gap-2">
              {recibo.servicos.length === 0 ? <p className="rounded-lg bg-slate-50 p-2 text-sm font-semibold text-slate-600">Nenhum servico detalhado.</p> : null}
              {recibo.servicos.map((servico) => <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-2" key={servico.id}><span className="font-semibold">{servico.descricao}</span><strong>{formatMoney(servico.valor)}</strong></div>)}
            </div>
          </section>

          <ChecklistSection recibo={recibo} />

          <section className="grid gap-1 rounded-lg bg-slate-50 p-3">
            <MoneyLine label="Total bruto" value={recibo.valor_total} />
            <MoneyLine label="Desconto" value={recibo.valor_desconto} />
            <MoneyLine label="Total final" value={recibo.valor_final} strong />
            <MoneyLine label="Valor recebido" value={recibo.valor_recebido} />
            <MoneyLine label="Valor pendente" value={recibo.valor_pendente} />
          </section>

          {recibo.pagamentos.length > 0 ? <section className="grid gap-2"><h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Pagamentos</h3>{recibo.pagamentos.map((pagamento) => <div className="rounded-lg border border-border p-2 text-sm" key={pagamento.id}><strong>{formatMoney(pagamento.valor)}</strong><span className="ml-2 text-slate-600">{pagamento.forma_pagamento} - {formatDateTime(pagamento.data_pagamento)}</span></div>)}</section> : null}
          {recibo.observacoes ? <Info label="Observacoes" value={recibo.observacoes} /> : null}
          <footer className="grid gap-1 border-t border-border pt-3 text-center text-xs font-semibold text-slate-500"><p>Obrigado pela preferencia.</p><p>Recibo gerado pelo LavaGestor - MBA Labs</p></footer>
        </article>

        <div className="receipt-no-print">
          {recibo.status !== "entregue" ? <form action={updateLavagemStatus} className="mx-auto grid w-full max-w-3xl gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><input name="id" type="hidden" value={recibo.id} /><input name="acao" type="hidden" value="entregar" /><input name="return_to" type="hidden" value={`/lavagestor/recibos/${recibo.id}`} /><button className="button-primary" type="submit">{recibo.entrega_tipo === "levar" ? "Marcar entregue ao cliente" : "Marcar veiculo retirado"}</button></form> : <div className="mx-auto w-full max-w-3xl rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-black text-emerald-950">Entrega concluida em {formatDateTime(recibo.data_entrega)}.</div>}
        </div>
      </section>
    </LavaGestorShell>
  );
}

function BlockedReceipt({ recibo, reason }: { recibo: Recibo; reason: "pagamento" | "checklist" }) {
  const isPayment = reason === "pagamento";
  return (
    <LavaGestorShell activePath="/lavagestor/fila" companyName={recibo.empresa.nome}>
      <section className="grid gap-6">
        <PageHeader eyebrow="LavaGestor" title="Recibo bloqueado" description={isPayment ? "O recibo so e liberado depois que o pagamento for registrado." : "A empresa exige checklist concluido antes de emitir recibo."} actions={<BackButton href="/lavagestor/fila" />} />
        <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
          <h2 className="text-2xl font-black">{isPayment ? "Pagamento ainda nao foi feito" : "Checklist pendente"}</h2>
          <p className="text-sm font-semibold leading-6">{isPayment ? "Registre o pagamento primeiro. Depois o sistema libera imprimir, salvar em PDF e enviar o recibo como imagem pelo WhatsApp." : "Conclua o checklist de entrada para liberar o recibo desta lavagem."}</p>
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
    <section className="grid gap-2">
      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Checklist e fotos</h3>
      {recibo.checklist ? (
        <div className="grid gap-2">
          <p className="rounded-lg bg-emerald-50 p-2 text-sm font-black text-emerald-950">Status: {String(recibo.checklist.status)}</p>
          {recibo.checklist_avarias.length ? <p className="rounded-lg bg-amber-50 p-2 text-sm font-bold text-amber-950">{recibo.checklist_avarias.join(" - ")}</p> : <p className="rounded-lg bg-slate-50 p-2 text-sm font-semibold text-slate-600">Sem avarias marcadas.</p>}
          <PhotoGroup title="Antes" fotos={entradaFotos} />
          <PhotoGroup title="Depois" fotos={checkoutFotos} />
        </div>
      ) : (
        <p className="rounded-lg bg-amber-50 p-2 text-sm font-bold text-amber-950">Lavagem sem checklist registrado.</p>
      )}
    </section>
  );
}

function PhotoGroup({ title, fotos }: { title: string; fotos: Record<string, unknown>[] }) {
  if (!fotos.length) {
    return <p className="rounded-lg bg-slate-50 p-2 text-xs font-bold text-slate-600">{title}: sem fotos.</p>;
  }

  return (
    <div className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{title}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {fotos.slice(0, 3).map((foto) => (
          <figure className="overflow-hidden rounded-lg border border-border" key={String(foto.id)}>
            {foto.signed_url ? <img className="aspect-[4/3] w-full object-cover" src={String(foto.signed_url)} alt={String(foto.legenda || foto.tipo)} /> : null}
            <figcaption className="p-2 text-xs font-bold text-slate-600">{String(foto.legenda || foto.tipo)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="receipt-info rounded-lg bg-slate-50 p-2"><p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold">{value}</p></div>; }
function MoneyLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) { return <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-600">{label}</span><strong className={strong ? "text-lg" : "text-sm"}>{formatMoney(value)}</strong></div>; }
function paymentLabel(recibo: Recibo) { return ["Pago", recibo.forma_pagamento].filter(Boolean).join(" - "); }
function deliveryLabel(recibo: Recibo) { if (recibo.entrega_tipo === "levar") return recibo.endereco_entrega ? `Levar ao cliente: ${recibo.endereco_entrega}` : "Levar ao cliente"; return "Cliente retira"; }
function receiptImageData(recibo: Recibo): ReceiptImageData { return { numero: recibo.numero, empresaNome: recibo.empresa.nome, empresaRazao: recibo.empresa.razao_social ?? undefined, empresaInfo: [recibo.empresa.cnpj, recibo.empresa.telefone, recibo.empresa.cidade_uf, recibo.empresa.endereco].filter(Boolean).join(" - "), corPrincipal: recibo.empresa.cor_principal ?? undefined, cliente: recibo.cliente, whatsapp: recibo.whatsapp || "Nao informado", veiculo: recibo.veiculo, lavador: recibo.funcionario, entrada: formatDateTime(recibo.data_entrada), finalizacao: formatDateTime(recibo.data_finalizacao), pagamento: paymentLabel(recibo), entrega: deliveryLabel(recibo), servicos: recibo.servicos.map((servico) => ({ descricao: servico.descricao, valor: formatMoney(servico.valor) })), totalBruto: formatMoney(recibo.valor_total), desconto: formatMoney(recibo.valor_desconto), totalFinal: formatMoney(recibo.valor_final), valorRecebido: formatMoney(recibo.valor_recebido), valorPendente: formatMoney(recibo.valor_pendente), pagamentos: recibo.pagamentos.map((pagamento) => `${formatMoney(pagamento.valor)} ${pagamento.forma_pagamento} - ${formatDateTime(pagamento.data_pagamento)}`) }; }

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
    padding: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    gap: 6px !important;
    font-size: 9pt !important;
    page-break-inside: avoid !important;
  }
  .receipt-no-print { display: none !important; }
  .receipt-print header { padding-bottom: 6px !important; }
  .receipt-print h2 { font-size: 18pt !important; line-height: 1.05 !important; }
  .receipt-print p { margin: 0 !important; }
  .receipt-info { padding: 5px !important; }
  .receipt-print section { gap: 4px !important; }
  .receipt-print footer { padding-top: 6px !important; }
}
`;
