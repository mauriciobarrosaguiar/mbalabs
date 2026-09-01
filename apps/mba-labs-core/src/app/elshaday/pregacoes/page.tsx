import Link from "next/link";
import { Archive, BookMarked, ChevronRight, Mic2, Play, Plus, Search } from "lucide-react";
import { createElshadaySermon } from "../actions";
import {
  dateBR,
  hasElshadayRole,
  requireElshadayContext
} from "@/lib/elshaday";
import { ElshadayMediaCarousel } from "../ElshadayMediaCarousel";

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
    .select("id,titulo,tema,pregador,data_pregacao,texto_base,versiculos,esboco,status,banner_url")
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
  const mediaItems = rows
    .filter((sermon: any) => Boolean(sermon.banner_url))
    .slice(0, 8)
    .map((sermon: any) => ({
      id: String(sermon.id),
      href: "/elshaday/pregacoes/" + sermon.id,
      title: sermon.titulo,
      subtitle: sermon.pregador,
      imageUrl: sermon.banner_url
    }));

  return (
    <div className="mx-auto grid max-w-7xl gap-6">
      <header className="hidden flex-col justify-between gap-4 sm:flex-row sm:items-end lg:flex">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#176445]">Acervo espiritual</p>
          <h1 className="mt-1 text-3xl font-black">Temas e pregações</h1>
          <p className="mt-2 text-slate-600">{rows.length} mensagens encontradas.</p>
        </div>
        <div className="grid size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <Mic2 size={25} />
        </div>
      </header>

      <section className="grid gap-4 lg:hidden">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-semibold text-slate-500">Conteúdo</p>
            <h1 className="mt-0.5 text-[30px] font-black tracking-tight text-slate-950">Palavras</h1>
          </div>
          <Search className="text-slate-700" size={24} />
        </div>

        {mediaItems.length ? (
          <ElshadayMediaCarousel items={mediaItems} />
        ) : rows[0] ? (
                    <Link
                      className="overflow-hidden rounded-[28px] bg-[#322019] text-white shadow-[0_16px_38px_rgba(50,32,25,.18)]"
                      href={"/elshaday/pregacoes/" + rows[0].id}
                    >
                      <div className="relative min-h-[245px] p-5">
                        <div className="absolute -right-10 -top-8 size-44 rounded-full bg-[#d4aa54]/25 blur-2xl" />
                        <div className="relative flex min-h-[205px] flex-col">
                          <div className="flex items-center justify-between">
                            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[.14em] text-[#f4d992]">
                              Em destaque
                            </span>
                            <span className="grid size-11 place-items-center rounded-full bg-white/12">
                              <Play size={18} fill="currentColor" />
                            </span>
                          </div>
                          <div className="mt-auto">
                            <p className="text-xs font-black uppercase tracking-[.14em] text-[#f4d992]">
                              {rows[0].tema || "Palavra"}
                            </p>
                            <h2 className="mt-2 text-[28px] font-black leading-[1.08] tracking-tight">{rows[0].titulo}</h2>
                            <p className="mt-3 text-sm font-semibold text-white/70">{rows[0].pregador}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ) : null}

        <details className="rounded-[22px] border border-slate-200 bg-white shadow-sm">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-black text-slate-900">
            <span className="inline-flex items-center gap-2">
              <Search size={18} className="text-[#176445]" />
              Buscar mensagens
            </span>
            <ChevronRight size={18} className="text-slate-400" />
          </summary>
          <form className="grid gap-3 border-t border-slate-100 p-4" method="get">
            <input className="input" name="q" defaultValue={q} placeholder="Título, tema, pregador..." />
            <select className="input" name="status" defaultValue={status}>
              <option value="ativo">Ativas</option>
              <option value="arquivado">Arquivadas</option>
            </select>
            <button className="min-h-12 rounded-2xl bg-slate-900 px-5 font-black text-white" type="submit">
              Buscar
            </button>
          </form>
        </details>

        <div>
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-xl font-black text-slate-950">Mais recentes</h2>
            <span className="text-xs font-bold text-slate-500">{rows.length} mensagens</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {rows.slice(1).map((sermon: any) => (
              <Link
                className="min-w-0 rounded-[22px] border border-emerald-950/10 bg-white p-4 shadow-sm"
                href={"/elshaday/pregacoes/" + sermon.id}
                key={sermon.id}
              >
                {sermon.banner_url ? (
                  <img
                    alt=""
                    className="aspect-[16/9] w-full rounded-[14px] object-cover"
                    src={sermon.banner_url}
                  />
                ) : (
                  <div className="grid size-10 place-items-center rounded-[13px] bg-emerald-50 text-[#123d2d]">
                    <Mic2 size={19} />
                  </div>
                )}
                <p className="mt-4 line-clamp-3 font-black leading-snug text-slate-950">{sermon.titulo}</p>
                <p className="mt-2 truncate text-xs font-semibold text-slate-500">{sermon.pregador}</p>
                {sermon.texto_base ? (
                  <p className="mt-2 truncate text-[11px] font-bold text-[#176445]">{sermon.texto_base}</p>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <form className="hidden gap-3 rounded-[24px] border border-emerald-950/10 bg-white p-4 md:grid-cols-[1fr_180px_auto] lg:grid" method="get">
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
        >
          <summary className="cursor-pointer list-none font-black">
            <span className="inline-flex items-center gap-2">
              <Plus size={19} className="text-[#176445]" /> Registrar pregação
            </span>
          </summary>
          <form action={createElshadaySermon} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="grid min-w-0 gap-2 text-sm font-bold text-slate-800 sm:col-span-2 lg:col-span-3">
              Imagem de capa / banner
              <input
                className="w-full min-w-0 rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
                name="imagem"
                type="file"
                accept="image/jpeg,image/png,image/webp"
              />
              <span className="text-xs font-medium leading-5 text-slate-500">
                Opcional. JPG, PNG ou WebP de até 5 MB. Essa imagem poderá aparecer nos carrosséis do app.
              </span>
            </label>
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
        <section className="hidden gap-4 md:grid-cols-2 lg:grid xl:grid-cols-3">
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
        {".input{min-height:3rem;min-width:0;width:100%;border-radius:1rem;border:1px solid #cbd5e1;background:#fff!important;padding:0 1rem;outline:none;color:#0f172a!important;-webkit-text-fill-color:#0f172a!important;opacity:1;color-scheme:light}.input::placeholder{color:#64748b!important;-webkit-text-fill-color:#64748b!important;opacity:1}.input:focus{border-color:#047857;box-shadow:0 0 0 1px #047857}.input option{background:#fff;color:#0f172a}"}
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
      <textarea className="textarea-mobile min-h-28 min-w-0 rounded-2xl border border-slate-300 p-4 outline-none placeholder:text-slate-500 focus:border-emerald-700" name={name} />
    </label>
  );
}

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}
