import { CalendarDays, Plus } from "lucide-react";
import { createElshadayEvent } from "../actions";
import {
  dateTimeBR,
  hasElshadayRole,
  requireElshadayContext
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export default async function ElshadayEventsPage() {
  const context = await requireElshadayContext("/elshaday/eventos");
  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria", "lider"]);

  const { data: events, error } = await context.admin
    .from("igreja_eventos")
    .select("id,titulo,tipo,descricao,inicio,fim,local,pregador,dirigente,tema,texto_biblico,publico,status")
    .eq("igreja_id", context.igreja.id)
    .order("inicio", { ascending: false })
    .limit(100);

  if (error) throw new Error(\`Falha ao carregar eventos: \${error.message}\`);

  const now = Date.now();
  const upcoming = (events ?? []).filter((event: any) => new Date(event.inicio).getTime() >= now && event.status !== "cancelado");
  const past = (events ?? []).filter((event: any) => new Date(event.inicio).getTime() < now || event.status === "realizado");

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Agenda</p>
          <h1 className="mt-1 text-3xl font-black">Cultos e eventos</h1>
          <p className="mt-2 text-slate-600">{upcoming.length} programações futuras cadastradas.</p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <CalendarDays size={25} />
        </div>
      </header>

      {canManage ? (
        <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm" open={(events ?? []).length === 0}>
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2"><Plus size={19} className="text-[#176445]" /> Novo culto ou evento</span>
          </summary>
          <form action={createElshadayEvent} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2 lg:col-span-3">
              Descrição / programação
              <textarea className="min-h-24 rounded-2xl border border-slate-200 p-4 outline-none focus:border-emerald-600" name="descricao" />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white" type="submit">
                Salvar programação
              </button>
            </div>
          </form>
        </details>
      ) : null}

      <section className="grid gap-4">
        <SectionTitle title="Próximas programações" count={upcoming.length} />
        {upcoming.length === 0 ? (
          <Empty text="Nenhum culto futuro cadastrado." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {upcoming.map((event: any) => <EventCard key={event.id} event={event} />)}
          </div>
        )}
      </section>

      {past.length > 0 ? (
        <section className="grid gap-4">
          <SectionTitle title="Histórico recente" count={past.length} />
          <div className="grid gap-4 lg:grid-cols-2">
            {past.slice(0, 12).map((event: any) => <EventCard key={event.id} event={event} muted />)}
          </div>
        </section>
      ) : null}

      <style>{\`
        .input {
          min-height: 3rem;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0 1rem;
          outline: none;
        }
        .input:focus { border-color: rgb(5 150 105); }
      \`}</style>
    </div>
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
      <input className="input" name={name} placeholder={placeholder} required={required} type={type} />
    </label>
  );
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl font-black">{title}</h2>
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{count}</span>
    </div>
  );
}

function EventCard({ event, muted = false }: { event: any; muted?: boolean }) {
  return (
    <article className={\`rounded-[26px] border border-emerald-950/10 bg-white p-5 \${muted ? "opacity-75" : ""}\`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.12em] text-[#176445]">{event.tipo}</p>
          <h3 className="mt-1 text-xl font-black">{event.titulo}</h3>
        </div>
        <span className="rounded-full bg-[#123d2d] px-3 py-1 text-xs font-black text-white">{dateTimeBR(event.inicio)}</span>
      </div>
      {event.tema ? <p className="mt-4 font-bold text-[#176445]">{event.tema}</p> : null}
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {[event.pregador ? \`Pregador: \${event.pregador}\` : null, event.dirigente ? \`Dirigente: \${event.dirigente}\` : null, event.local].filter(Boolean).join(" · ") || "Programação em definição"}
      </p>
      {event.texto_biblico ? <p className="mt-3 text-sm font-semibold text-slate-700">📖 {event.texto_biblico}</p> : null}
    </article>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">{text}</div>;
}
