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

  const rows = q ? fila.rows.filter((row) => matches(row as Row, q)) : [];

  return (
    <LavaGestorShell activePath="/lavagestor/operacao/saida" companyName={config.nome_exibicao}>
      <section className="mx-auto grid w-full max-w-xl gap-3 py-3">
        <BackButton href="/lavagestor/operacao" label="Voltar" />

        <form className="grid gap-3 rounded-3xl border border-border bg-white p-4 shadow-sm" action="/lavagestor/operacao/saida">
          <h1 className="text-center text-3xl font-black">Saida</h1>
          <input className="input min-h-14 text-center text-xl font-black uppercase" name="q" defaultValue={q} placeholder="Ticket ou placa" autoFocus />
          <button className="button-primary min-h-14 justify-center text-lg font-black" type="submit">
            Buscar
          </button>
        </form>

        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? fila.error ?? undefined} />

        {q && rows.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-black text-amber-950">
            Nenhum veiculo em servico encontrado para “{q}”.
          </div>
        ) : null}

        <div className="grid gap-3">
          {rows.map((row) => (
            <SaidaCard key={String((row as Row).id ?? "")} row={row as Row} funcionarios={fila.funcionarios as Row[]} />
          ))}
        </div>

        <Link className="button-secondary min-h-14 justify-center rounded-xl text-lg font-black" href="/lavagestor/operacao/fila">
          Veiculos em servico
        </Link>
      </section>
    </LavaGestorShell>
  );
}

function SaidaCard({ row, funcionarios }: { row: Row; funcionarios: Row[] }) {
  const id = String(row.id ?? "");
  const foto = String(row.foto_entrada_preview_url || row.foto_entrada_url || row.checklist_foto_url || "");

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
      <div className="grid grid-cols-[72px_1fr] gap-3 p-3">
        <div className="h-20 overflow-hidden rounded-2xl bg-muted">
          {foto ? <img className="h-full w-full object-cover" src={foto} alt="Foto do veiculo" loading="lazy" /> : <div className="flex h-full items-center justify-center text-[10px] font-black text-muted-foreground">SEM FOTO</div>}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Ticket #{id.slice(0, 8)}</p>
          <h2 className="mt-1 truncate text-xl font-black">{String(row.veiculo || "Veiculo")}</h2>
          <p className="mt-1 truncate text-sm font-bold text-muted-foreground">{String(row.cliente || "Cliente")}</p>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{String(row.servico || "-")}</p>
        </div>
      </div>

      <form action={registrarSaidaOperacao} className="grid gap-3 p-3 pt-0">
        <input type="hidden" name="lavagem_id" value={id} />
        <input type="hidden" name="return_to" value="/lavagestor/operacao/fila" />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info label="Valor" value={formatMoney(row.valor_final ?? row.valor)} />
          <Info label="Entrada" value={formatDate(row.data_entrada ?? row.data_lavagem)} />
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-black">Quem lavou?</span>
          <select className="input min-h-14 text-base font-bold" name="funcionario_id" required defaultValue={String(row.funcionario_id ?? "")}>
            <option value="">Selecione o lavador</option>
            {funcionarios.map((funcionario) => (
              <option key={String(funcionario.id)} value={String(funcionario.id)}>{String(funcionario.nome)}</option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button name="tipo_saida" value="pago" className="min-h-16 rounded-2xl bg-emerald-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">PAGO</button>
          <button name="tipo_saida" value="convenio" className="min-h-16 rounded-2xl bg-blue-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">CONVENIO</button>
          <button name="tipo_saida" value="fiado" className="min-h-16 rounded-2xl bg-amber-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">FIADO</button>
          <button name="tipo_saida" value="faturar" className="min-h-16 rounded-2xl bg-slate-700 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">A FATURAR</button>
          <button name="tipo_saida" value="cancelado" className="col-span-2 min-h-14 rounded-2xl bg-red-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit" formNoValidate>CANCELAR</button>
        </div>
      </form>
    </article>
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
