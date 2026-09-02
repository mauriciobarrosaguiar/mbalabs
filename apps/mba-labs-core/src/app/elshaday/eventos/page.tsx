import Link from "next/link";
import { randomUUID } from "node:crypto";
import { CalendarDays, ChevronRight, Filter, MapPin, Plus, Repeat2, Search } from "lucide-react";
import { createElshadayEvent } from "../actions";
import { dateTimeBR, hasElshadayRole, requireElshadayContext } from "@/lib/elshaday";
import { EventSubmitButton } from "./EventSubmitButton";
import { ElshadayMediaCarousel } from "../ElshadayMediaCarousel";

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
    .select("id,titulo,tipo,descricao,inicio,fim,local,pregador,dirigente,tema,texto_biblico,publico,status,serie_id,recorrencia_tipo,recorrencia_ate,recorrencia_ordem,banner_url,destacar_home,ordem_home")
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
  const mediaItems = upcoming
    .filter((event: any) => Boolean(event.banner_url))
    .slice(0, 8)
    .map((event: any) => ({
      id: String(event.id),
      href: "/elshaday/eventos/" + event.id,
      title: event.titulo,
      subtitle: dateTimeBR(event.inicio),
      imageUrl: event.banner_url
    }));

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="hidden flex-col justify-between gap-4 sm:flex-row sm:items-end lg:flex">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Agenda</p>
          <h1 className="mt-1 text-3xl font-black">Cultos e eventos</h1>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <CalendarDays size={25} />
        </div>
      </header>

      <section className="grid gap-4 lg:hidden">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h1 className="mt-0.5 text-[30px] font-black tracking-tight text-slate-950">Agenda</h1>
          </div>
          {canManage ? (
            <a
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#123d2d] px-4 text-sm font-black text-white shadow-sm"
              href="#novo-evento"
            >
              <Plus size={17} />
              Novo
            </a>
          ) : null}
        </div>

        {mediaItems.length ? (
          <ElshadayMediaCarousel items={mediaItems} />
        ) : upcoming[0] ? (
                    <Link
                      className="relative min-h-[220px] overflow-hidden rounded-[28px] bg-[#123d2d] p-5 text-white shadow-[0_16px_38px_rgba(18,61,45,.20)]"
                      href={"/elshaday/eventos/" + upcoming[0].id}
                    >
                      <div className="absolute -right-12 -top-10 size-44 rounded-full bg-[#d4aa54]/25 blur-2xl" />
                      <div className="relative flex min-h-[180px] flex-col">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.14em] text-[#f4d992]">
                            Próximo
                          </span>
                          <CalendarDays size={22} className="text-[#f4d992]" />
                        </div>
                        <div className="mt-auto">
                          <p className="text-xs font-black uppercase tracking-[.14em] text-emerald-100/85">
                            {upcoming[0].tipo}
                          </p>
                          <h2 className="mt-2 text-2xl font-black leading-tight">{upcoming[0].titulo}</h2>
                          <p className="mt-3 font-bold text-emerald-50">{dateTimeBR(upcoming[0].inicio)}</p>
                          {upcoming[0].local ? (
                            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-emerald-50/85">
                              <MapPin size={14} />
                              {upcoming[0].local}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="rounded-[26px] border border-dashed border-emerald-950/15 bg-white p-7 text-center text-slate-600">
                      <CalendarDays className="mx-auto text-[#176445]" size={30} />
                      <p className="mt-3 font-black text-slate-900">Nenhuma programação futura</p>
                    </div>
                  )}

        <details className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-black text-slate-900">
            <span className="inline-flex items-center gap-2">
              <Filter size={18} className="text-[#176445]" />
              Filtrar agenda
            </span>
            <ChevronRight size={18} className="text-slate-600" />
          </summary>
          <form className="grid gap-3 border-t border-slate-100 p-4" method="get">
            <label className="relative">
              <Search className="absolute left-3 top-3.5 text-slate-600" size={17} />
              <input
                className="input pl-10"
                name="q"
                defaultValue={q}
                placeholder="Buscar programação"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select className="input min-w-0" name="status" defaultValue={status}>
                <option value="">Status</option>
                <option value="agendado">Agendado</option>
                <option value="realizado">Realizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
              <select className="input min-w-0" name="tipo" defaultValue={type}>
                <option value="">Tipo</option>
                <option value="culto">Culto</option>
                <option value="ceia">Santa Ceia</option>
                <option value="ebd">EBD</option>
                <option value="vigilia">Vigília</option>
                <option value="congresso">Congresso</option>
                <option value="reuniao">Reunião</option>
                <option value="seminario">Seminário</option>
                <option value="evento">Evento</option>
              </select>
            </div>
            <button className="min-h-12 rounded-2xl bg-slate-900 px-5 font-black text-white" type="submit">
              Aplicar filtros
            </button>
          </form>
        </details>

        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-xl font-black text-slate-950">Próximos</h2>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
              {upcoming.length}
            </span>
          </div>
          <div className="grid gap-3">
            {upcoming.map((event: any) => (
              <Link
                className="flex items-center gap-3 rounded-[22px] border border-emerald-950/10 bg-white p-3 shadow-sm"
                href={"/elshaday/eventos/" + event.id}
                key={event.id}
              >
                {event.banner_url ? (
                  <img
                    alt=""
                    className="size-14 shrink-0 rounded-[16px] object-cover"
                    src={event.banner_url}
                  />
                ) : (
                  <div className="grid size-14 shrink-0 place-items-center rounded-[16px] bg-emerald-50 text-[#123d2d]">
                    <CalendarDays size={22} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-slate-950">{event.titulo}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-600">{dateTimeBR(event.inicio)}</p>
                  {event.local ? <p className="mt-1 truncate text-xs text-slate-600">{event.local}</p> : null}
                </div>
                <ChevronRight className="shrink-0 text-slate-600" size={20} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <form
        className="hidden gap-3 rounded-[24px] border border-emerald-950/10 bg-white p-4 md:grid-cols-[1fr_180px_180px_auto] lg:grid"
        method="get"
      >
        <label className="relative">
          <Search className="absolute left-3 top-3.5 text-slate-600" size={17} />
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
          <option value="seminario">Seminário</option>
          <option value="evento">Evento especial</option>
        </select>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 font-black text-white">
          <Filter size={17} /> Filtrar
        </button>
      </form>

      {canManage ? (
        <details
          id="novo-evento"
          className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm"
        >
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2">
              <Plus size={19} className="text-[#176445]" /> Novo culto ou evento
            </span>
          </summary>

          <form action={createElshadayEvent} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="idempotency_key" value={createIdempotencyKey} />
            <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-800 sm:col-span-2 lg:col-span-3">
              Imagem de capa / banner
              <input
                className="w-full min-w-0 rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
                name="imagem"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
              <span className="text-xs font-medium leading-5 text-slate-600">
                Opcional. JPG, PNG ou WebP de até 5 MB. Em uma recorrência, a mesma capa será usada na série.
              </span>
            </label>
            <div className="grid gap-3 rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4 sm:col-span-2 lg:col-span-3">
              <label className="flex items-start gap-3">
                <input
                  className="mt-0.5 size-5 shrink-0 accent-[#123d2d]"
                  defaultChecked
                  name="destacar_home"
                  type="checkbox"
                />
                <span>
                  <span className="block font-black text-slate-900">Destacar no carrossel da Home</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                    A Agenda controla este destaque. Título, data, imagem e alterações futuras serão refletidos automaticamente na Home.
                  </span>
                </span>
              </label>
              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:max-w-[220px]">
                Ordem na Home
                <input className="input" defaultValue="10" min={0} max={9999} name="ordem_home" type="number" />
              </label>
            </div>
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
                <option value="seminario">Seminário</option>
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
                className="min-h-24 rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 outline-none placeholder:text-slate-600 focus:border-emerald-700"
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

      <div className="hidden lg:grid lg:gap-6">
        <EventSection title="Próximas programações" rows={upcoming} />
        {history.length ? <EventSection title="Histórico" rows={history} /> : null}
      </div>

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
        <div className="rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
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
