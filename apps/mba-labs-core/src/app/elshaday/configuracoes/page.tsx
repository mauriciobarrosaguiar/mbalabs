import {
  ImagePlus,
  Images,
  Link2,
  Settings2,
  Trash2
} from "lucide-react";
import {
  requireElshadayContext,
  requireElshadayRole
} from "@/lib/elshaday";
import {
  createElshadayCarouselItem,
  deleteElshadayCarouselItem,
  updateElshadayCarouselItem
} from "./actions";

export const dynamic = "force-dynamic";

const CONTENT_EDITOR_ROLES = ["admin", "pastor", "secretaria", "lider"] as const;

function read(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ElshadaySettingsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/configuracoes");
  requireElshadayRole(context, [...CONTENT_EDITOR_ROLES]);

  const { data, error } = await context.admin
    .from("igreja_carrossel")
    .select("id,titulo,subtitulo,imagem_url,link_url,ordem,ativo,created_at,updated_at")
    .eq("igreja_id", context.igreja.id)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Falha ao carregar o carrossel: " + error.message);
  }

  const items = data ?? [];
  const ok = read(query.ok);
  const erro = read(query.erro);

  return (
    <div className="mx-auto grid max-w-5xl gap-5">
      <header className="flex items-end justify-between gap-4 px-1">
        <div>
          <p className="text-sm font-semibold text-slate-500">Administração visual</p>
          <h1 className="mt-0.5 text-[30px] font-black tracking-tight text-slate-950 lg:text-3xl">
            Configurações
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            Controle as imagens que aparecem no carrossel da Home. Somente perfis autorizados podem alterar esta área.
          </p>
        </div>
        <div className="hidden size-12 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d] sm:grid">
          <Settings2 size={24} />
        </div>
      </header>

      {ok ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
          {ok}
        </div>
      ) : null}

      {erro ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {erro}
        </div>
      ) : null}

      <section className="rounded-[26px] border border-emerald-950/10 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-emerald-50 text-[#123d2d]">
            <Images size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950">Carrossel da Home</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {items.length} {items.length === 1 ? "imagem configurada" : "imagens configuradas"}
            </p>
          </div>
        </div>

        <details className="mt-4 rounded-[22px] border border-emerald-950/10 bg-[#f7f8f4] p-4">
          <summary className="cursor-pointer list-none font-black text-slate-950">
            <span className="inline-flex items-center gap-2">
              <ImagePlus size={19} className="text-[#176445]" />
              Adicionar imagem ao carrossel
            </span>
          </summary>

          <form action={createElshadayCarouselItem} className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="grid min-w-0 gap-2 sm:col-span-2">
              <span className="text-sm font-black text-slate-800">Imagem *</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm"
                name="imagem"
                required
                type="file"
              />
              <span className="text-xs font-semibold text-slate-500">
                JPG, PNG ou WebP, até 5 MB. Para a Home, prefira imagem horizontal 16:9.
              </span>
            </label>

            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-black text-slate-800">Título</span>
              <input
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                maxLength={100}
                name="titulo"
                placeholder="Ex.: Congresso de Jovens"
              />
            </label>

            <label className="grid min-w-0 gap-2">
              <span className="text-sm font-black text-slate-800">Subtítulo</span>
              <input
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                maxLength={140}
                name="subtitulo"
                placeholder="Ex.: 12 e 13 de setembro"
              />
            </label>

            <label className="grid min-w-0 gap-2 sm:col-span-2">
              <span className="inline-flex items-center gap-2 text-sm font-black text-slate-800">
                <Link2 size={16} />
                Link ao tocar na imagem
              </span>
              <input
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                name="link_url"
                placeholder="/elshaday/eventos ou https://..."
              />
              <span className="text-xs font-semibold text-slate-500">
                Opcional. Sem link, a imagem permanece apenas como destaque visual.
              </span>
            </label>

            <button
              className="min-h-12 rounded-2xl bg-[#123d2d] px-5 py-3 font-black text-white sm:col-span-2"
              type="submit"
            >
              Adicionar ao carrossel
            </button>
          </form>
        </details>
      </section>

      <section className="grid gap-4">
        {!items.length ? (
          <div className="rounded-[26px] border border-dashed border-emerald-950/15 bg-white p-7 text-center shadow-sm">
            <Images className="mx-auto text-[#176445]" size={34} />
            <h2 className="mt-3 text-xl font-black text-slate-950">Carrossel ainda vazio</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Adicione a primeira imagem acima. Enquanto não houver imagem configurada, a Home continua usando os banners de cultos e pregações como alternativa.
            </p>
          </div>
        ) : (
          items.map((item: any, index: number) => (
            <article
              className="overflow-hidden rounded-[26px] border border-emerald-950/10 bg-white shadow-sm"
              key={item.id}
            >
              <div className="relative aspect-[16/9] w-full bg-slate-100">
                <img
                  alt={item.titulo || "Imagem do carrossel"}
                  className="absolute inset-0 h-full w-full object-cover"
                  src={item.imagem_url}
                />
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="rounded-full bg-slate-950/75 px-3 py-1.5 text-xs font-black text-white backdrop-blur">
                    #{index + 1}
                  </span>
                  <span
                    className={
                      "rounded-full px-3 py-1.5 text-xs font-black backdrop-blur " +
                      (item.ativo
                        ? "bg-emerald-600/90 text-white"
                        : "bg-white/90 text-slate-700")
                    }
                  >
                    {item.ativo ? "Ativo" : "Oculto"}
                  </span>
                </div>

                {item.titulo || item.subtitulo ? (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent p-4 pt-12 text-white">
                    {item.subtitulo ? (
                      <p className="text-[11px] font-black uppercase tracking-[.13em] text-white/75">
                        {item.subtitulo}
                      </p>
                    ) : null}
                    {item.titulo ? (
                      <h3 className="mt-1 text-xl font-black leading-tight">{item.titulo}</h3>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="p-4 sm:p-5">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-950">
                    {item.titulo || "Destaque sem título"}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                    Ordem {item.ordem}
                    {item.link_url ? " · " + item.link_url : " · sem link"}
                  </p>
                </div>

                <details className="mt-4 rounded-[20px] border border-slate-200 bg-[#f7f8f4] p-4">
                  <summary className="cursor-pointer list-none font-black text-slate-900">
                    Editar destaque
                  </summary>

                  <form action={updateElshadayCarouselItem} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                    <input name="id" type="hidden" value={item.id} />

                    <label className="grid min-w-0 gap-2 sm:col-span-2">
                      <span className="text-sm font-black text-slate-800">Trocar imagem</span>
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-3 text-sm"
                        name="imagem"
                        type="file"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-black text-slate-800">Título</span>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        defaultValue={item.titulo ?? ""}
                        maxLength={100}
                        name="titulo"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-black text-slate-800">Subtítulo</span>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        defaultValue={item.subtitulo ?? ""}
                        maxLength={140}
                        name="subtitulo"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2 sm:col-span-2">
                      <span className="text-sm font-black text-slate-800">Link</span>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        defaultValue={item.link_url ?? ""}
                        name="link_url"
                      />
                    </label>

                    <label className="grid min-w-0 gap-2">
                      <span className="text-sm font-black text-slate-800">Ordem</span>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3"
                        defaultValue={item.ordem}
                        max={9999}
                        min={0}
                        name="ordem"
                        type="number"
                      />
                    </label>

                    <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4">
                      <input
                        className="size-5"
                        defaultChecked={Boolean(item.ativo)}
                        name="ativo"
                        type="checkbox"
                      />
                      <span className="font-black text-slate-800">Exibir na Home</span>
                    </label>

                    <button
                      className="min-h-12 rounded-2xl bg-[#123d2d] px-5 py-3 font-black text-white sm:col-span-2"
                      type="submit"
                    >
                      Salvar alterações
                    </button>
                  </form>

                  <form action={deleteElshadayCarouselItem} className="mt-3">
                    <input name="id" type="hidden" value={item.id} />
                    <button
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 font-black text-red-700"
                      type="submit"
                    >
                      <Trash2 size={18} />
                      Excluir imagem do carrossel
                    </button>
                  </form>
                </details>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
