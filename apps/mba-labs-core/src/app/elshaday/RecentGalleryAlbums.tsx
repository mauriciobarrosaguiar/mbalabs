import Link from "next/link";
import { ChevronRight, Images } from "lucide-react";
import { dateBR, requireElshadayContext } from "@/lib/elshaday";
import {
  canViewElshadayGalleryVisibility,
  createElshadayGallerySignedUrl
} from "@/lib/elshaday-gallery";

export async function RecentGalleryAlbums() {
  const context = await requireElshadayContext("/elshaday/gestao");

  const { data: rawAlbums, error } = await context.admin
    .from("igreja_albuns")
    .select("id,titulo,data_album,visibilidade,capa_storage_path,created_at")
    .eq("igreja_id", context.igreja.id)
    .eq("ativo", true)
    .order("data_album", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) return null;

  const visible = (rawAlbums ?? [])
    .filter((album: any) => canViewElshadayGalleryVisibility(context.papel, album.visibilidade))
    .slice(0, 3);

  if (!visible.length) return null;

  const albums = await Promise.all(
    visible.map(async (album: any) => {
      let coverPath = album.capa_storage_path as string | null;

      if (!coverPath) {
        const { data: firstPhoto } = await context.admin
          .from("igreja_album_fotos")
          .select("storage_path")
          .eq("igreja_id", context.igreja.id)
          .eq("album_id", album.id)
          .order("ordem", { ascending: true })
          .limit(1)
          .maybeSingle();
        coverPath = firstPhoto?.storage_path ?? null;
      }

      return {
        ...album,
        coverUrl: await createElshadayGallerySignedUrl(context.admin, coverPath)
      };
    })
  );

  return (
    <section className="mx-auto mt-5 w-full max-w-6xl rounded-[26px] border border-emerald-950/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">Galeria</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Momentos recentes</h2>
        </div>
        <Link className="inline-flex items-center gap-1 text-sm font-black text-[#176445]" href="/elshaday/galeria">
          Ver todos <ChevronRight size={17} />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-4">
        {albums.map((album: any) => (
          <Link className="min-w-0 overflow-hidden rounded-[18px] bg-[#f7f8f4]" href={"/elshaday/galeria/" + album.id} key={album.id}>
            <div className="aspect-square overflow-hidden bg-emerald-50">
              {album.coverUrl ? (
                <img
                  alt={album.titulo}
                  className="w-full object-cover"
                  loading="lazy"
                  src={album.coverUrl}
                  style={{ height: "100%" }}
                />
              ) : (
                <div className="grid h-full place-items-center text-[#176445]">
                  <Images size={28} />
                </div>
              )}
            </div>
            <div className="p-2.5 sm:p-3">
              <p className="line-clamp-2 text-xs font-black leading-snug text-slate-950 sm:text-sm">{album.titulo}</p>
              <p className="mt-1 truncate text-[10px] font-semibold text-slate-600 sm:text-xs">
                {album.data_album ? dateBR(album.data_album) : "Momento da igreja"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
