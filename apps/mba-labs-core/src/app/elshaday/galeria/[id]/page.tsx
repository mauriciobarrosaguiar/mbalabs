import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ImageIcon,
  Images,
  LockKeyhole,
  Star,
  Trash2
} from "lucide-react";
import { dateBR, requireElshadayContext } from "@/lib/elshaday";
import {
  canManageElshadayGallery,
  canViewElshadayGalleryVisibility,
  createElshadayGallerySignedUrl,
  galleryVisibilityLabel
} from "@/lib/elshaday-gallery";
import {
  deleteElshadayAlbum,
  deleteElshadayAlbumPhoto,
  setElshadayAlbumActive,
  setElshadayAlbumCover,
  updateElshadayAlbum,
  uploadElshadayAlbumPhotos
} from "../actions";
import { GalleryLightbox } from "./GalleryLightbox";

export const dynamic = "force-dynamic";

export default async function ElshadayAlbumPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/galeria/" + id);
  const canManage = canManageElshadayGallery(context.papel);

  const [{ data: album, error: albumError }, { data: rawPhotos, error: photosError }] = await Promise.all([
    context.admin
      .from("igreja_albuns")
      .select("id,titulo,descricao,data_album,visibilidade,permitir_compartilhamento,capa_storage_path,ativo,created_at,updated_at")
      .eq("id", id)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle(),
    context.admin
      .from("igreja_album_fotos")
      .select("id,storage_path,legenda,ordem,created_at")
      .eq("album_id", id)
      .eq("igreja_id", context.igreja.id)
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true })
  ]);

  if (albumError || !album) notFound();
  if (photosError) throw new Error("Falha ao carregar as fotos: " + photosError.message);
  if (!canViewElshadayGalleryVisibility(context.papel, album.visibilidade)) notFound();
  if (!album.ativo && !canManage) notFound();

  const photos = (
    await Promise.all(
      (rawPhotos ?? []).map(async (photo: any) => ({
        ...photo,
        url: await createElshadayGallerySignedUrl(context.admin, photo.storage_path)
      }))
    )
  ).filter((photo: any) => Boolean(photo.url));

  const ok = typeof query.ok === "string" ? query.ok : "";
  const error = typeof query.erro === "string" ? query.erro : "";

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-5">
      <Link className="inline-flex w-fit items-center gap-2 text-sm font-black text-[#176445]" href="/elshaday/galeria">
        <ArrowLeft size={18} /> Voltar para a galeria
      </Link>

      <section className="rounded-[28px] border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#176445]">
                {galleryVisibilityLabel(album.visibilidade)}
              </span>
              {!album.ativo ? (
                <span className="rounded-full bg-slate-200 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-slate-700">
                  Arquivado
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{album.titulo}</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              {album.data_album ? dateBR(album.data_album) : "Sem data definida"} · {photos.length} {photos.length === 1 ? "foto" : "fotos"}
            </p>
            {album.descricao ? (
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-700">{album.descricao}</p>
            ) : null}
          </div>
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-[#123d2d]">
            <Images size={24} />
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

      {photos.length ? (
        <section className="rounded-[26px] border border-emerald-950/10 bg-white p-3 shadow-sm sm:p-4">
          <GalleryLightbox
            allowShare={Boolean(album.permitir_compartilhamento)}
            photos={photos.map((photo: any) => ({ id: photo.id, url: photo.url, legenda: photo.legenda }))}
          />
        </section>
      ) : (
        <section className="rounded-[26px] border border-dashed border-emerald-950/15 bg-white p-8 text-center shadow-sm">
          <ImageIcon className="mx-auto text-[#176445]" size={38} />
          <h2 className="mt-3 text-lg font-black text-slate-950">Álbum sem fotos</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            {canManage ? "Adicione as primeiras fotos usando o painel abaixo." : "As fotos ainda não foram publicadas."}
          </p>
        </section>
      )}

      {canManage ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <details className="group rounded-[26px] border border-emerald-950/10 bg-white shadow-sm" open={!photos.length}>
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-[#123d2d]">
                  <Camera size={21} />
                </div>
                <div>
                  <p className="font-black text-slate-950">Adicionar fotos</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-600">Até 30 por envio</p>
                </div>
              </div>
            </summary>
            <form action={uploadElshadayAlbumPhotos} className="grid gap-4 border-t border-slate-100 p-5" encType="multipart/form-data">
              <input name="album_id" type="hidden" value={album.id} />
              <label className="grid gap-2 rounded-[20px] border border-dashed border-emerald-900/20 bg-emerald-50/60 p-4">
                <span className="text-sm font-black text-[#123d2d]">Escolher fotos</span>
                <input accept="image/jpeg,image/png,image/webp" multiple name="fotos" required type="file" />
                <span className="text-xs font-semibold leading-5 text-slate-600">JPG, PNG ou WebP. Até 8 MB cada.</span>
              </label>
              <button className="min-h-12 rounded-2xl bg-[#123d2d] px-5 font-black text-white" type="submit">
                Enviar fotos
              </button>
            </form>
          </details>

          <details className="group rounded-[26px] border border-emerald-950/10 bg-white shadow-sm">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-4">
              <div className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                <LockKeyhole size={21} />
              </div>
              <div>
                <p className="font-black text-slate-950">Configurar álbum</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-600">Nome, data, privacidade e compartilhamento</p>
              </div>
            </summary>
            <form action={updateElshadayAlbum} className="grid gap-4 border-t border-slate-100 p-5">
              <input name="album_id" type="hidden" value={album.id} />
              <label className="grid gap-1.5">
                <span className="text-sm font-black text-slate-800">Nome</span>
                <input className="min-h-12 rounded-2xl border border-slate-200 px-4" defaultValue={album.titulo} maxLength={120} name="titulo" required />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className="text-sm font-black text-slate-800">Data</span>
                  <input className="min-h-12 rounded-2xl border border-slate-200 px-4" defaultValue={album.data_album ?? ""} name="data_album" type="date" />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-sm font-black text-slate-800">Quem pode ver</span>
                  <select className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4" defaultValue={album.visibilidade} name="visibilidade">
                    <option value="membros">Todos os membros</option>
                    <option value="lideranca">Somente liderança</option>
                    {context.papel === "admin" ? <option value="administracao">Somente administração</option> : null}
                  </select>
                </label>
              </div>
              <label className="grid gap-1.5">
                <span className="text-sm font-black text-slate-800">Descrição</span>
                <textarea className="min-h-24 resize-y rounded-2xl border border-slate-200 px-4 py-3" defaultValue={album.descricao ?? ""} maxLength={1000} name="descricao" />
              </label>
              <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                <input className="mt-1 size-4" defaultChecked={Boolean(album.permitir_compartilhamento)} name="permitir_compartilhamento" type="checkbox" />
                <span>
                  <span className="block text-sm font-black text-slate-900">Permitir compartilhamento</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-600">Mostra o botão de compartilhar na foto ampliada.</span>
                </span>
              </label>
              <button className="min-h-12 rounded-2xl bg-[#123d2d] px-5 font-black text-white" type="submit">
                Salvar alterações
              </button>
            </form>
          </details>
        </section>
      ) : null}

      {canManage && photos.length ? (
        <details className="group rounded-[26px] border border-emerald-950/10 bg-white shadow-sm">
          <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-4">
            <Star className="text-[#176445]" size={21} />
            <div>
              <p className="font-black text-slate-950">Gerenciar fotos</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">Defina a capa ou exclua fotos específicas.</p>
            </div>
          </summary>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo: any) => {
              const isCover = album.capa_storage_path === photo.storage_path;
              return (
                <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-slate-50" key={photo.id}>
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <img alt="Foto do álbum" className="w-full object-cover" loading="lazy" src={photo.url} style={{ height: "100%" }} />
                    {isCover ? (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#123d2d] px-2.5 py-1 text-[10px] font-black text-white">
                        <CheckCircle2 size={12} /> Capa
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-2 p-2.5">
                    {!isCover ? (
                      <form action={setElshadayAlbumCover}>
                        <input name="album_id" type="hidden" value={album.id} />
                        <input name="foto_id" type="hidden" value={photo.id} />
                        <button className="min-h-9 w-full rounded-xl bg-emerald-50 px-2 text-xs font-black text-[#176445]" type="submit">
                          Definir capa
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteElshadayAlbumPhoto}>
                      <input name="album_id" type="hidden" value={album.id} />
                      <input name="foto_id" type="hidden" value={photo.id} />
                      <button className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-red-50 px-2 text-xs font-black text-red-700" type="submit">
                        <Trash2 size={14} /> Excluir
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}

      {canManage ? (
        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-black text-slate-950">Administração do álbum</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={setElshadayAlbumActive}>
              <input name="album_id" type="hidden" value={album.id} />
              <input name="ativo" type="hidden" value={album.ativo ? "false" : "true"} />
              <button className="min-h-11 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-800" type="submit">
                {album.ativo ? "Arquivar álbum" : "Reativar álbum"}
              </button>
            </form>
            <form action={deleteElshadayAlbum}>
              <input name="album_id" type="hidden" value={album.id} />
              <button className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-red-50 px-4 text-sm font-black text-red-700" type="submit">
                <Trash2 size={16} /> Excluir álbum definitivamente
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
