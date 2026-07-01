import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { getLavaVeiculoHistorico, whatsappUrl } from "@/lib/lavagestor-phase2-data";

export const dynamic = "force-dynamic";

export default async function VeiculoHistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { veiculo, lavagens, fotos, stats, error } = await getLavaVeiculoHistorico(id);

  if (!veiculo) {
    return (
      <LavaGestorShell activePath="/lavagestor/veiculos">
        <section className="grid gap-5">
          <PageHeader eyebrow="LavaGestor" title="Veiculo nao encontrado" actions={<BackButton href="/lavagestor/veiculos" />} />
          <MessageBanner error={error ?? "Nao foi possivel abrir o veiculo."} />
        </section>
      </LavaGestorShell>
    );
  }

  const waUrl = whatsappUrl(veiculo.whatsapp, `Ola, ${String(veiculo.cliente || "cliente")}! Podemos agendar uma nova lavagem para ${String(veiculo.veiculo || "seu veiculo")}?`);

  return (
    <LavaGestorShell activePath="/lavagestor/veiculos">
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title={String(veiculo.veiculo)}
          description={`Cliente: ${String(veiculo.cliente || "-")} - ${String(veiculo.observacao || "sem observacoes importantes")}`}
          actions={
            <>
              <BackButton href="/lavagestor/veiculos" />
              <Link className="button-primary" href={`/lavagestor/nova-lavagem?cliente=${veiculo.cliente_id}&veiculo=${veiculo.id}`}>Nova lavagem</Link>
              {veiculo.cliente_id ? <Link className="button-secondary" href={`/lavagestor/clientes/${veiculo.cliente_id}`}>Cliente</Link> : null}
              {waUrl ? <a className="button-secondary" href={waUrl} target="_blank" rel="noreferrer">WhatsApp</a> : null}
            </>
          }
        />
        <MessageBanner error={error ?? undefined} />

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total de lavagens" value={stats.total_lavagens} />
          <Metric label="Ultima lavagem" value={formatDate(stats.ultima_lavagem)} />
          <Metric label="Ticket medio" value={formatMoney(stats.ticket_medio)} />
          <Metric label="Total gasto" value={formatMoney(stats.total_gasto)} />
          <Metric label="Pendencias" value={formatMoney(stats.pendente)} warning={Number(stats.pendente) > 0} />
        </div>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Observacoes importantes</h2>
          <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">{String(veiculo.observacao || "Nenhuma observacao cadastrada.")}</p>
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Historico de lavagens</h2>
          {lavagens.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Sem lavagens registradas.</p> : null}
          {lavagens.map((lavagem) => (
            <article className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_auto]" key={String(lavagem.id)}>
              <div>
                <h3 className="font-black">{formatDate(lavagem.data_ref)} - {String(lavagem.servico || "-")}</h3>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">{String(lavagem.status_label || "-")} / {String(lavagem.status_pagamento_label || "-")} - {String(lavagem.funcionario || "-")}</p>
                {lavagem.observacoes ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{String(lavagem.observacoes)}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <strong className="rounded-lg bg-muted px-3 py-2 text-sm">{formatMoney(lavagem.valor_final)}</strong>
                <Link className="button-secondary" href={`/lavagestor/checklists/${lavagem.id}`}>Checklist</Link>
                <Link className="button-secondary" href={`/lavagestor/tickets/${lavagem.id}`}>Ticket</Link>
                <Link className="button-secondary" href={`/lavagestor/recibos/${lavagem.id}`}>Recibo</Link>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Fotos e avarias recorrentes</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fotos.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground sm:col-span-2 lg:col-span-4">Sem fotos salvas.</p> : null}
            {fotos.slice(0, 12).map((foto) => (
              <figure className="overflow-hidden rounded-lg border border-border bg-white" key={String(foto.id)}>
                {foto.signed_url ? <img alt={String(foto.legenda || foto.tipo)} className="aspect-[4/3] w-full object-cover" src={String(foto.signed_url)} /> : null}
                <figcaption className="p-2 text-xs font-bold text-muted-foreground">{String(foto.tipo || "foto")} - {formatDate(foto.created_at)}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      </section>
    </LavaGestorShell>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string | number; warning?: boolean }) {
  return <div className={`rounded-xl border p-3 shadow-sm ${warning ? "border-amber-200 bg-amber-50" : "border-border bg-white"}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-2 block break-words text-xl font-black">{value}</strong></div>;
}
