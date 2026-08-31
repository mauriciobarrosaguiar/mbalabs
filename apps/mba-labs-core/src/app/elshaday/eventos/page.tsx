import Link from "next/link";
import { randomUUID } from "node:crypto";
import { CalendarDays, Filter, Plus, Repeat2, Search } from "lucide-react";
import { createElshadayEvent } from "../actions";
import { dateTimeBR, hasElshadayRole, requireElshadayContext } from "@/lib/elshaday";
import { EventSubmitButton } from "./EventSubmitButton";

export const dynamic = "force-dynamic";

export default async function ElshadayEventsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/eventos");
  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria", "lider"]);
  const q = read(query.q);
  const status = read(query.status);
  const type = read(query.tipo);

  let request = context.admin
    .from("igreja_eventos")
    .select("id,titulo,tipo,descricao,inicio,fim,local,pregador,dirigente,tema,texto_biblico,publico,status,serie_id,recorrencia_tipo,recorrencia_ate,recorrencia_ordem")
    .eq("igreja_id", context.igreja.id)
    .order("inicio", { ascending: false })
    .limit(250);

  if (status && ["agendado", "realizado", "cancelado"].includes(status)) {
    request = request.eq("status", status);
  }
  if (type) request = request.eq("tipo", type);
  if (q) {
    const term = escapeLike(q);
    request = request.or(
      "titulo.ilike.%" + term + "%,tema.ilike.%" + term + "%,pregador.ilike.%" + term + "%,local.ilike.%" + term + "%"
    );
  }

  const { data: events, error } = await request;
  if (error) throw new Error("Falha ao carregar eventos: " + error.message);

  const now = Date.now();
  const rows = events ?? [];
  const upcoming = rows.filter(
    (event: any) => new Date(event.inicio).getTime() >= now && event.status === "agendado"
  );
  const upcomingIds = new Set(upcoming.map((item: any) => String(item.id)));
  const history = rows.filter((event: any) => !upcomingIds.has(String(event.id)));
  const createIdempotencyKey = randomUUID();

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Agenda</p>
          <h1 className="mt-1 text-3xl font-black">Cultos e eventos</h1>
          <p className="mt-2 text-slate-600">
            {upcoming.length} programações futuras · {history.length} no histórico.
          </p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <CalendarDays size={25} />
        </div>
      </header>

      <form
        className="grid gap-3 rounded-[24px] border border-emerald-950/10 bg-white p-4 md:grid-cols-[1fr_180px_180px_auto]"
        method="get"
      >
        <label className="relative">
          <Search className="absolute left-3 top-3.5 text-slate-400" size={17} />
          <input
            className="input pl-10"
            name="q"
            defaultValue={q}
            placeholder="Buscar título, tema, pregador ou local"
          />
        </label>
        <select className="input" name="status" defaultValue={status}>
          <option value="">Todos os status</option>
          <option value="agendado">Agendado</option>
          <option value="realizado">Realizado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <select className="input" name="tipo" defaultValue={type}>
          <option value="">Todos os tipos</option>
          <option value="culto">Culto</option>
          <option value="ceia">Santa Ceia</option>
          <option value="ebd">Escola Bíblica</option>
          <option value="vigilia">Vigília</option>
          <option value="congresso">Congresso</option>
          <option value="reuniao">Reunião</option>
          <option value="evento">Evento especial</option>
        </select>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 font-black text-white">
          <Filter size={17} /> Filtrar
        </button>
      </form>

      {canManage ? (
        <details
          className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm"
          open={rows.length === 0}
        >
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2">
              <Plus size={19} className="text-[#176445]" /> Novo culto ou evento
            </span>
          </summary>

          <form action={createElshadayEvent} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="idempotency_key" value={createIdempotencyKey} />
            <Field label="Título" name="titulo" required placeholder="Ex.: Culto de Celebração" />
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Tipo
              <select className="input" name="tipo" defaultValue="culto">
                <option value="culto">Culto</option>
                <option value="ceia">Santa Ceia</option>
                <option value="ebd">Escola Bíblica</option>
                <option value="vigilia">Vigília</option>
                <option value="congresso">Congresso</option>
                <option value="reuniao">Reunião</option>
                <option value="evento">Evento especial</option>
              </select>
            </label>
            <Field label="Data e horário" name="inicio" type="datetime-local" required />
            <Field label="Término (opcional)" name="fim" type="datetime-local" />
            <Field label="Local" name="local" placeholder="Templo sede" />
            <Field label="Pregador" name="pregador" />
            <Field label="Dirigente" name="dirigente" />
            <Field label="Tema" name="tema" />
            <Field label="Texto bíblico" name="texto_biblico" placeholder="Ex.: Salmos 23" />
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Público
              <select className="input" name="publico" defaultValue="todos">
                <option value="todos">Todos</option>
                <option value="membros">Membros</option>
                <option value="jovens">Jovens</option>
                <option value="mulheres">Mulheres</option>
                <option value="homens">Homens</option>
                <option value="criancas">Crianças</option>
                <option value="lideranca">Liderança</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Recorrência
              <select className="input" name="recorrencia_tipo" defaultValue="nenhuma">
                <option value="nenhuma">Não repetir</option>
                <option value="diaria">Todos os dias</option>
                <option value="semanal">Toda semana</option>
                <option value="quinzenal">A cada 15 dias</option>
                <option value="mensal">Todo mês</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              Repetir até
              <input className="input" name="recorrencia_ate" type="date" />
              <span className="text-xs font-medium leading-5 text-slate-600">
                Preencha somente quando escolher uma recorrência.
              </span>
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2 lg:col-span-3">
              Descrição / programação
              <textarea
                className="min-h-24 rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 outline-none placeholder:text-slate-500 focus:border-emerald-700"
                name="descricao"
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <EventSubmitButton
                className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white"
                label="Salvar programação"
                pendingLabel="Salvando..."
              />
            </div>
          </form>
        </details>
      ) : null}

      <EventSection title="Próximas programações" rows={upcoming} />
      {history.length ? <EventSection title="Histórico" rows={history} /> : null}

      <style>
        {".input{min-height:3rem;border-radius:1rem;border:1px solid #cbd5e1;background:#fff!important;padding:0 1rem;outline:none;color:#0f172a!important;-webkit-text-fill-color:#0f172a!important;opacity:1;color-scheme:light}.input::placeholder{color:#64748b!important;-webkit-text-fill-color:#64748b!important;opacity:1}.input:focus{border-color:#047857;box-shadow:0 0 0 1px #047857}.input option{background:#fff;color:#0f172a}input:-webkit-autofill{-webkit-text-fill-color:#0f172a!important;-webkit-box-shadow:0 0 0 1000px #fff inset!important}"}
      </style>
    </div>
  );
}

function EventSection({ title, rows }: { title: string; rows: any[] }) {
  return (
    <section className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">{title}</h2>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
          {rows.length}
        </span>
      </div>
      {!rows.length ? (
        <div className="rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Nenhuma programação nesta seção.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((event: any) => (
            <Link
              className="rounded-[26px] border border-emerald-950/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              href={"/elshaday/eventos/" + event.id}
              key={event.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.12em] text-[#176445]">{event.tipo}</p>
                  <h3 className="mt-1 text-xl font-black">{event.titulo}</h3>
                  {event.serie_id ? (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-amber-800">
                      <Repeat2 size={13} />
                      {recurrenceLabel(event.recorrencia_tipo)}
                    </span>
                  ) : null}
                </div>
                <span className={"rounded-full px-3 py-1 text-xs font-black " + statusClass(event.status)}>
                  {event.status}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-slate-700">{dateTimeBR(event.inicio)}</p>
              {event.tema ? <p className="mt-3 font-bold text-[#176445]">{event.tema}</p> : null}
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {[
                  event.pregador ? "Pregador: " + event.pregador : null,
                  event.local
                ].filter(Boolean).join(" · ") || "Programação em definição"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input className="input" name={name} type={type} required={required} placeholder={placeholder} />
    </label>
  );
}

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function escapeLike(value: string) {
  return value.replace(/[%,]/g, " ").trim();
}

function recurrenceLabel(value: string) {
  const labels: Record<string, string> = {
    diaria: "Diário",
    semanal: "Semanal",
    quinzenal: "Quinzenal",
    mensal: "Mensal"
  };
  return labels[value] ?? "Recorrente";
}

function statusClass(value: string) {
  if (value === "realizado") return "bg-emerald-100 text-emerald-800";
  if (value === "cancelado") return "bg-red-100 text-red-700";
  return "bg-sky-100 text-sky-800";
}
