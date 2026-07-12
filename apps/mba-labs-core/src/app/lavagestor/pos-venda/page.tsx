import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { registrarContatoPosVenda } from "@/lib/actions/lavagestor-pos-venda-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaPosVendaData, whatsappUrl } from "@/lib/lavagestor-phase2-data";
import { requireLavaGestorCounterAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

const filters = [
  { label: "Hoje", value: "hoje" },
  { label: "Ultimos 7 dias", value: "7" },
  { label: "Ultimos 30 dias", value: "30" },
  { label: "Sem retorno 30d", value: "sem_retorno_30" },
  { label: "Com fiado", value: "fiado" },
  { label: "VIP", value: "vip" }
];

const messageTypes = [
  { label: "Agradecimento", value: "agradecimento" },
  { label: "Pesquisa", value: "pesquisa" },
  { label: "Retorno", value: "retorno" },
  { label: "Cobrança", value: "cobranca" },
  { label: "Promoção", value: "promocao" }
];

export default async function PosVendaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { current, perfil } = await requireLavaGestorCounterAccess("/lavagestor/pos-venda");
  const filter = firstParam(params.f) ?? "7";
  const { rows, error } = await getLavaPosVendaData(filter);

  return (
    <LavaGestorShell activePath="/lavagestor/pos-venda" perfil={perfil} userName={current.usuario.nome} roleLabel={perfil}>
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Pos-venda"
          description="Gere mensagens de WhatsApp para agradecimento, pesquisa, retorno, cobrança e promoção. Sem disparo automático."
          actions={<BackButton href="/lavagestor/operacao" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />

        <nav className="flex gap-2 overflow-x-auto pb-1">
          {filters.map((item) => (
            <Link className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-black ${filter === item.value ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-border bg-white"}`} href={`/lavagestor/pos-venda?f=${item.value}`} key={item.value}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-3">
          {rows.length === 0 ? <p className="rounded-xl border border-border bg-white p-4 text-sm font-semibold text-muted-foreground">Nenhum cliente neste filtro.</p> : null}
          {rows.map((row) => <PosVendaCard filter={filter} key={String(row.id)} row={row} />)}
        </div>
      </section>
    </LavaGestorShell>
  );
}

function PosVendaCard({ row, filter }: { row: Row; filter: string }) {
  const messages = row.mensagens as Record<string, string>;
  return (
    <article className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{formatDate(row.data_ref)} - {String(row.dias)} dia(s)</p>
          <h2 className="mt-1 break-words text-xl font-black">{String(row.cliente)}</h2>
          <p className="mt-1 break-words text-sm font-semibold text-muted-foreground">{String(row.veiculo)} - {String(row.servico)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs md:w-72">
          <Info label="Recorrencia" value={`${String(row.recorrencia)}x`} />
          <Info label="Pendente" value={formatMoney(row.valor_pendente)} />
          <Info label="Pagamento" value={String(row.status_pagamento)} />
          <Info label="Ultimo contato" value={formatDate(row.contato_recente)} />
        </div>
      </div>

      <div className="grid gap-2 lg:grid-cols-5">
        {messageTypes.map((type) => {
          const message = messages[type.value] ?? "";
          const url = whatsappUrl(row.whatsapp, message);
          return (
            <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-2" key={type.value}>
              {url ? <a className="button-secondary justify-center text-center" href={url} target="_blank" rel="noreferrer">{type.label}</a> : <span className="rounded-lg bg-white p-3 text-center text-xs font-black text-muted-foreground">Sem WhatsApp</span>}
              <form action={registrarContatoPosVenda}>
                <input name="filter" type="hidden" value={filter} />
                <input name="tipo" type="hidden" value={type.value} />
                <input name="cliente_id" type="hidden" value={String(row.cliente_id)} />
                <input name="lavagem_id" type="hidden" value={String(row.lavagem_id)} />
                <input name="mensagem" type="hidden" value={message} />
                <button className="button-primary w-full text-xs" type="submit">Marcar enviado</button>
              </form>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted px-2 py-2"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-1 truncate font-bold" title={value}>{value}</p></div>;
}
