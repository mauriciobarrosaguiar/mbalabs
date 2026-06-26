import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { PrintButton } from "@/components/lavagestor/PrintButton";
import { updateLavagemStatus } from "@/lib/actions/lavagestor-actions";
import { getLavaRecibo } from "@/lib/lavagestor-recibo-data";

export const dynamic = "force-dynamic";

type Recibo = NonNullable<Awaited<ReturnType<typeof getLavaRecibo>>["recibo"]>;

export default async function ReciboLavagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recibo, error } = await getLavaRecibo(id);

  if (!recibo) {
    return <LavaGestorShell activePath="/lavagestor/fila"><section className="grid gap-6"><PageHeader eyebrow="LavaGestor" title="Recibo não encontrado" actions={<BackButton href="/lavagestor/fila" />} /><MessageBanner error={error ?? "Não foi possível abrir o recibo."} /></section></LavaGestorShell>;
  }

  if (recibo.status_pagamento !== "pago") {
    return (
      <LavaGestorShell activePath="/lavagestor/fila">
        <section className="grid gap-6">
          <PageHeader eyebrow="LavaGestor" title="Recibo bloqueado" description="O recibo só é liberado depois que o pagamento for registrado." actions={<BackButton href="/lavagestor/fila" />} />
          <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
            <h2 className="text-2xl font-black">Pagamento ainda não foi feito</h2>
            <p className="text-sm font-semibold leading-6">Para evitar recibo de serviço não pago, registre o pagamento primeiro. Depois o sistema libera imprimir, salvar em PDF e enviar o comprovante pelo WhatsApp.</p>
            <div className="flex flex-wrap gap-2">
              <Link className="button-primary" href={`/lavagestor/pagamentos?lavagem=${recibo.id}`}>Registrar pagamento</Link>
              <BackButton href="/lavagestor/fila" />
            </div>
          </div>
        </section>
      </LavaGestorShell>
    );
  }

  return (
    <LavaGestorShell activePath="/lavagestor/fila">
      <section className="grid max-w-full gap-6 overflow-x-hidden">
        <PageHeader
          eyebrow="LavaGestor"
          title={`Recibo ${recibo.numero}`}
          description="Comprovante da lavagem para imprimir, salvar em PDF ou enviar os dados ao cliente."
          actions={<><BackButton href="/lavagestor/fila" /><PrintButton />{recibo.whatsapp ? <a className="button-primary print:hidden" href={whatsappReciboLink(recibo)} target="_blank" rel="noreferrer">Enviar comprovante</a> : null}</>}
        />
        <MessageBanner error={error ?? undefined} />

        <article className="mx-auto grid w-full max-w-3xl gap-5 rounded-xl border border-border bg-white p-5 text-[#10201a] shadow-sm print:border-0 print:shadow-none">
          <header className="grid gap-3 border-b border-border pb-4 sm:grid-cols-[1fr_auto]"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Recibo de serviço</p><h2 className="mt-1 text-2xl font-black">{recibo.empresa.nome}</h2>{recibo.empresa.razao_social ? <p className="text-sm font-semibold text-slate-600">{recibo.empresa.razao_social}</p> : null}<p className="text-sm text-slate-600">{[recibo.empresa.cnpj, recibo.empresa.telefone, recibo.empresa.cidade_uf].filter(Boolean).join(" · ")}</p></div><div className="rounded-lg bg-emerald-50 p-3 text-left sm:text-right"><p className="text-xs font-black uppercase text-emerald-800">Nº</p><p className="text-xl font-black">{recibo.numero}</p><p className="text-xs font-semibold text-slate-600">{formatDateTime(recibo.data_entrada)}</p></div></header>
          <section className="grid gap-3 sm:grid-cols-2"><Info label="Cliente" value={recibo.cliente} /><Info label="WhatsApp" value={recibo.whatsapp || "Não informado"} /><Info label="Veículo / item" value={recibo.veiculo} /><Info label="Lavador" value={recibo.funcionario} /><Info label="Entrada" value={formatDateTime(recibo.data_entrada)} /><Info label="Finalização" value={formatDateTime(recibo.data_finalizacao)} /><Info label="Pagamento" value={paymentLabel(recibo)} /><Info label="Entrega" value={deliveryLabel(recibo)} /></section>
          <section className="grid gap-2"><h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Serviços</h3><div className="grid gap-2">{recibo.servicos.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">Nenhum serviço detalhado.</p> : recibo.servicos.map((servico) => <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3" key={servico.id}><span className="font-semibold">{servico.descricao}</span><strong>{formatMoney(servico.valor)}</strong></div>)}</div></section>
          <section className="grid gap-2 rounded-lg bg-slate-50 p-4"><MoneyLine label="Total bruto" value={recibo.valor_total} /><MoneyLine label="Desconto" value={recibo.valor_desconto} /><MoneyLine label="Total final" value={recibo.valor_final} strong /><MoneyLine label="Valor recebido" value={recibo.valor_recebido} /><MoneyLine label="Valor pendente" value={recibo.valor_pendente} /></section>
          {recibo.pagamentos.length > 0 ? <section className="grid gap-2"><h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Pagamentos</h3>{recibo.pagamentos.map((pagamento) => <div className="rounded-lg border border-border p-3 text-sm" key={pagamento.id}><strong>{formatMoney(pagamento.valor)}</strong><span className="ml-2 text-slate-600">{pagamento.forma_pagamento} · {formatDateTime(pagamento.data_pagamento)}</span></div>)}</section> : null}
          {recibo.observacoes ? <Info label="Observações" value={recibo.observacoes} /> : null}
          <footer className="grid gap-3 border-t border-border pt-4 text-center text-xs font-semibold text-slate-500"><p>Obrigado pela preferência.</p><p>Recibo gerado pelo LavaGestor · MBA Labs</p></footer>
        </article>

        {recibo.status !== "entregue" ? <form action={updateLavagemStatus} className="mx-auto grid w-full max-w-3xl gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 print:hidden"><input name="id" type="hidden" value={recibo.id} /><input name="acao" type="hidden" value="entregar" /><input name="return_to" type="hidden" value={`/lavagestor/recibos/${recibo.id}`} /><button className="button-primary" type="submit">{recibo.entrega_tipo === "levar" ? "Marcar entregue ao cliente" : "Marcar veículo retirado"}</button></form> : <div className="mx-auto w-full max-w-3xl rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-black text-emerald-950 print:hidden">Entrega concluída em {formatDateTime(recibo.data_entrega)}.</div>}
      </section>
    </LavaGestorShell>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{label}</p><p className="mt-1 break-words font-bold">{value}</p></div>; }
function MoneyLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) { return <div className="flex items-center justify-between gap-3"><span className="font-semibold text-slate-600">{label}</span><strong className={strong ? "text-xl" : ""}>{formatMoney(value)}</strong></div>; }
function paymentLabel(recibo: Recibo) { return ["Pago", recibo.forma_pagamento].filter(Boolean).join(" · "); }
function deliveryLabel(recibo: Recibo) { if (recibo.entrega_tipo === "levar") return recibo.endereco_entrega ? `Levar ao cliente: ${recibo.endereco_entrega}` : "Levar ao cliente"; return "Cliente retira"; }
function whatsappReciboLink(recibo: Recibo) { const phone = String(recibo.whatsapp ?? "").replace(/\D/g, ""); const servicos = recibo.servicos.map((item) => `- ${item.descricao}: ${formatMoney(item.valor)}`).join("\n"); const texto = `Olá, ${recibo.cliente}! Segue o comprovante da lavagem.\n\nRecibo: ${recibo.numero}\nVeículo/item: ${recibo.veiculo}\nServiços:\n${servicos || "-"}\n\nTotal pago: ${formatMoney(recibo.valor_final)}\nPagamento: ${paymentLabel(recibo)}\nEntrega: ${deliveryLabel(recibo)}\n\nObrigado pela preferência!`; return `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`; }
