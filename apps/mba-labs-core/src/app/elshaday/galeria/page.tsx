import Link from "next/link";
import { Camera, ChevronRight, Images, LockKeyhole, Plus } from "lucide-react";
import { dateBR, requireElshadayContext } from "@/lib/elshaday";
import {
  canManageElshadayGallery,
  canViewElshadayGalleryVisibility,
  createElshadayGallerySignedUrl,
  galleryVisibilityLabel
} from "@/lib/elshaday-gallery";
import { createElshadayAlbum } from "./actions";

export const dynamic = "force-dynamic";

export default async function ElshadayGalleryPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/galeria");
  const canManage = canManageElshadayGallery(context.papel);

  let albumsQuery = context.admin
    .from("igreja_albuns")
    .select("id,titulo,descricao,data_album,visibilidade,permitir_compartilhamento,capa_storage_path,ativo,created_at,updated_at")
    .eq("igreja_id", context.igreja.id)
    .order("data_album", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!canManage) albumsQuery = albumsQuery.eq("ativo", true);

  const { data: rawAlbums, error: albumsError } = await albumsQuery.limit(80);
  if (albumsError) throw new Error("Falha ao carregar a galeria: " + albumsError.message);

  const albums = (rawAlbums ?? []).filter((album: any) =>
    canViewElshadayGalleryVisibility(context.papel, album.visibilidade)
  );
  const albumIds = albums.map((album: any) => album.id);

  const photosResult = albumIds.length
    ? await context.admin
        .from("igreja_album_fotos")
        .select("id,album_id,storage_path,ordem,created_at")
        .eq("igreja_id", context.igreja.id)
        .in("album_id", albumIds)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  if (photosResult.error) throw new Error("Falha ao carregar as fotos: " + photosResult.error.message);

  const photosByAlbum = new Map<string, any[]>();
  for (const photo of photosResult.data ?? []) {
    const key = String(photo.album_id);
    const rows = photosByAlbum.get(key) ?? [];
    rows.push(photo);
    photosByAlbum.set(key, rows);
  }

  const cards = await Promise.all(
    albums.map(async (album: any) => {
      const albumPhotos = photosByAlbum.get(String(album.id)) ?? [];
      const coverPath = album.capa_storage_path || albumPhotos[0]?.storage_path || null;
      return {
        ...album,
        photoCount: albumPhotos.length,
        coverUrl: await createElshadayGallerySignedUrl(context.admin, coverPath)
      };
    })
  );

  const ok = typeof query.ok === "string" ? query.ok : "";
  const error = typeof query.erro === "string" ? query.erro : "";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <section className="overflow-hidden rounded-[30px] bg-[#123d2d] p-5 text-white shadow-[0_16px_40px_rgba(18,61,45,.16)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#f3d58e]">Momentos da igreja</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Galeria</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-emerald-50/80">
              Cultos, eventos, batismos, congressos e outros momentos da comunidade em álbuns privados.
            </p>
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#f3d58e]">
            <Images size={25} />
          </div>
        </div>
      </section>

      {ok ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          {ok}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {canManage ? (
        <details className="group rounded-[26px] border border-emerald-950/10 bg-white shadow-sm">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-[#123d2d]">
                <Plus size={22} />
              </div>
              <div className="min-w-0">
                <p className="font-black text-slate-950">Criar novo álbum</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-600">Você pode enviar até 30 fotos por vez.</p>
              </div>
            </div>
            <ChevronRight className="shrink-0 text-slate-500 transition group-open:rotate-90" size={20} />
          </summary>

          <form action={createElshadayAlbum} className="grid gap-4 border-t border-slate-100 p-5" encType="multipart/form-data">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-sm font-black text-slate-800">Nome do álbum</span>
                <input
                  className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-emerald-600"
                  maxLength={120}
                  name="titulo"
                  placeholder="Ex.: Santa Ceia — Setembro 2026"
                  required
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-black text-slate-800">Data</span>
                <input className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4" name="data_album" type="date" />
              </label>

              <label className="grid gap-1.5">
                <span className="text-sm font-black text-slate-800">Quem pode ver</span>
                <select className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4" defaultValue="membros" name="visibilidade">
                  <option value="membros">Todos os membros</option>
                  <option value="lideranca">Somente liderança</option>
                  {context.papel === "admin" ? <option value="administracao">Somente administração</option> : null}
                </select>
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="text-sm font-black text-slate-800">Descrição</span>
              <textarea
                className="min-h-24 resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3"
                maxLength={1000}
                name="descricao"
                placeholder="Uma breve descrição deste momento."
              />
            </label>

            <label className="grid gap-2 rounded-[20px] border border-dashed border-emerald-900/20 bg-emerald-50/60 p-4">
              <span className="flex items-center gap-2 text-sm font-black text-[#123d2d]">
                <Camera size={18} /> Fotos
              </span>
              <input accept="image/jpeg,image/png,image/webp" multiple name="fotos" type="file" />
              <span className="text-xs font-semibold leading-5 text-slate-600">JPG, PNG ou WebP. Até 8 MB por foto.</span>
            </label>

            <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
              <input className="mt-1 size-4" name="permitir_compartilhamento" type="checkbox" />
              <span>
                <span className="block text-sm font-black text-slate-900">Permitir compartilhamento</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">Exibe opção de compartilhar as fotos para quem visualizar o álbum.</span>
              </span>
            </label>

            <button className="min-h-12 rounded-2xl bg-[#123d2d] px-5 font-black text-white shadow-sm" type="submit">
              Criar álbum
            </button>
          </form>
        </details>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-950">Álbuns</h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-600">{cards.length} {cards.length === 1 ? "álbum disponível" : "álbuns disponíveis"}</p>
          </div>
          <LockKeyhole className="text-[#176445]" size={20} />
        </div>

        {!cards.length ? (
          <div className="rounded-[26px] border border-dashed border-emerald-950/15 bg-white p-8 text-center shadow-sm">
            <Images className="mx-auto text-[#176445]" size={36} />
            <h3 className="mt-3 text-lg font-black text-slate-950">Nenhum álbum ainda</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Quando a liderança publicar fotos, os álbuns aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((album: any) => (
              <Link
                className="group min-w-0 overflow-hidden rounded-[22px] border border-emerald-950/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                href={"/elshaday/galeria/" + album.id}
                key={album.id}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-emerald-50">
                  {album.coverUrl ? (
                    <img
                      alt={album.titulo}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                      src={album.coverUrl}
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[#176445]">
                      <Images size={34} />
                    </div>
                  )}
                  {!album.ativo ? (
                    <span className="absolute left-2 top-2 rounded-full bg-slate-950/75 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                      Arquivado
                    </span>
                  ) : null}
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur-sm">
                    {album.photoCount} {album.photoCount === 1 ? "foto" : "fotos"}
                  </span>
                </div>
                <div className="p-3.5">
                  <h3 className="line-clamp-2 text-sm font-black leading-snug text-slate-950 sm:text-base">{album.titulo}</h3>
                  <p className="mt-2 text-[11px] font-semibold text-slate-600">
                    {album.data_album ? dateBR(album.data_album) : "Sem data definida"}
                  </p>
                  {canManage ? (
                    <p className="mt-1 truncate text-[10px] font-black uppercase tracking-wide text-[#176445]">
                      {galleryVisibilityLabel(album.visibilidade)}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
