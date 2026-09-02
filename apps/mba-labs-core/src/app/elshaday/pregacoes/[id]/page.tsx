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
  const fullMessage = buildFullMessage(sermon, points);

  return (
    <div className="mx-auto grid min-w-0 max-w-5xl gap-6">
      {sermon.banner_url ? (
        <div className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white shadow-sm">
          <img
            alt={"Capa de " + sermon.titulo}
            className="aspect-[16/9] w-full object-cover"
            src={sermon.banner_url}
          />
        </div>
      ) : null}

      <header className="min-w-0">
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
            <h1 className="mt-1 break-words text-2xl font-black leading-tight sm:text-3xl">{sermon.titulo}</h1>
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
        <Content title="Palavra / mensagem" value={sermon.esboco} />
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
            <form action={updateElshadaySermon} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
              <input type="hidden" name="pregacao_id" value={id} />
              <input type="hidden" name="return_to" value={"/elshaday/pregacoes/" + id} />
              <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-800 sm:col-span-2">
                Trocar imagem de capa
                <input
                  className="w-full min-w-0 rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
                  name="imagem"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
                <span className="text-xs font-medium leading-5 text-slate-500">
                  Opcional. Se escolher uma nova imagem, ela substitui a capa atual.
                </span>
              </label>
              <Field label="Título / tema da mensagem" name="titulo" defaultValue={sermon.titulo} required />
              <Field label="Pregador" name="pregador" defaultValue={sermon.pregador} required />
              <Field label="Data" name="data_pregacao" type="date" defaultValue={sermon.data_pregacao} />
              <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-800 sm:col-span-2">
                Palavra / mensagem completa
                <textarea
                  className="min-h-72 min-w-0 rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 placeholder:text-slate-500"
                  name="esboco"
                  defaultValue={fullMessage}
                  required
                />
                <span className="text-xs font-medium leading-5 text-slate-500">
                  Edite tudo em um único campo. Ao salvar, a mensagem fica consolidada.
                </span>
              </label>
              <details className="rounded-2xl border border-slate-200 bg-slate-50 sm:col-span-2">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-slate-700">
                  Links e anexos (opcional)
                </summary>
                <div className="grid gap-4 border-t border-slate-200 p-4 sm:grid-cols-2">
                  <Field label="Vídeo" name="video_url" type="url" defaultValue={sermon.video_url ?? ""} />
                  <Field label="Áudio" name="audio_url" type="url" defaultValue={sermon.audio_url ?? ""} />
                  <Field label="Arquivo" name="arquivo_url" type="url" defaultValue={sermon.arquivo_url ?? ""} />
                </div>
              </details>
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
        {".input{min-height:3rem;min-width:0;width:100%;border-radius:1rem;border:1px solid #cbd5e1;background:#fff!important;padding:0 1rem;outline:none;color:#0f172a!important;-webkit-text-fill-color:#0f172a!important;color-scheme:light}.input::placeholder{color:#64748b!important;opacity:1}.input:focus{border-color:#047857;box-shadow:0 0 0 1px #047857}"}
      </style>
    </div>
  );
}

function buildFullMessage(sermon: any, points: any[]) {
  const hasLegacySections =
    Boolean(sermon.tema) ||
    Boolean(sermon.texto_base) ||
    (Array.isArray(sermon.versiculos) && sermon.versiculos.length > 0) ||
    Boolean(sermon.introducao) ||
    points.length > 0 ||
    Boolean(sermon.conclusao) ||
    Boolean(sermon.observacoes);

  if (!hasLegacySections) return String(sermon.esboco ?? "");

  const sections: string[] = [];
  if (sermon.tema && String(sermon.tema).trim() !== String(sermon.titulo).trim()) {
    sections.push("Tema: " + sermon.tema);
  }
  if (sermon.texto_base) sections.push("Texto base: " + sermon.texto_base);
  if (Array.isArray(sermon.versiculos) && sermon.versiculos.length) {
    sections.push("Versículos relacionados: " + sermon.versiculos.join(", "));
  }
  if (sermon.introducao) sections.push("Introdução\n" + sermon.introducao);
  if (sermon.esboco) sections.push(String(sermon.esboco));
  if (points.length) {
    sections.push(
      "Pontos da mensagem\n" +
        points.map((point: any, index: number) => `${index + 1}. ${String(point.texto ?? point)}`).join("\n")
    );
  }
  if (sermon.conclusao) sections.push("Conclusão\n" + sermon.conclusao);
  if (sermon.observacoes) sections.push("Observações\n" + sermon.observacoes);
  return sections.filter(Boolean).join("\n\n");
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
        className="min-h-28 min-w-0 rounded-2xl border border-slate-300 bg-white p-4 text-slate-900 placeholder:text-slate-500"
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
