import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, formatDate, formatMoney } from "@/components/ui-kit";
import { registrarSaidaOperacao } from "@/lib/actions/lavagestor-operacao-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { listLavaFila } from "@/lib/lavagestor-fila-data";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function LavaOperacaoSaidaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = firstParam(params.q) ?? "";

  const [{ config }, fila] = await Promise.all([
    getLavaConfiguracoesEmpresa(),
    listLavaFila(),
    requireLavaGestorAccess("/lavagestor/operacao/saida")
  ]);

  const rows = q ? fila.rows.filter((row) => matches(row, q)) : [];

  return (
    <LavaGestorShell activePath="/lavagestor/operacao/saida" companyName={config.nome_exibicao}>
      <section className="mx-auto grid w-full max-w-xl gap-4 py-4">
        <BackButton href="/lavagestor/operacao" label="Voltar" />

        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black">Saída</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Busque por ticket, placa, nome ou contato.
          </p>

          <form className="mt-5 grid gap-3" action="/lavagestor/operacao/saida">
            <input className="input min-h-14 text-center text-xl font-black uppercase" name="q" defaultValue={q} placeholder="Ticket ou placa" autoFocus />
            <button className="button-primary min-h-14 justify-center text-lg font-black" type="submit">
              Buscar veículo
            </button>
          </form>
        </div>

        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? fila.error ?? undefined} />

        {q && rows.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-black text-amber-950">
            Nenhum veículo em serviço encontrado para “{q}”.
          </div>
        ) : null}

        <div className="grid gap-3">
          {rows.map((row) => (
            <SaidaCard key={String((row as Row).id ?? "")} row={row as Row} />
          ))}
        </div>

        <Link className="button-secondary min-h-14 justify-center rounded-xl text-lg font-black" href="/lavagestor/operacao/fila">
          Ver veículos em serviço
        </Link>
      </section>
    </LavaGestorShell>
  );
}

function SaidaCard({ row }: { row: Row }) {
  const id = String(row.id ?? "");
  const foto = String(row.foto_entrada_url || row.foto_entrada_preview_url || row.checklist_foto_url || "");

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
      {foto ? <img className="h-52 w-full object-cover" src={foto} alt="Foto do veículo" /> : null}

      <div className="grid gap-3 p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Ticket #{id.slice(0, 8)}</p>
          <h2 className="mt-1 text-2xl font-black">{String(row.veiculo || "Veículo")}</h2>
          <p className="mt-1 text-sm font-bold text-muted-foreground">{String(row.cliente || "Cliente")}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info label="Serviço" value={String(row.servico || "-")} />
          <Info label="Valor" value={formatMoney(row.valor_final ?? row.valor)} />
          <Info label="Entrada" value={formatDate(row.data_entrada ?? row.data_lavagem)} />
          <Info label="Lavador" value={String(row.funcionario || "-")} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <SaidaButton lavagemId={id} tipo="pago" label="PAGO" className="bg-emerald-500 text-white" />
          <SaidaButton lavagemId={id} tipo="convenio" label="CONVÊNIO" className="bg-blue-500 text-white" />
          <SaidaButton lavagemId={id} tipo="fiado" label="FIADO" className="bg-amber-500 text-white" />
          <SaidaButton lavagemId={id} tipo="faturar" label="À FATURAR" className="bg-slate-700 text-white" />
          <SaidaButton lavagemId={id} tipo="cancelado" label="CANCELAR" className="col-span-2 bg-red-500 text-white" />
        </div>
      </div>
    </article>
  );
}

function SaidaButton({ lavagemId, tipo, label, className }: { lavagemId: string; tipo: string; label: string; className: string }) {
  return (
    <form action={registrarSaidaOperacao}>
      <input type="hidden" name="lavagem_id" value={lavagemId} />
      <input type="hidden" name="tipo_saida" value={tipo} />
      <input type="hidden" name="return_to" value="/lavagestor/operacao/fila" />
      <button className={`min-h-16 w-full rounded-2xl px-3 text-base font-black shadow-sm active:scale-[0.98] ${className}`} type="submit">
        {label}
      </button>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-black">{value}</p>
    </div>
  );
}

function matches(row: Row, query: string) {
  const q = normalize(query);
  const haystack = normalize([
    row.id,
    row.cliente,
    row.whatsapp,
    row.veiculo,
    row.servico,
    row.funcionario
  ].filter(Boolean).join(" "));

  return haystack.includes(q);
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

