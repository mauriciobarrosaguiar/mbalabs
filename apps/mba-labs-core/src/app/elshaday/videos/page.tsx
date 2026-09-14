import Link from "next/link";
import { CalendarDays, ExternalLink, Play, Plus, Video, Youtube } from "lucide-react";
import { dateBR, hasElshadayRole, requireElshadayContext } from "@/lib/elshaday";
import { getYouTubeEmbedUrl, getYouTubeVideoId } from "@/lib/youtube";
import { createElshadayYoutubeVideo } from "./actions";

export const dynamic = "force-dynamic";

export default async function ElshadayVideosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/videos");
  const canManage = hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria", "lider"]);

  const { data, error } = await context.admin
    .from("igreja_pregacoes")
    .select("id,titulo,pregador,data_pregacao,video_url,status")
    .eq("igreja_id", context.igreja.id)
    .eq("status", "ativo")
    .not("video_url", "is", null)
    .order("data_pregacao", { ascending: false })
    .limit(24);

  if (error) throw new Error("Falha ao carregar os vídeos: " + error.message);

  const videos = (data ?? [])
    .map((item: any) => ({
      ...item,
      youtubeId: getYouTubeVideoId(item.video_url),
      embedUrl: getYouTubeEmbedUrl(item.video_url)
    }))
    .filter((item: any) => Boolean(item.youtubeId && item.embedUrl));

  const ok = read(query.ok);
  const errorMessage = read(query.erro);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5 sm:gap-6">
      <header className="flex min-w-0 items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Cultos e mensagens</p>
          <h1 className="mt-1 text-[30px] font-black tracking-tight text-slate-950 sm:text-4xl">Vídeos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Assista aos cultos e mensagens gravados no YouTube sem sair do aplicativo.
          </p>
        </div>
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-600">
          <Youtube size={25} />
        </div>
      </header>

      {ok ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
          Vídeo publicado no app.
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
          {errorMessage}
        </div>
      ) : null}

      {canManage ? (
        <details className="rounded-[24px] border border-emerald-950/10 bg-white p-4 shadow-sm sm:p-5">
          <summary className="cursor-pointer list-none font-black text-slate-950">
            <span className="inline-flex items-center gap-2">
              <Plus size={19} className="text-[#176445]" /> Adicionar vídeo do YouTube
            </span>
          </summary>
          <form action={createElshadayYoutubeVideo} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
            <Field
              label="Título"
              name="titulo"
              placeholder="Ex.: Culto de Domingo - Santa Ceia"
              required
            />
            <Field label="Pregador / responsável" name="pregador" placeholder="Opcional" />
            <Field
              label="Data"
              name="data_pregacao"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
            <Field
              label="Link do YouTube"
              name="video_url"
              type="url"
              placeholder="https://youtu.be/..."
              required
            />
            <div className="sm:col-span-2">
              <button
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#123d2d] px-5 font-black text-white sm:w-auto"
                type="submit"
              >
                <Youtube size={19} /> Publicar vídeo
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {!videos.length ? (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center sm:p-10">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-red-50 text-red-600">
            <Video size={26} />
          </div>
          <h2 className="mt-4 text-xl font-black text-slate-950">Nenhum vídeo publicado ainda</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Quando um culto for publicado no YouTube, basta cadastrar o link aqui para ele aparecer dentro do app.
          </p>
        </section>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2">
          {videos.map((video: any, index: number) => (
            <article
              className={
                "min-w-0 overflow-hidden rounded-[26px] border border-emerald-950/10 bg-white shadow-sm " +
                (index === 0 ? "sm:col-span-2" : "")
              }
              key={video.id}
            >
              <div className="aspect-video w-full bg-slate-950">
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full border-0"
                  loading={index === 0 ? "eager" : "lazy"}
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={video.embedUrl}
                  title={video.titulo}
                />
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-lg font-black leading-snug text-slate-950 sm:text-xl">
                      {video.titulo}
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-slate-600">
                      {[video.pregador, dateBR(video.data_pregacao)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                    <Play size={18} fill="currentColor" />
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-black text-slate-800"
                    href={"/elshaday/pregacoes/" + video.id}
                  >
                    <CalendarDays size={16} /> Ver registro
                  </Link>
                  <a
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700"
                    href={video.video_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} /> YouTube
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <style>
        {".video-input{min-height:3rem;min-width:0;width:100%;border-radius:1rem;border:1px solid #cbd5e1;background:#fff!important;padding:0 1rem;outline:none;color:#0f172a!important;-webkit-text-fill-color:#0f172a!important;opacity:1;color-scheme:light}.video-input::placeholder{color:#64748b!important;-webkit-text-fill-color:#64748b!important;opacity:1}.video-input:focus{border-color:#047857;box-shadow:0 0 0 1px #047857}"}
      </style>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required = false
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-800">
      {label}
      <input
        className="video-input"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
