import Link from "next/link";
import { Archive, BookMarked, Mic2, Plus, Search } from "lucide-react";
import { createElshadaySermon } from "../actions";
import {
  dateBR,
  hasElshadayRole,
  requireElshadayContext
} from "@/lib/elshaday";

export const dynamic = "force-dynamic";

export default async function ElshadaySermonsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/pregacoes");
  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria", "lider"]);
  const q = read(query.q);
  const status = read(query.status) || "ativo";

  let request = context.admin
    .from("igreja_pregacoes")
    .select("id,titulo,tema,pregador,data_pregacao,texto_base,versiculos,esboco,status")
    .eq("igreja_id", context.igreja.id)
    .order("data_pregacao", { ascending: false })
    .limit(250);

  if (["ativo", "arquivado"].includes(status)) request = request.eq("status", status);
  if (q) {
    const term = q.replace(/[%,]/g, " ").trim();
    request = request.or(
      "titulo.ilike.%" + term + "%,tema.ilike.%" + term + "%,pregador.ilike.%" + term + "%,texto_base.ilike.%" + term + "%"
    );
  }

  const { data: sermons, error } = await request;
  if (error) throw new Error("Falha ao carregar pregações: " + error.message);
  const rows = sermons ?? [];

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Acervo espiritual</p>
          <h1 className="mt-1 text-3xl font-black">Temas e pregações</h1>
          <p className="mt-2 text-slate-600">{rows.length} mensagens encontradas.</p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <Mic2 size={25} />
        </div>
      </header>

      <form className="grid gap-3 rounded-[24px] border border-emerald-950/10 bg-white p-4 md:grid-cols-[1fr_180px_auto]" method="get">
        <label className="relative">
          <Search className="absolute left-3 top-3.5 text-slate-400" size={17} />
          <input
            className="input pl-10"
            name="q"
            defaultValue={q}
            placeholder="Buscar título, tema, pregador ou texto base"
          />
        </label>
        <select className="input" name="status" defaultValue={status}>
          <option value="ativo">Ativas</option>
          <option value="arquivado">Arquivadas</option>
        </select>
        <button className="min-h-12 rounded-2xl bg-slate-900 px-5 font-black text-white">Buscar</button>
      </form>

      {canManage ? (
        <details
          className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm"
          open={rows.length === 0}
        >
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2">
              <Plus size={19} className="text-[#176445]" /> Registrar pregação
            </span>
          </summary>
          <form action={createElshadaySermon} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Título da mensagem" name="titulo" required />
            <Field label="Tema" name="tema" />
            <Field label="Pregador" name="pregador" required />
            <Field
              label="Data da pregação"
              name="data_pregacao"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
            <Field label="Texto base" name="texto_base" placeholder="Ex.: João 3:16" />
            <Field
              label="Versículos relacionados"
              name="versiculos"
              placeholder="Salmos 23:1, Romanos 8:28"
            />
            <TextArea label="Introdução" name="introducao" />
            <TextArea label="Esboço / resumo" name="esboco" />
            <TextArea label="Pontos da mensagem (um por linha)" name="pontos" />
            <TextArea label="Conclusão" name="conclusao" />
            <TextArea label="Observações" name="observacoes" />
            <Field label="Link do vídeo" name="video_url" type="url" placeholder="https://..." />
            <Field label="Link do áudio" name="audio_url" type="url" placeholder="https://..." />
            <Field label="Link de arquivo" name="arquivo_url" type="url" placeholder="https://..." />
            <div className="sm:col-span-2 lg:col-span-3">
              <button className="min-h-12 rounded-2xl bg-[#123d2d] px-6 font-black text-white">
                Salvar pregação
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {!rows.length ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {status === "arquivado" ? <Archive className="mx-auto mb-3" size={30} /> : <BookMarked className="mx-auto mb-3" size={30} />}
          Nenhuma pregação encontrada.
        </div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((sermon: any) => (
            <Link
              className="rounded-[26px] border border-emerald-950/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              href={"/elshaday/pregacoes/" + sermon.id}
              key={sermon.id}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">
                  {dateBR(sermon.data_pregacao)}
                </span>
                <BookMarked className="text-[#d0a24a]" size={20} />
              </div>
              <h2 className="mt-4 text-xl font-black">{sermon.titulo}</h2>
              {sermon.tema ? <p className="mt-2 font-bold text-[#176445]">{sermon.tema}</p> : null}
              <p className="mt-3 text-sm text-slate-600">{sermon.pregador}</p>
              {sermon.texto_base ? (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold">
                  📖 {sermon.texto_base}
                </p>
              ) : null}
              {sermon.esboco ? (
                <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-600">{sermon.esboco}</p>
              ) : null}
            </Link>
          ))}
        </section>
      )}

      <style>
        {".input{min-height:3rem;border-radius:1rem;border:1px solid rgb(226 232 240);background:white;padding:0 1rem;outline:none}.input:focus{border-color:rgb(5 150 105)}"}
      </style>
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
      <input
        className="input"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
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

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
