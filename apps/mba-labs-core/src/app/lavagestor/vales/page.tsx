import { LavaGestorShell } from "@/components/LavaGestorShell";
import {
  BackButton,
  DeleteButton,
  FormDateInput,
  FormMoneyInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SearchBox,
  SubmitButton,
  formatDate,
  formatDateTime,
  formatMoney
} from "@/components/ui-kit";
import { saveVale, updateValeStatus } from "@/lib/actions/lavagestor-actions";
import { descontarValeIntegral } from "@/lib/actions/lavagestor-vales-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaLookups, listLavaVales } from "@/lib/lavagestor-data";
import { requireLavaGestorFinanceAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

type AnyRow = Record<string, unknown>;

export default async function ValesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { current, perfil } = await requireLavaGestorFinanceAccess("/lavagestor/vales");
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const [{ rows, error }, lookups] = await Promise.all([listLavaVales(search), getLavaLookups()]);
  const funcionarios = lookups.funcionarios.map((row) => ({ label: String(row.nome), value: String(row.id) }));
  const today = new Date().toISOString().slice(0, 10);

  const totalOriginal = sum(rows, "valor_original", "valor");
  const totalDescontado = sum(rows, "valor_descontado");
  const totalRestante = sum(rows, "saldo_restante");

  return (
    <LavaGestorShell activePath="/lavagestor/vales" perfil={perfil} userName={current.usuario.nome} roleLabel={perfil}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Vales"
          description="Registre adiantamentos, acompanhe o que já foi descontado e veja quanto falta abater no próximo acerto."
          actions={<BackButton href="/lavagestor/operacao" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por funcionário, descrição ou status" />

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Total em vales" value={formatMoney(totalOriginal)} />
          <Metric label="Já descontado" value={formatMoney(totalDescontado)} green />
          <Metric label="Saldo a debitar" value={formatMoney(totalRestante)} yellow />
        </section>

        <form action={saveVale}>
          <ResourceForm title="Novo vale" actions={<SubmitButton>Salvar vale</SubmitButton>}>
            <FormSelect label="Funcionário" name="funcionario_id" options={funcionarios} required />
            <FormMoneyInput label="Valor" name="valor" required />
            <FormDateInput label="Data do vale" name="data_vale" defaultValue={today} required />
            <FormTextarea label="Descrição" name="descricao" />
          </ResourceForm>
        </form>

        <section className="grid gap-3">
          <div>
            <h2 className="text-xl font-black">Histórico dos vales</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">Cada card mostra o valor original, o que já foi abatido e o saldo que fica para a próxima vez.</p>
          </div>
          {rows.length === 0 ? <p className="rounded-xl bg-muted p-4 text-sm font-semibold text-muted-foreground">Nenhum vale encontrado.</p> : rows.map((row) => <ValeCard key={String(row.id)} row={row} />)}
        </section>
      </section>
    </LavaGestorShell>
  );
}

function ValeCard({ row }: { row: AnyRow }) {
  const status = String(row.status ?? "aberto");
  const movimentos = Array.isArray(row.movimentos) ? (row.movimentos as AnyRow[]) : [];
  const saldoRestante = Number(row.saldo_restante ?? row.valor ?? 0);
  const canUpdate = !["descontado", "cancelado"].includes(status) && saldoRestante > 0;

  return (
    <article className="grid gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Funcionário</p>
          <h3 className="mt-1 break-words text-2xl font-black">{String(row.funcionario || "-")}</h3>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{formatDate(row.data_vale ?? row.created_at)} · {String(row.descricao || "Sem descrição")}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <InfoBox label="Vale original" value={formatMoney(row.valor_original ?? row.valor)} />
        <InfoBox label="Valor já descontado" value={formatMoney(row.valor_descontado)} green />
        <InfoBox label="Falta descontar" value={formatMoney(row.saldo_restante)} yellow />
      </div>

      <div className="rounded-xl border border-border bg-muted/40 p-3">
        <p className="text-sm font-black">Histórico de descontos</p>
        {movimentos.length ? (
          <div className="mt-3 grid gap-2">
            {movimentos.map((movimento, index) => (
              <div className="rounded-xl bg-white p-3 text-sm shadow-sm" key={String(movimento.id ?? index)}>
                <div className="grid gap-2 sm:grid-cols-4">
                  <Mini label="Data" value={formatDateTime(movimento.created_at)} />
                  <Mini label="Descontado" value={formatMoney(movimento.valor_descontado)} />
                  <Mini label="Antes" value={formatMoney(movimento.saldo_antes)} />
                  <Mini label="Depois" value={formatMoney(movimento.saldo_depois)} />
                </div>
                {movimento.observacao ? <p className="mt-2 text-xs font-semibold text-muted-foreground">{String(movimento.observacao)}</p> : null}
              </div>
            ))}
          </div>
        ) : Number(row.valor_descontado ?? 0) > 0 ? (
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">Este vale já tem {formatMoney(row.valor_descontado)} abatido, mas o histórico detalhado ainda não foi registrado. Saldo restante: {formatMoney(row.saldo_restante)}.</p>
        ) : (
          <p className="mt-2 rounded-xl bg-white p-3 text-sm font-semibold text-muted-foreground">Nenhum desconto lançado ainda. O valor integral continua pendente.</p>
        )}
      </div>

      {canUpdate ? (
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <form action={descontarValeIntegral}>
            <input name="id" type="hidden" value={String(row.id)} />
            <SubmitButton>Marcar descontado integral</SubmitButton>
          </form>
          <form action={updateValeStatus}>
            <input name="id" type="hidden" value={String(row.id)} />
            <input name="status" type="hidden" value="cancelado" />
            <DeleteButton>Cancelar</DeleteButton>
          </form>
        </div>
      ) : null}
    </article>
  );
}

function Metric({ label, value, green, yellow }: { label: string; value: string; green?: boolean; yellow?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : yellow ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return <div className={`rounded-2xl border p-4 shadow-sm ${tone}`}><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p><strong className="mt-2 block text-2xl font-black">{value}</strong></div>;
}

function InfoBox({ label, value, green, yellow }: { label: string; value: string; green?: boolean; yellow?: boolean }) {
  const tone = green ? "bg-emerald-50" : yellow ? "bg-amber-50" : "bg-muted";
  return <div className={`rounded-xl p-3 ${tone}`}><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p><strong className="mt-1 block text-lg font-black">{value}</strong></div>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className="mt-1 font-bold">{value}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  const label: Record<string, string> = { aberto: "Aberto", parcial: "Parcial", descontado: "Descontado", cancelado: "Cancelado" };
  const tone = status === "cancelado" ? "bg-red-50 text-red-800" : status === "descontado" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800";
  return <span className={`w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${tone}`}>{label[status] ?? status}</span>;
}

function sum(rows: AnyRow[], primary: string, fallback?: string) {
  return rows.reduce((total, row) => total + Number(row[primary] ?? (fallback ? row[fallback] : 0) ?? 0), 0);
}
