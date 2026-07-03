import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { AgendamentoForm } from "@/components/lavagestor/AgendamentoForm";
import { PendingActionButton } from "@/components/lavagestor/PendingActionButton";
import { BackButton, MessageBanner, PageHeader, formatDateTime } from "@/components/ui-kit";
import {
  converterAgendamentoEmLavagem,
  sendLavaAgendamentoConfirmation,
  updateLavaAgendamentoStatus
} from "@/lib/actions/lavagestor-agendamentos-actions";
import { firstParam } from "@/lib/form-utils";
import { LAVA_AGENDAMENTO_STATUS, getLavaAgendamentosData } from "@/lib/lavagestor-agendamentos-data";

export const dynamic = "force-dynamic";

const periodos = [
  { value: "hoje", label: "Hoje" },
  { value: "amanha", label: "Amanhã" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" }
];

export default async function AgendamentosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await getLavaAgendamentosData(params);

  return (
    <LavaGestorShell activePath="/lavagestor/agendamentos">
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Agendamentos"
          description="Organize agenda interna, confirme horários e converta em lavagem quando o cliente chegar."
          actions={
            <>
              <BackButton href="/lavagestor" />
              <Link className="button-secondary" href="/lavagestor/nova-lavagem">
                Nova lavagem
              </Link>
            </>
          }
        />

        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <Metric label="Hoje" value={data.summary.hoje} />
          <Metric label="Confirmados" value={data.summary.confirmados} green />
          <Metric label="Pendentes" value={data.summary.pendentes} warning />
          <Metric label="Cancelados" value={data.summary.cancelados} />
          <Metric label="Próximos 7 dias" value={data.summary.proximos7} />
        </div>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {periodos.map((item) => (
              <Link
                className={`rounded-lg border px-3 py-2 text-sm font-black ${
                  data.filter.periodo === item.value
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-border bg-white"
                }`}
                href={`/lavagestor/agendamentos?periodo=${item.value}`}
                key={item.value}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <form className="grid gap-3 md:grid-cols-4" action="/lavagestor/agendamentos">
            <input name="periodo" type="hidden" value={data.filter.periodo} />
            <Select label="Status" name="status" defaultValue={data.filter.status} options={LAVA_AGENDAMENTO_STATUS} />
            <Select
              label="Funcionário"
              name="funcionario"
              defaultValue={data.filter.funcionario}
              options={data.funcionarios.map((row) => ({ value: String(row.id), label: String(row.nome) }))}
            />
            <Select
              label="Serviço"
              name="servico"
              defaultValue={data.filter.servico}
              options={data.servicos.map((row) => ({ value: String(row.id), label: String(row.nome) }))}
            />
            <button className="button-primary self-end" type="submit">
              Filtrar
            </button>
          </form>
        </section>

        <AgendamentoForm
          clientes={data.clientes}
          config={data.config}
          funcionarios={data.funcionarios}
          servicos={data.servicos}
          veiculos={data.veiculos}
        />

        <section className="grid gap-3">
          {data.rows.length === 0 ? (
            <p className="rounded-xl border border-border bg-white p-4 text-sm font-semibold text-muted-foreground">
              Nenhum agendamento neste filtro.
            </p>
          ) : null}

          {data.rows.map((row) => (
            <AgendamentoCard row={row} key={String(row.id)} />
          ))}
        </section>
      </section>
    </LavaGestorShell>
  );
}

function AgendamentoCard({ row }: { row: Record<string, unknown> }) {
  const confirmationStatus = String(row.confirmacao_status || "");
  const confirmationSent = ["enviado", "enviado_manual", "enviado_automatico"].includes(confirmationStatus);
  const confirmationError = confirmationStatus === "erro" || Boolean(row.confirmacao_erro);

  const confirmationLabel = confirmationSent
    ? "Confirmação enviada"
    : confirmationError
      ? "Erro na confirmação"
      : String(row.confirmacao_label || "Confirmação pendente");

  return (
    <article className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm lg:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="break-words text-xl font-black">{String(row.cliente || row.titulo || "Agendamento")}</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {String(row.veiculo || "-")} - {String(row.servico || "-")}
            </p>
          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-900">
            {String(row.status_label)}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Info label="Início" value={formatDateTime(row.data_inicio)} />
          <Info label="Duração" value={`${String(row.duracao_min ?? 60)} min`} />
          <Info label="Funcionário" value={String(row.funcionario || "-")} />
          <Info label="Confirmação" value={confirmationLabel} />
        </div>

        {row.adicional_texto ? (
          <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">
            {String(row.adicional_texto)}
          </p>
        ) : null}

        {row.observacao ? (
          <p className="mt-3 rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">
            {String(row.observacao)}
          </p>
        ) : null}

        {row.confirmacao_erro ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
            {String(row.confirmacao_erro)}
          </p>
        ) : null}
      </div>

      <div className="grid content-start gap-2 sm:grid-cols-2 lg:w-80 lg:grid-cols-1">
        <form action={sendLavaAgendamentoConfirmation}>
          <input name="id" type="hidden" value={String(row.id)} />
          <PendingActionButton pendingText="Enviando...">
            {confirmationSent ? "Enviar novamente" : confirmationError ? "Tentar novamente" : "Enviar confirmação"}
          </PendingActionButton>
        </form>

        <StatusButton id={String(row.id)} status="confirmado" label="Confirmar" pendingText="Confirmando..." />
        <StatusButton id={String(row.id)} status="compareceu" label="Compareceu" pendingText="Atualizando..." />
        <StatusButton id={String(row.id)} status="nao_compareceu" label="Não compareceu" pendingText="Atualizando..." />

        <form action={converterAgendamentoEmLavagem}>
          <input name="id" type="hidden" value={String(row.id)} />
          <PendingActionButton className="button-primary w-full" pendingText="Convertendo...">
            Converter em lavagem
          </PendingActionButton>
        </form>

        <StatusButton id={String(row.id)} status="cancelado" label="Cancelar" pendingText="Cancelando..." danger />
      </div>
    </article>
  );
}

function StatusButton({
  id,
  status,
  label,
  pendingText,
  danger = false
}: {
  id: string;
  status: string;
  label: string;
  pendingText: string;
  danger?: boolean;
}) {
  return (
    <form action={updateLavaAgendamentoStatus}>
      <input name="id" type="hidden" value={id} />
      <input name="status" type="hidden" value={status} />
      <PendingActionButton className={`${danger ? "button-danger" : "button-secondary"} w-full`} pendingText={pendingText}>
        {label}
      </PendingActionButton>
    </form>
  );
}

function Metric({
  label,
  value,
  green = false,
  warning = false
}: {
  label: string;
  value: string | number;
  green?: boolean;
  warning?: boolean;
}) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : warning ? "border-amber-200 bg-amber-50" : "border-border bg-white";

  return (
    <div className={`rounded-xl border p-3 shadow-sm ${tone}`}>
      <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <strong className="mt-2 block text-xl font-black">{value}</strong>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg bg-muted px-2 py-2">
      <span className="block text-[10px] font-black uppercase text-muted-foreground">{label}</span>
      <strong className="block truncate text-sm" title={value}>
        {value}
      </strong>
    </span>
  );
}

function Select({
  label,
  name,
  defaultValue,
  options
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <select className="input" name={name} defaultValue={defaultValue ?? ""}>
        <option value="">Todos</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}