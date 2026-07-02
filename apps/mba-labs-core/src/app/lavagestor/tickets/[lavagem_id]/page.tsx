import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { LavaPhotoCard, LavaSyncPendingButton } from "@/components/lavagestor/LavaPhotoCard";
import { PrintButton } from "@/components/lavagestor/PrintButton";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { getLavaTicket, whatsappUrl } from "@/lib/lavagestor-phase2-data";

export const dynamic = "force-dynamic";

type Ticket = NonNullable<Awaited<ReturnType<typeof getLavaTicket>>["ticket"]>;

export default async function LavaTicketPage({ params }: { params: Promise<{ lavagem_id: string }> }) {
  const { lavagem_id: lavagemId } = await params;
  const { ticket, error } = await getLavaTicket(lavagemId);

  if (!ticket) {
    return (
      <LavaGestorShell activePath="/lavagestor/fila">
        <section className="grid gap-5">
          <PageHeader eyebrow="LavaGestor" title="Ticket nao encontrado" actions={<BackButton href="/lavagestor/fila" />} />
          <MessageBanner error={error ?? "Nao foi possivel abrir o ticket."} />
        </section>
      </LavaGestorShell>
    );
  }

  const message = ticketMessage(ticket);
  const waUrl = whatsappUrl(ticket.whatsapp, message);

  return (
    <LavaGestorShell activePath="/lavagestor/fila" companyName={ticket.empresa.nome}>
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      <section className="grid gap-6">
        <div className="ticket-no-print">
          <PageHeader
            eyebrow="LavaGestor"
            title={`Ticket ${ticket.numero}`}
            description="Ordem de servico de entrada, liberada mesmo antes do pagamento."
            actions={
              <>
                <BackButton href="/lavagestor/fila" />
                <Link className="button-secondary" href={`/lavagestor/checklists/${ticket.id}`}>Checklist</Link>
                <PrintButton label="Imprimir / PDF" />
                {waUrl ? <a className="button-primary" href={waUrl} target="_blank" rel="noreferrer">Enviar WhatsApp</a> : null}
              </>
            }
          />
        </div>
        <MessageBanner error={error ?? undefined} />

        <article className="ticket-print mx-auto grid w-full max-w-4xl gap-4 rounded-lg border border-border bg-white p-5 text-[#10201a] shadow-sm">
          <header className="grid gap-4 border-b border-border pb-4 sm:grid-cols-[1fr_auto]">
            <div>
              {ticket.empresa.logo_url ? <img alt={ticket.empresa.nome} className="mb-3 max-h-20 max-w-44 object-contain" src={ticket.empresa.logo_url} /> : null}
              <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: ticket.empresa.cor_principal }}>Ticket de entrada</p>
              <h2 className="mt-1 text-3xl font-black">{ticket.empresa.nome}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">{[ticket.empresa.documento, ticket.empresa.whatsapp].filter(Boolean).join(" - ")}</p>
              {ticket.empresa.endereco ? <p className="text-sm text-slate-600">{ticket.empresa.endereco}</p> : null}
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 sm:text-right">
              <p className="text-xs font-black uppercase text-emerald-800">Numero</p>
              <p className="text-2xl font-black">{ticket.numero}</p>
              <p className="mt-1 text-xs font-bold text-slate-600">{formatDateTime(ticket.data_entrada)}</p>
            </div>
          </header>

          <section className="grid gap-2 sm:grid-cols-2">
            <Info label="Cliente" value={ticket.cliente} />
            <Info label="Telefone" value={ticket.whatsapp || "Nao informado"} />
            <Info label="Veiculo / item" value={ticket.veiculo} />
            <Info label="Placa" value={ticket.placa || "Sem placa"} />
            <Info label="Marca / modelo / cor" value={[ticket.marca, ticket.modelo, ticket.cor].filter(Boolean).join(" - ") || "-"} />
            <Info label="Forma de entrega" value={deliveryLabel(ticket)} />
            <Info label="Entrada" value={formatDateTime(ticket.data_entrada)} />
            <Info label="Status do pagamento" value={ticket.status_pagamento} />
          </section>

          <section className="grid gap-2">
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Servicos</h3>
            {ticket.servicos.map((servico, index) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-2" key={`${servico.descricao}-${index}`}>
                <span className="font-semibold">{servico.descricao}</span>
                <strong>{formatMoney(servico.valor)}</strong>
              </div>
            ))}
          </section>

          <section className="grid gap-1 rounded-lg bg-slate-50 p-3">
            <MoneyLine label="Valor previsto" value={ticket.valor_total} />
            <MoneyLine label="Desconto" value={ticket.valor_desconto} />
            <MoneyLine label="Total previsto" value={ticket.valor_final} strong />
          </section>

          <section className="grid gap-3">
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-slate-500">Checklist de entrada</h3>
            {!ticket.checklist ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-black text-amber-950">Lavagem sem checklist registrado.</p>
            ) : (
              <div className="grid gap-2">
                <p className="rounded-lg bg-emerald-50 p-3 text-sm font-black text-emerald-950">Status do checklist: {String(ticket.checklist.status)}</p>
                {ticket.avarias.length ? <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-950">{ticket.avarias.join(" - ")}</p> : <p className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">Sem avarias marcadas.</p>}
              </div>
            )}
            {ticket.fotos.length ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-4">
                  <h4 className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">Fotos de entrada / Antes</h4>
                  <LavaSyncPendingButton compact lavagemId={ticket.id} returnTo={`/lavagestor/tickets/${ticket.id}`} />
                </div>
                {ticket.fotos.slice(0, 4).map((foto) => (
                  <LavaPhotoCard
                    compact
                    foto={foto}
                    key={String(foto.id)}
                    returnTo={`/lavagestor/tickets/${ticket.id}`}
                    subtitle="Antes"
                    title={String(foto.legenda || foto.tipo)}
                  />
                ))}
              </div>
            ) : null}
          </section>

          {ticket.observacoes ? <Info label="Observacoes" value={ticket.observacoes} /> : null}

          <footer className="grid gap-2 border-t border-border pt-3 text-center text-xs font-semibold text-slate-500">
            <p>Cliente declara ciencia das condicoes registradas no checklist de entrada.</p>
            <p>Link do ticket: /lavagestor/tickets/{ticket.id}</p>
            <p>Gerado pelo LavaGestor - MBA Labs</p>
          </footer>
        </article>
      </section>
    </LavaGestorShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-2"><p className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-bold">{value}</p></div>;
}

function MoneyLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-600">{label}</span><strong className={strong ? "text-lg" : "text-sm"}>{formatMoney(value)}</strong></div>;
}

function deliveryLabel(ticket: Ticket) {
  if (ticket.entrega_tipo === "levar") return ticket.endereco_entrega ? `Levar ao cliente: ${ticket.endereco_entrega}` : "Levar ao cliente";
  return "Cliente retira";
}

function ticketMessage(ticket: Ticket) {
  return [
    `Ola, ${ticket.cliente}!`,
    `Segue o ticket de entrada ${ticket.numero}.`,
    `Veiculo/item: ${ticket.veiculo}.`,
    `Total previsto: ${formatMoney(ticket.valor_final)}.`,
    ticket.fotos.length ? "Fotos de entrada anexadas ao ticket." : "",
    "Cliente declara ciencia das condicoes registradas no checklist de entrada."
  ].filter(Boolean).join("\n");
}

const printCss = `
@media print {
  @page { size: A4 portrait; margin: 8mm; }
  html, body { background: #ffffff !important; }
  body * { visibility: hidden !important; }
  .ticket-print, .ticket-print * { visibility: visible !important; }
  .ticket-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; gap: 6px !important; font-size: 9pt !important; }
  .ticket-no-print { display: none !important; }
  .ticket-print h2 { font-size: 20pt !important; }
}
`;
