import { BookMarked, Mic2, Plus } from "lucide-react";
import { createElshadaySermon } from "../actions";
import {
  dateBR,
  hasElshadayRole,
  requireElshadayContext
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export default async function ElshadaySermonsPage() {
  const context = await requireElshadayContext("/elshaday/pregacoes");
  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria", "lider"]);

  const { data: sermons, error } = await context.admin
    .from("igreja_pregacoes")
    .select("id,titulo,tema,pregador,data_pregacao,texto_base,versiculos,esboco,introducao,pontos,conclusao,video_url")
    .eq("igreja_id", context.igreja.id)
    .order("data_pregacao", { ascending: false })
    .limit(100);

  if (error) throw new Error(\`Falha ao carregar pregações: \${error.message}\`);

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Acervo espiritual</p>
          <h1 className="mt-1 text-3xl font-black">Temas e pregações</h1>
          <p className="mt-2 text-slate-600">{(sermons ?? []).length} mensagens registradas no acervo.</p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <Mic2 size={25} />
        </div>
      </header>

      {canManage ? (
        <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm" open={(sermons ?? []).length === 0}>
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2"><Plus size={19} className="text-[#176445]" /> Registrar pregação</span>
          </summary>
          <form action={createElshadaySermon} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Título da mensagem" name="titulo" required />
            <Field label="Tema" name="tema" />
            <Field label="Pregador" name="pregador" required />
            <Field label="Data da pregação" name="data_pregacao" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            <Field label="Texto base" name="texto_base" placeholder="Ex.: João 3:16" />
            <Field label="Versículos relacionados" name="versiculos" placeholder="Salmos 23:1, Romanos 8:28" />
            <TextArea label="Introdução" name="introducao" />
            <TextArea label="Esboço / resumo" name="esboco" />
            <TextArea label="Pontos da mensagem (um por linha)" name="pontos" />
            <TextArea label="Conclusão" name="conclusao" />
            <TextArea label="Observações" name="observacoes" />
            <Field label="Link do vídeo" name="video_url" type="url" placeholder="https://..." />
            <div className="sm:col-span-2 lg:col-span-3">
              <button className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white" type="submit">
                Salvar pregação
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {(sermons ?? []).length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          <BookMarked className="mx-auto mb-3" size={30} />
          Nenhuma pregação cadastrada.
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(sermons ?? []).map((sermon: any) => (
            <article className="rounded-[26px] border border-emerald-950/10 bg-white p-5" key={sermon.id}>
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{dateBR(sermon.data_pregacao)}</span>
                <BookMarked className="text-[#d0a24a]" size={20} />
              </div>
              <h2 className="mt-4 text-xl font-black">{sermon.titulo}</h2>
              {sermon.tema ? <p className="mt-2 font-bold text-[#176445]">{sermon.tema}</p> : null}
              <p className="mt-3 text-sm text-slate-600">{sermon.pregador}</p>
              {sermon.texto_base ? <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold">📖 {sermon.texto_base}</p> : null}
              {sermon.esboco ? <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">{sermon.esboco}</p> : null}
              {Array.isArray(sermon.versiculos) && sermon.versiculos.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {sermon.versiculos.slice(0, 4).map((verse: string) => (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900" key={verse}>{verse}</span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}

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
  placeholder,
  defaultValue
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input className="input" defaultValue={defaultValue} name={name} placeholder={placeholder} required={required} type={type} />
    </label>
  );
}

function TextArea({ label, name }: { label: string; name: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <textarea className="min-h-28 rounded-2xl border border-slate-200 p-4 outline-none focus:border-emerald-600" name={name} />
    </label>
  );
}
