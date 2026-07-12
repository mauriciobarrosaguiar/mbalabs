import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, formatDate, formatMoney } from "@/components/ui-kit";
import { finalizarServicoOperacao } from "@/lib/actions/lavagestor-finalizar-actions";
import { registrarSaidaOperacao } from "@/lib/actions/lavagestor-operacao-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { listLavaFila } from "@/lib/lavagestor-fila-data";
import { requireLavaGestorOperationAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function LavaOperacaoFilaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;

  const [{ config }, fila] = await Promise.all([
    getLavaConfiguracoesEmpresa("/lavagestor/operacao/fila"),
    listLavaFila(),
    requireLavaGestorOperationAccess("/lavagestor/operacao/fila")
  ]);

  return (
    <LavaGestorShell activePath="/lavagestor/operacao/fila" companyName={config.nome_exibicao}>
      <section className="mx-auto grid w-full max-w-xl gap-3 overflow-x-hidden py-3">
        <div className="flex items-center justify-between gap-2">
          <BackButton href="/lavagestor/operacao" label="Voltar" />
          <Link className="button-primary rounded-xl px-4 py-3 text-sm font-black" href="/lavagestor/operacao/entrada">
            Entrada
          </Link>
        </div>

        <div className="rounded-3xl border border-border bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-600">Operacao</p>
          <h1 className="mt-1 text-3xl font-black">Veiculos em servico</h1>
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            Total na fila: {fila.rows.length}
          </p>
        </div>

        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? fila.error ?? undefined} />

        {fila.rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white p-5 text-center text-sm font-bold text-muted-foreground">
            Nenhum veiculo em servico agora.
          </div>
        ) : null}

        <div className="grid gap-3">
          {fila.rows.map((row) => (
            <ServicoCard key={String((row as Row).id ?? "")} row={row as Row} />
          ))}
        </div>
      </section>
    </LavaGestorShell>
  );
}

function ServicoCard({ row }: { row: Row }) {
  const id = String(row.id ?? "");
  const foto = String(row.foto_entrada_preview_url || row.foto_entrada_url || row.checklist_foto_url || "");
  const status = String(row.status ?? "");
  const isFinalizado = ["finalizado", "cliente_avisado", "pago"].includes(status);
  const tone = cardTone(row);

  return (
    <article className={`overflow-hidden rounded-3xl border shadow-sm ${tone}`}>
      <div className="grid grid-cols-[72px_1fr] gap-3 p-3">
        <div className="h-20 overflow-hidden rounded-2xl bg-muted">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="h-full w-full object-cover" src={foto} alt="Foto do veiculo" loading="lazy" />
          ) : <div className="flex h-full items-center justify-center text-[10px] font-black text-muted-foreground">SEM FOTO</div>}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">Ticket #{id.slice(0, 8)}</p>
          <h2 className="mt-1 truncate text-xl font-black">{String(row.veiculo || "Veiculo")}</h2>
          <p className="mt-1 truncate text-sm font-bold">{String(row.cliente || "Cliente")}</p>
          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{String(row.servico || "-")}</p>
          <p className="mt-2 text-xs font-black">Tempo: {tempoEmServico(row.data_entrada ?? row.data_lavagem)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pb-3 text-xs">
        <Info label="Entrada" value={formatDate(row.data_entrada ?? row.data_lavagem)} />
        <Info label="Valor" value={formatMoney(row.valor_final ?? row.valor)} />
        <Info label="Status" value={String(row.status_label || status)} />
        <Info label="Lavador" value={String(row.funcionario || "A definir")} />
      </div>

      <div className="grid gap-2 border-t border-black/5 p-3">
        {isFinalizado ? (
          <Link className="flex min-h-16 items-center justify-center rounded-2xl bg-sky-500 px-2 text-center text-lg font-black text-white" href={`/lavagestor/operacao/saida?q=${encodeURIComponent(id)}`}>
            DAR SAIDA
          </Link>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <FinalizarAction lavagemId={id} />
            <CancelarAction lavagemId={id} />
          </div>
        )}
      </div>
    </article>
  );
}

function FinalizarAction({ lavagemId }: { lavagemId: string }) {
  return (
    <form action={finalizarServicoOperacao}>
      <input type="hidden" name="lavagem_id" value={lavagemId} />
      <button className="min-h-14 w-full rounded-2xl bg-emerald-500 px-2 text-center text-sm font-black text-white" type="submit">
        FINALIZAR
      </button>
    </form>
  );
}

function CancelarAction({ lavagemId }: { lavagemId: string }) {
  return (
    <form action={registrarSaidaOperacao}>
      <input type="hidden" name="lavagem_id" value={lavagemId} />
      <input type="hidden" name="tipo_saida" value="cancelado" />
      <input type="hidden" name="return_to" value="/lavagestor/operacao/fila" />
      <button className="min-h-14 w-full rounded-2xl bg-red-500 px-2 text-center text-sm font-black text-white" type="submit">
        CANCELAR
      </button>
    </form>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-black">{value}</p>
    </div>
  );
}

function cardTone(row: Row) {
  const status = String(row.status ?? "");

  if (status === "finalizado" || status === "cliente_avisado") {
    return "border-emerald-200 bg-emerald-50";
  }

  const minutes = minutesSince(row.data_entrada ?? row.data_lavagem);

  if (minutes >= 90) return "border-red-200 bg-red-50";
  if (minutes >= 60) return "border-amber-200 bg-amber-50";

  return "border-border bg-white";
}

function tempoEmServico(value: unknown) {
  const minutes = minutesSince(value);

  if (minutes < 1) return "00:00";

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesSince(value: unknown) {
  const date = new Date(String(value ?? ""));

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}
