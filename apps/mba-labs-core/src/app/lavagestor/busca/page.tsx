import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { firstParam } from "@/lib/form-utils";
import { quickSearchLava, whatsappUrl } from "@/lib/lavagestor-phase2-data";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function LavaBuscaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = firstParam(params.q) ?? "";
  const { rows, error } = await quickSearchLava(q);

  return (
    <LavaGestorShell activePath="/lavagestor/busca">
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Busca rapida"
          description="Procure por placa, cliente, telefone, modelo ou ultimas lavagens para abrir atendimento no balcao."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner error={error ?? undefined} />

        <form className="rounded-xl border border-border bg-white p-3 shadow-sm md:flex md:items-center md:gap-2" action="/lavagestor/busca">
          <input className="input min-h-12 flex-1 text-base" name="q" defaultValue={q} placeholder="Digite placa, cliente ou telefone" autoFocus />
          <button className="button-primary mt-2 w-full md:mt-0 md:w-auto" type="submit">Buscar</button>
        </form>

        {rows.length === 0 ? (
          <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <h2 className="text-xl font-black">Nada encontrado</h2>
            <p className="text-sm font-semibold">Abra uma nova lavagem e cadastre cliente/veiculo com esse termo.</p>
            <Link className="button-primary w-fit" href={`/lavagestor/nova-lavagem?busca=${encodeURIComponent(q)}`}>Cadastrar atendimento</Link>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row, index) => <ResultCard key={`${row.id}-${index}`} row={row} />)}
          </div>
        )}
      </section>
    </LavaGestorShell>
  );
}

function ResultCard({ row }: { row: Row }) {
  const phoneUrl = whatsappUrl(row.whatsapp, `Ola, ${String(row.cliente || "cliente")}! Podemos iniciar um atendimento no LavaGestor?`);
  return (
    <article className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{String(row.placa || "Sem placa")}</p>
        <h2 className="mt-1 break-words text-xl font-black">{String(row.cliente || "Cliente")}</h2>
        <p className="mt-1 break-words text-sm font-semibold text-muted-foreground">{String(row.veiculo || "-")}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Info label="Ultima lavagem" value={formatDate(row.ultima_lavagem)} />
        <Info label="Status" value={String(row.ultimo_status || "-")} />
        <Info label="Valor" value={formatMoney(row.ultimo_valor)} />
        <Info label="WhatsApp" value={String(row.whatsapp || "-")} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Link className="button-primary justify-center" href={`/lavagestor/nova-lavagem?cliente=${row.cliente_id}&veiculo=${row.veiculo_id}`}>Nova lavagem</Link>
        {row.cliente_id ? <Link className="button-secondary justify-center" href={`/lavagestor/clientes/${row.cliente_id}`}>Historico</Link> : null}
        {row.cliente_id ? <Link className="button-secondary justify-center" href={`/lavagestor/clientes/${row.cliente_id}`}>Cliente</Link> : null}
        {row.veiculo_id ? <Link className="button-secondary justify-center" href={`/lavagestor/veiculos/${row.veiculo_id}`}>Veiculo</Link> : null}
        {phoneUrl ? <a className="button-secondary justify-center sm:col-span-2" href={phoneUrl} target="_blank" rel="noreferrer">WhatsApp</a> : null}
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-1 truncate font-bold" title={value}>{value}</p></div>;
}
