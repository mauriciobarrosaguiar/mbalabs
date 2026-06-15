import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatMoney } from "@/components/ui-kit";
import { registrarPagamentoLavagem } from "@/lib/actions/lavagestor-actions";
import { firstParam } from "@/lib/form-utils";
import { LAVA_PAYMENT_STATUS_LABELS, listLavaPagamentos } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function PagamentosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selectedLavagem = firstParam(params.lavagem);
  const { rows, error } = await listLavaPagamentos();
  const visibleRows = selectedLavagem ? rows.filter((row) => row.id === selectedLavagem) : rows;

  return (
    <LavaGestorShell activePath="/lavagestor/pagamentos">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Pagamentos"
          description="Controle valores finais, recebidos, pendentes, forma de pagamento e status financeiro."
          actions={
            <>
              <BackButton href="/lavagestor" />
              <Link className="button-primary" href="/lavagestor/fila">
                Ver fila
              </Link>
            </>
          }
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />

        <div className="grid gap-4 lg:grid-cols-2">
          {visibleRows.length === 0 ? (
            <p className="panel p-5 text-sm text-slate-300">Nenhuma lavagem encontrada para pagamento.</p>
          ) : (
            visibleRows.map((row) => <PaymentCard key={String(row.id)} row={row} />)
          )}
        </div>
      </section>
    </LavaGestorShell>
  );
}

function PaymentCard({ row }: { row: Record<string, unknown> }) {
  const statusPagamento = String(row.status_pagamento ?? "aberto");
  const isPaid = statusPagamento === "pago";

  return (
    <article className="panel grid gap-4 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-black">{String(row.cliente || "Cliente")}</h2>
          <p className="mt-1 text-sm text-slate-300">{String(row.veiculo || "-")}</p>
        </div>
        <span className="w-fit rounded-full bg-[#dff7ec] px-3 py-1 text-xs font-black uppercase text-[#0f5132]">
          {LAVA_PAYMENT_STATUS_LABELS[statusPagamento] ?? statusPagamento}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Money label="Valor final" value={row.valor_final ?? row.valor} />
        <Money label="Recebido" value={row.valor_recebido} />
        <Money label="Pendente" value={row.valor_pendente} />
      </div>

      {!isPaid ? (
        <form action={registrarPagamentoLavagem} className="grid gap-3 md:grid-cols-4">
          <input name="id" type="hidden" value={String(row.id)} />
          <input name="return_to" type="hidden" value="/lavagestor/pagamentos" />
          <label className="grid gap-2">
            <span className="text-sm font-bold">Valor recebido</span>
            <input className="input" name="valor_recebido" type="number" min="0" step="0.01" />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold">Status</span>
            <select className="input" name="status_pagamento" defaultValue="pago">
              <option value="aberto">Aberto</option>
              <option value="parcial">Parcial</option>
              <option value="pago">Pago</option>
              <option value="fiado">Fiado</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-bold">Forma</span>
            <select className="input" name="forma_pagamento" defaultValue="pix">
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
              <option value="fiado">Fiado</option>
            </select>
          </label>
          <button className="button-primary self-end" type="submit">
            Registrar
          </button>
        </form>
      ) : null}
    </article>
  );
}

function Money({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-3">
      <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-black">{formatMoney(value)}</p>
    </div>
  );
}
