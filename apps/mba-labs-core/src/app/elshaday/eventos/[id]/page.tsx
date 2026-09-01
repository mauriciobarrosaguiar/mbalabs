import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck2,
  Check,
  CircleX,
  Clock3,
  PencilLine,
  Repeat2,
  UsersRound
} from "lucide-react";
import {
  dateTimeBR,
  hasElshadayRole,
  requireElshadayContext
} from "@/lib/elshaday";
import {
  markAllElshadayAttendance,
  saveElshadayAttendance,
  setElshadayEventStatus,
  updateElshadayEvent
} from "../../completion-actions";
import { EventSubmitButton } from "../EventSubmitButton";

export const dynamic = "force-dynamic";

export default async function EventDetail({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/eventos/" + id);
  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria", "lider"]);

  const [eventResult, membersResult, presenceResult] = await Promise.all([
    context.admin
      .from("igreja_eventos")
      .select("*")
      .eq("igreja_id", context.igreja.id)
      .eq("id", id)
      .maybeSingle(),
    canManage
      ? context.admin
          .from("igreja_membros")
          .select("id,nome,situacao,ministerio")
          .eq("igreja_id", context.igreja.id)
          .in("situacao", ["ativo", "visitante"])
          .order("nome")
      : Promise.resolve({ data: [], error: null }),
    canManage
      ? context.admin
          .from("igreja_evento_presencas")
          .select("membro_id,presente,registrado_em")
          .eq("igreja_id", context.igreja.id)
          .eq("evento_id", id)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (eventResult.error || !eventResult.data) throw new Error("Evento não localizado.");
  if (membersResult.error) throw new Error(membersResult.error.message);
  if (presenceResult.error) throw new Error(presenceResult.error.message);

  const event = eventResult.data;
  const members = membersResult.data ?? [];
  const presences = presenceResult.data ?? [];
  const presenceMap = new Map(
    presences.map((item: any) => [String(item.membro_id), Boolean(item.presente)])
  );
  const presentCount = presences.filter((item: any) => item.presente).length;
  const ok = read(query.ok);
  const error = read(query.erro);

  return (
    <div className="mx-auto grid min-w-0 max-w-6xl gap-6">
      {event.banner_url ? (
        <div className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white shadow-sm">
          <img
            alt={"Capa de " + event.titulo}
            className="aspect-[16/9] w-full object-cover"
            src={event.banner_url}
          />
        </div>
      ) : null}

      <header className="min-w-0">
        <Link
          href="/elshaday/eventos"
          className="inline-flex items-center gap-2 text-sm font-black text-[#176445]"
        >
          <ArrowLeft size={16} /> Voltar à agenda
        </Link>

        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">{event.tipo}</p>
            <h1 className="mt-1 break-words text-2xl font-black leading-tight sm:text-3xl">{event.titulo}</h1>
            {event.serie_id ? (
              <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-amber-800">
                <Repeat2 size={15} />
                Recorrência {recurrenceLabel(event.recorrencia_tipo)}
              </span>
            ) : null}
            <p className="mt-2 text-slate-600">
              {dateTimeBR(event.inicio)}
              {event.local ? " · " + event.local : ""}
            </p>
          </div>
          <span className={"rounded-full px-3 py-1 text-xs font-black " + statusClass(event.status)}>
            {event.status}
          </span>
        </div>
      </header>

      {ok ? <Message success text="Alteração concluída." /> : null}
      {error ? <Message text={error} /> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Kpi icon={<Clock3 size={18} />} label="Data e horário" value={dateTimeBR(event.inicio)} />
        <Kpi icon={<UsersRound size={18} />} label="Público" value={event.publico || "todos"} />
        <Kpi
          icon={<CalendarCheck2 size={18} />}
          label="Presentes"
          value={canManage ? String(presentCount) : "Restrito"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
          <h2 className="font-black">Programação</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <Info label="Tema" value={event.tema} />
            <Info label="Texto bíblico" value={event.texto_biblico} />
            <Info label="Pregador" value={event.pregador} />
            <Info label="Dirigente" value={event.dirigente} />
            <Info label="Local" value={event.local} />
            <Info label="Descrição" value={event.descricao} />
            {event.serie_id ? (
              <Info
                label="Recorrência"
                value={
                  recurrenceLabel(event.recorrencia_tipo) +
                  (event.recorrencia_ate ? " · até " + dateOnlyBR(event.recorrencia_ate) : "")
                }
              />
            ) : null}
          </dl>
        </article>

        {canManage ? (
          <article className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
            <h2 className="font-black">Status da programação</h2>
            <p className="mt-2 text-sm text-slate-500">
              Use cancelado em vez de excluir, preservando o histórico.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["agendado", "realizado", "cancelado"].map((status) => (
                <form action={setElshadayEventStatus} key={status}>
                  <input type="hidden" name="evento_id" value={id} />
                  <input type="hidden" name="status" value={status} />
                  <input type="hidden" name="return_to" value={"/elshaday/eventos/" + id} />
                  <button
                    className={
                      "min-h-10 rounded-xl px-4 text-sm font-black " +
                      (event.status === status
                        ? "bg-[#123d2d] text-white"
                        : "border border-slate-300 bg-white text-slate-900")
                    }
                  >
                    {status}
                  </button>
                </form>
              ))}
            </div>
          </article>
        ) : null}
      </section>

      {canManage ? (
        <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2">
              <PencilLine size={18} /> Editar evento
            </span>
          </summary>
          <form action={updateElshadayEvent} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="evento_id" value={id} />
            <input type="hidden" name="return_to" value={"/elshaday/eventos/" + id} />
            <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-800 sm:col-span-2 lg:col-span-3">
              Trocar imagem de capa
              <input
                className="w-full min-w-0 rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
                name="imagem"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
              <span className="text-xs font-medium leading-5 text-slate-500">
                Opcional. Ao aplicar à série, a nova capa também será aplicada aos eventos selecionados.
              </span>
            </label>
            <Field label="Título" name="titulo" defaultValue={event.titulo} required />
            <label className="grid gap-2 text-sm font-bold">
              Tipo
              <select className="input" name="tipo" defaultValue={event.tipo}>
                <option value="culto">Culto</option>
                <option value="ceia">Santa Ceia</option>
                <option value="ebd">EBD</option>
                <option value="vigilia">Vigília</option>
                <option value="congresso">Congresso</option>
                <option value="reuniao">Reunião</option>
                <option value="seminario">Seminário</option>
                <option value="evento">Evento especial</option>
              </select>
            </label>
            <Field
              label="Início"
              name="inicio"
              type="datetime-local"
              defaultValue={localInput(event.inicio)}
              required
            />
            <Field
              label="Fim"
              name="fim"
              type="datetime-local"
              defaultValue={event.fim ? localInput(event.fim) : ""}
            />
            <Field label="Local" name="local" defaultValue={event.local ?? ""} />
            <Field label="Pregador" name="pregador" defaultValue={event.pregador ?? ""} />
            <Field label="Dirigente" name="dirigente" defaultValue={event.dirigente ?? ""} />
            <Field label="Tema" name="tema" defaultValue={event.tema ?? ""} />
            <Field
              label="Texto bíblico"
              name="texto_biblico"
              defaultValue={event.texto_biblico ?? ""}
            />
            <label className="grid gap-2 text-sm font-bold">
              Público
              <select className="input" name="publico" defaultValue={event.publico ?? "todos"}>
                <option value="todos">Todos</option>
                <option value="membros">Membros</option>
                <option value="jovens">Jovens</option>
                <option value="mulheres">Mulheres</option>
                <option value="homens">Homens</option>
                <option value="criancas">Crianças</option>
                <option value="lideranca">Liderança</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold sm:col-span-2 lg:col-span-3">
              Descrição
              <textarea
                name="descricao"
                defaultValue={event.descricao ?? ""}
                className="min-h-24 rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 placeholder:text-slate-500"
              />
            </label>

            {event.serie_id ? (
              <label className="grid gap-2 text-sm font-bold text-slate-800 sm:col-span-2 lg:col-span-3">
                Aplicar esta alteração em
                <select className="input" name="escopo_recorrencia" defaultValue="este">
                  <option value="este">Somente este culto/evento</option>
                  <option value="futuros">Este e todos os próximos da série</option>
                  <option value="serie">Toda a recorrência, inclusive anteriores</option>
                </select>
                <span className="text-xs font-medium leading-5 text-slate-600">
                  Se mudar data ou horário em “este e próximos”, os próximos eventos serão deslocados pelo mesmo intervalo.
                </span>
              </label>
            ) : (
              <input type="hidden" name="escopo_recorrencia" value="este" />
            )}

            <div className="sm:col-span-2 lg:col-span-3">
              <EventSubmitButton
                className="min-h-12 rounded-2xl bg-slate-900 px-6 font-black text-white"
                label="Salvar alterações"
                pendingLabel="Salvando..."
              />
            </div>
          </form>
        </details>
      ) : null}

      {canManage ? (
        <section className="rounded-[28px] border border-emerald-950/10 bg-white">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-black">Lista de presença</h2>
              <p className="mt-1 text-sm text-slate-500">
                {presentCount} presentes de {members.length} membros/visitantes ativos.
              </p>
            </div>
            <form action={markAllElshadayAttendance}>
              <input type="hidden" name="evento_id" value={id} />
              <input type="hidden" name="return_to" value={"/elshaday/eventos/" + id} />
              <button className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white">
                <Check size={16} /> Marcar todos presentes
              </button>
            </form>
          </div>

          {!members.length ? (
            <p className="p-8 text-center text-slate-500">Nenhum membro ativo cadastrado.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((member: any) => {
                const present = presenceMap.get(String(member.id)) === true;
                return (
                  <div className="flex items-center justify-between gap-4 p-4" key={member.id}>
                    <div>
                      <p className="font-black">{member.nome}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {member.situacao}
                        {member.ministerio ? " · " + member.ministerio : ""}
                      </p>
                    </div>
                    <form action={saveElshadayAttendance}>
                      <input type="hidden" name="evento_id" value={id} />
                      <input type="hidden" name="membro_id" value={member.id} />
                      <input type="hidden" name="presente" value={present ? "false" : "true"} />
                      <input type="hidden" name="return_to" value={"/elshaday/eventos/" + id} />
                      <button
                        className={
                          "inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-black " +
                          (present
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600")
                        }
                      >
                        {present ? (
                          <>
                            <Check size={16} /> Presente
                          </>
                        ) : (
                          <>
                            <CircleX size={16} /> Ausente
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <style>
        {".input{min-height:3rem;border-radius:1rem;border:1px solid #cbd5e1;background:#fff!important;padding:0 1rem;outline:none;color:#0f172a!important;-webkit-text-fill-color:#0f172a!important;opacity:1;color-scheme:light}.input::placeholder{color:#64748b!important;-webkit-text-fill-color:#64748b!important;opacity:1}.input:focus{border-color:#047857;box-shadow:0 0 0 1px #047857}.input option{background:#fff;color:#0f172a}input:-webkit-autofill{-webkit-text-fill-color:#0f172a!important;-webkit-box-shadow:0 0 0 1000px #fff inset!important}"}
      </style>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[24px] border border-emerald-950/10 bg-white p-5">
      <div className="flex items-center gap-2 text-[#176445]">
        {icon}
        <span className="text-xs font-black uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-black">{value}</p>
    </article>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-slate-700">{String(value ?? "") || "—"}</dd>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = false
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <input className="input" name={name} type={type} defaultValue={defaultValue} required={required} />
    </label>
  );
}

function Message({ text, success = false }: { text: string; success?: boolean }) {
  return (
    <div
      className={
        "rounded-2xl border p-4 text-sm font-bold " +
        (success
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-800")
      }
    >
      {text}
    </div>
  );
}

function localInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Araguaina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>;
  return values.year + "-" + values.month + "-" + values.day + "T" + values.hour + ":" + values.minute;
}

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function recurrenceLabel(value: string) {
  const labels: Record<string, string> = {
    diaria: "diária",
    semanal: "semanal",
    quinzenal: "quinzenal",
    mensal: "mensal"
  };
  return labels[value] ?? "recorrente";
}

function dateOnlyBR(value: string) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[3] + "/" + match[2] + "/" + match[1] : value;
}

function statusClass(value: string) {
  if (value === "realizado") return "bg-emerald-100 text-emerald-800";
  if (value === "cancelado") return "bg-red-100 text-red-700";
  return "bg-sky-100 text-sky-800";
}
