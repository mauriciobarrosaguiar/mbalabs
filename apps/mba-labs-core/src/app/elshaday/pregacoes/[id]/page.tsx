import Link from "next/link";
import {
  Archive,
  ArrowLeft,
  BookMarked,
  ExternalLink,
  FileText,
  Headphones,
  PencilLine,
  RotateCcw,
  Video
} from "lucide-react";
import {
  dateBR,
  hasElshadayRole,
  requireElshadayContext
} from "@/lib/elshaday";
import {
  setElshadaySermonStatus,
  updateElshadaySermon
} from "../../completion-actions";

export const dynamic = "force-dynamic";

export default async function SermonDetail({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/pregacoes/" + id);
  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "secretaria", "lider"]);

  const { data: sermon, error } = await context.admin
    .from("igreja_pregacoes")
    .select("*")
    .eq("igreja_id", context.igreja.id)
    .eq("id", id)
    .maybeSingle();

  if (error || !sermon) throw new Error("Pregação não localizada.");

  const ok = read(query.ok);
  const errorMessage = read(query.erro);
  const points = Array.isArray(sermon.pontos) ? sermon.pontos : [];

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <Link
          href="/elshaday/pregacoes"
          className="inline-flex items-center gap-2 text-sm font-black text-[#176445]"
        >
          <ArrowLeft size={16} /> Voltar ao acervo
        </Link>
        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">
              {dateBR(sermon.data_pregacao)} · {sermon.pregador}
            </p>
            <h1 className="mt-1 text-3xl font-black">{sermon.titulo}</h1>
            {sermon.tema ? <p className="mt-2 text-lg font-bold text-[#176445]">{sermon.tema}</p> : null}
          </div>
          <span className={"rounded-full px-3 py-1 text-xs font-black " + (sermon.status === "arquivado" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800")}>
            {sermon.status}
          </span>
        </div>
      </header>

      {ok ? <Message success text="Alteração concluída." /> : null}
      {errorMessage ? <Message text={errorMessage} /> : null}

      {sermon.texto_base ? (
        <section className="rounded-[28px] bg-[#123d2d] p-6 text-white">
          <div className="flex items-center gap-2 text-[#f1d79d]">
            <BookMarked size={19} />
            <span className="text-xs font-black uppercase tracking-wide">Texto base</span>
          </div>
          <p className="mt-3 text-xl font-black">{sermon.texto_base}</p>
          {Array.isArray(sermon.versiculos) && sermon.versiculos.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {sermon.versiculos.map((verse: string) => (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold" key={verse}>
                  {verse}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-4">
        <Content title="Introdução" value={sermon.introducao} />
        <Content title="Esboço / resumo" value={sermon.esboco} />
        {points.length ? (
          <article className="rounded-[28px] border border-emerald-950/10 bg-white p-6">
            <h2 className="text-xl font-black">Pontos da mensagem</h2>
            <ol className="mt-4 grid gap-3">
              {points.map((point: any, index: number) => (
                <li className="flex gap-3 rounded-2xl bg-slate-50 p-4" key={index}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#123d2d] text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-sm leading-6 text-slate-700">{String(point.texto ?? point)}</p>
                </li>
              ))}
            </ol>
          </article>
        ) : null}
        <Content title="Conclusão" value={sermon.conclusao} />
        <Content title="Observações" value={sermon.observacoes} />
      </section>

      {(sermon.video_url || sermon.audio_url || sermon.arquivo_url) ? (
        <section className="grid gap-3 sm:grid-cols-3">
          {sermon.video_url ? <Resource href={sermon.video_url} icon={<Video size={19} />} label="Abrir vídeo" /> : null}
          {sermon.audio_url ? <Resource href={sermon.audio_url} icon={<Headphones size={19} />} label="Abrir áudio" /> : null}
          {sermon.arquivo_url ? <Resource href={sermon.arquivo_url} icon={<FileText size={19} />} label="Abrir arquivo" /> : null}
        </section>
      ) : null}

      {canManage ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <details className="rounded-[28px] border border-emerald-950/10 bg-white p-5">
            <summary className="cursor-pointer list-none font-black">
              <span className="inline-flex items-center gap-2">
                <PencilLine size={18} /> Editar pregação
              </span>
            </summary>
            <form action={updateElshadaySermon} className="mt-5 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="pregacao_id" value={id} />
              <input type="hidden" name="return_to" value={"/elshaday/pregacoes/" + id} />
              <Field label="Título" name="titulo" defaultValue={sermon.titulo} required />
              <Field label="Tema" name="tema" defaultValue={sermon.tema ?? ""} />
              <Field label="Pregador" name="pregador" defaultValue={sermon.pregador} required />
              <Field label="Data" name="data_pregacao" type="date" defaultValue={sermon.data_pregacao} />
              <Field label="Texto base" name="texto_base" defaultValue={sermon.texto_base ?? ""} />
              <Field
                label="Versículos relacionados"
                name="versiculos"
                defaultValue={Array.isArray(sermon.versiculos) ? sermon.versiculos.join(", ") : ""}
              />
              <TextArea label="Introdução" name="introducao" defaultValue={sermon.introducao ?? ""} />
              <TextArea label="Esboço / resumo" name="esboco" defaultValue={sermon.esboco ?? ""} />
              <TextArea
                label="Pontos (um por linha)"
                name="pontos"
                defaultValue={points.map((point: any) => String(point.texto ?? point)).join("\n")}
              />
              <TextArea label="Conclusão" name="conclusao" defaultValue={sermon.conclusao ?? ""} />
              <TextArea label="Observações" name="observacoes" defaultValue={sermon.observacoes ?? ""} />
              <Field label="Vídeo" name="video_url" type="url" defaultValue={sermon.video_url ?? ""} />
              <Field label="Áudio" name="audio_url" type="url" defaultValue={sermon.audio_url ?? ""} />
              <Field label="Arquivo" name="arquivo_url" type="url" defaultValue={sermon.arquivo_url ?? ""} />
              <div className="sm:col-span-2">
                <button className="min-h-12 rounded-2xl bg-slate-900 px-6 font-black text-white">
                  Salvar alterações
                </button>
              </div>
            </form>
          </details>

          <article className="rounded-[28px] border border-slate-200 bg-slate-50 p-5 lg:w-64">
            <h2 className="font-black">Organização do acervo</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Arquivar preserva a mensagem e retira da lista principal.
            </p>
            <form action={setElshadaySermonStatus} className="mt-4">
              <input type="hidden" name="pregacao_id" value={id} />
              <input type="hidden" name="status" value={sermon.status === "arquivado" ? "ativo" : "arquivado"} />
              <input type="hidden" name="return_to" value={"/elshaday/pregacoes/" + id} />
              <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black">
                {sermon.status === "arquivado" ? <RotateCcw size={17} /> : <Archive size={17} />}
                {sermon.status === "arquivado" ? "Restaurar" : "Arquivar"}
              </button>
            </form>
          </article>
        </section>
      ) : null}

      <style>
        {".input{min-height:3rem;border-radius:1rem;border:1px solid rgb(226 232 240);background:white;padding:0 1rem;outline:none}.input:focus{border-color:rgb(5 150 105)}"}
      </style>
    </div>
  );
}

function Content({ title, value }: { title: string; value: unknown }) {
  if (!value) return null;
  return (
    <article className="rounded-[28px] border border-emerald-950/10 bg-white p-6">
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{String(value)}</p>
    </article>
  );
}

function Resource({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-emerald-950/10 bg-white px-4 font-black text-[#176445]"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      <span className="flex items-center gap-2">{icon}{label}</span>
      <ExternalLink size={16} />
    </a>
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

function TextArea({
  label,
  name,
  defaultValue
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <textarea
        className="min-h-28 rounded-2xl border border-slate-200 p-4"
        name={name}
        defaultValue={defaultValue}
      />
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

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
