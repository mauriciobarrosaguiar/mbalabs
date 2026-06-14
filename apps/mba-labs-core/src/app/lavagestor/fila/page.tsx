import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { registrarPagamentoLavagem, updateLavagemStatus } from "@/lib/actions/lavagestor-actions";
import { firstParam } from "@/lib/form-utils";
import { listLavaFila } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

const groups = [
  { title: "Na fila", statuses: ["na_fila"] },
  { title: "Em lavagem", statuses: ["em_lavagem"] },
  { title: "Finalizado", statuses: ["aguardando_finalizacao", "finalizado"] },
  { title: "Aguardando retirada", statuses: ["cliente_avisado", "pago"] }
];

export default async function FilaLavagemPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { rows, error } = await listLavaFila();

  return (
    <LavaGestorShell activePath="/lavagestor/fila">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Fila de lavagem"
          description="Acompanhe cada veículo desde a entrada até pagamento e entrega."
          actions={
            <>
              <BackButton href="/lavagestor" />
              <Link className="button-primary" href="/lavagestor/nova-lavagem">
                Nova lavagem
              </Link>
            </>
          }
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />

        <div className="grid gap-4 xl:grid-cols-4">
          {groups.map((group) => {
            const items = rows.filter((row) => group.statuses.includes(String(row.status)));
            return (
              <section className="grid content-start gap-3 rounded-lg border border-border bg-white p-3 shadow-sm" key={group.title}>
                <div>
                  <h2 className="text-lg font-black">{group.title}</h2>
                  <p className="text-sm text-muted-foreground">{items.length} lavagem(ns)</p>
                </div>
                {items.length === 0 ? (
                  <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">Nenhuma lavagem nesta etapa.</p>
                ) : (
                  items.map((row) => <FilaCard key={String(row.id)} row={row} />)
                )}
              </section>
            );
          })}
        </div>
      </section>
    </LavaGestorShell>
  );
}

function FilaCard({ row }: { row: Record<string, unknown> }) {
  const status = String(row.status);
  const readyMessage = whatsappLink(row, "pronto");

  return (
    <article className="rounded-lg border border-border bg-[#fbfdfc] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black">{String(row.cliente || "Cliente")}</h3>
          <p className="text-sm text-muted-foreground">{String(row.whatsapp || "WhatsApp não informado")}</p>
        </div>
        <span className="rounded-full bg-[#dff7ec] px-2 py-1 text-xs font-black text-[#0f5132]">
          {String(row.status_label ?? status)}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 text-sm">
        <Info label="Veículo" value={String(row.veiculo || "-")} />
        <Info label="Serviços" value={String(row.servico || row.descricao_extra || "-")} />
        <Info label="Funcionário" value={String(row.funcionario || "-")} />
        <Info label="Valor total" value={formatMoney(row.valor_final ?? row.valor)} />
        <Info label="Entrada" value={formatDateTime(row.data_entrada ?? row.data_lavagem)} />
      </dl>

      <div className="mt-4 grid gap-2">
        {status === "na_fila" ? (
          <>
            <StatusButton id={String(row.id)} action="iniciar" label="Iniciar lavagem" />
            <CancelForm id={String(row.id)} />
          </>
        ) : null}

        {status === "em_lavagem" ? (
          <>
            <StatusButton id={String(row.id)} action="finalizar" label="Finalizar lavagem" />
          </>
        ) : null}

        {status === "finalizado" || status === "aguardando_finalizacao" ? (
          <>
            <a className="button-secondary" href={readyMessage} target="_blank" rel="noreferrer">
              Avisar cliente no WhatsApp
            </a>
            <StatusButton id={String(row.id)} action="avisar_cliente" label="Marcar cliente avisado" />
            <Link className="button-primary" href={`/lavagestor/pagamentos?lavagem=${row.id}`}>
              Registrar pagamento
            </Link>
          </>
        ) : null}

        {status === "cliente_avisado" || status === "pago" ? (
          <>
            <MiniPaymentForm row={row} />
            <StatusButton id={String(row.id)} action="entregar" label="Entregar veículo" />
          </>
        ) : null}

        {status === "entregue" ? (
          <Link className="button-secondary" href="/lavagestor/lavagens">
            Ver recibo
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function StatusButton({ id, action, label }: { id: string; action: string; label: string }) {
  return (
    <form action={updateLavagemStatus}>
      <input name="id" type="hidden" value={id} />
      <input name="acao" type="hidden" value={action} />
      <input name="return_to" type="hidden" value="/lavagestor/fila" />
      <button className="button-primary w-full" type="submit">
        {label}
      </button>
    </form>
  );
}

function CancelForm({ id }: { id: string }) {
  return (
    <form action={updateLavagemStatus} className="grid gap-2">
      <input name="id" type="hidden" value={id} />
      <input name="acao" type="hidden" value="cancelar" />
      <input name="return_to" type="hidden" value="/lavagestor/fila" />
      <input className="input" name="motivo_cancelamento" placeholder="Motivo do cancelamento" />
      <button className="button-danger w-full" type="submit">
        Cancelar
      </button>
    </form>
  );
}

function MiniPaymentForm({ row }: { row: Record<string, unknown> }) {
  if (row.status_pagamento === "pago") {
    return null;
  }

  return (
    <form action={registrarPagamentoLavagem} className="grid gap-2">
      <input name="id" type="hidden" value={String(row.id)} />
      <input name="return_to" type="hidden" value="/lavagestor/fila" />
      <input name="status_pagamento" type="hidden" value="pago" />
      <input className="input" name="valor_recebido" placeholder="Valor recebido" type="number" min="0" step="0.01" />
      <select className="input" name="forma_pagamento" defaultValue="pix">
        <option value="dinheiro">Dinheiro</option>
        <option value="pix">Pix</option>
        <option value="cartao">Cartão</option>
        <option value="fiado">Fiado</option>
      </select>
      <button className="button-primary w-full" type="submit">
        Registrar pagamento
      </button>
    </form>
  );
}

function whatsappLink(row: Record<string, unknown>, type: "pronto") {
  const phone = String(row.whatsapp ?? "").replace(/\D/g, "");
  const vehicle = String(row.veiculo ?? "-");
  const value = formatMoney(row.valor_final ?? row.valor);
  const text =
    type === "pronto"
      ? `Olá, ${String(row.cliente ?? "")}! Seu veículo está pronto.\n\nVeículo: ${vehicle}\nValor total: ${value}\n\nJá pode retirar.`
      : "";

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
