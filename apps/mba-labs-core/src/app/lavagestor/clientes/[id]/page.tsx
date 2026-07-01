import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { getLavaClienteHistorico, whatsappUrl } from "@/lib/lavagestor-phase2-data";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function ClienteHistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cliente, veiculos, lavagens, fotos, stats, error } = await getLavaClienteHistorico(id);

  if (!cliente) {
    return (
      <LavaGestorShell activePath="/lavagestor/clientes">
        <section className="grid gap-5">
          <PageHeader eyebrow="LavaGestor" title="Cliente nao encontrado" actions={<BackButton href="/lavagestor/clientes" />} />
          <MessageBanner error={error ?? "Nao foi possivel abrir o cliente."} />
        </section>
      </LavaGestorShell>
    );
  }

  const waUrl = whatsappUrl(cliente.telefone, `Ola, ${String(cliente.nome)}! Podemos agendar uma nova lavagem?`);

  return (
    <LavaGestorShell activePath="/lavagestor/clientes">
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title={String(cliente.nome)}
          description={[cliente.telefone, cliente.email, cliente.documento].filter(Boolean).join(" - ") || "Historico do cliente"}
          actions={
            <>
              <BackButton href="/lavagestor/clientes" />
              <Link className="button-primary" href={`/lavagestor/nova-lavagem?cliente=${cliente.id}`}>Nova lavagem</Link>
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
          <h2 className="text-xl font-black">Veiculos / itens</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {veiculos.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhum veiculo cadastrado.</p> : null}
            {veiculos.map((veiculo) => (
              <Link className="rounded-lg border border-border bg-muted/40 p-3 shadow-sm hover:bg-emerald-50" href={`/lavagestor/veiculos/${veiculo.id}`} key={String(veiculo.id)}>
                <strong className="break-words">{vehicleName(veiculo)}</strong>
                {veiculo.observacao ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{String(veiculo.observacao)}</p> : null}
              </Link>
            ))}
          </div>
        </section>

        <HistoryList lavagens={lavagens} />
        <PhotoGrid fotos={fotos} />
      </section>
    </LavaGestorShell>
  );
}

function HistoryList({ lavagens }: { lavagens: Row[] }) {
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xl font-black">Lavagens e recibos</h2>
      <div className="grid gap-3">
        {lavagens.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Sem lavagens registradas.</p> : null}
        {lavagens.map((lavagem) => (
          <article className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_auto]" key={String(lavagem.id)}>
            <div>
              <h3 className="font-black">{String(lavagem.veiculo || "-")}</h3>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{formatDate(lavagem.data_ref)} - {String(lavagem.servico || "-")} - {String(lavagem.status_label || "-")} / {String(lavagem.status_pagamento_label || "-")}</p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <strong className="rounded-lg bg-muted px-3 py-2 text-sm">{formatMoney(lavagem.valor_final)}</strong>
              <Link className="button-secondary" href={`/lavagestor/checklists/${lavagem.id}`}>Checklist</Link>
              <Link className="button-secondary" href={`/lavagestor/tickets/${lavagem.id}`}>Ticket</Link>
              <Link className="button-secondary" href={`/lavagestor/recibos/${lavagem.id}`}>Recibo</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PhotoGrid({ fotos }: { fotos: Row[] }) {
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xl font-black">Fotos e checklists anteriores</h2>
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
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string | number; warning?: boolean }) {
  return <div className={`rounded-xl border p-3 shadow-sm ${warning ? "border-amber-200 bg-amber-50" : "border-border bg-white"}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-2 block break-words text-xl font-black">{value}</strong></div>;
}

function vehicleName(row: Row) {
  return [row.placa, [row.marca, row.modelo].filter(Boolean).join(" "), row.cor].filter(Boolean).join(" - ") || String(row.tipo ?? "Item");
}
