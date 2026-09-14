"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Share2, X } from "lucide-react";

export type GalleryPhotoItem = {
  id: string;
  url: string;
  legenda?: string | null;
};

export function GalleryLightbox({
  photos,
  allowShare
}: {
  photos: GalleryPhotoItem[];
  allowShare: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex === null ? null : photos[activeIndex] ?? null;

  useEffect(() => {
    if (activeIndex === null) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => current === null ? null : (current - 1 + photos.length) % photos.length);
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => current === null ? null : (current + 1) % photos.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, photos.length]);

  async function sharePhoto() {
    if (!active || !allowShare) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Foto da Elshaday", url: active.url });
        return;
      }
      await navigator.clipboard.writeText(active.url);
      window.alert("Link temporário da foto copiado.");
    } catch {
      // O usuário pode cancelar o compartilhamento sem gerar erro visual.
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <button
            aria-label={"Abrir foto " + (index + 1)}
            className="relative aspect-square overflow-hidden rounded-[18px] bg-slate-100 text-left shadow-sm ring-1 ring-emerald-950/5"
            key={photo.id}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            <img
              alt={photo.legenda || "Foto do álbum"}
              className="w-full object-cover"
              loading="lazy"
              src={photo.url}
              style={{ height: "100%" }}
            />
          </button>
        ))}
      </div>

      {active ? (
        <div className="fixed inset-0 z-[12000] flex h-[100dvh] w-screen flex-col bg-black/95 text-white">
          <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] sm:px-5">
            <p className="text-sm font-black text-white/85">
              {(activeIndex ?? 0) + 1} de {photos.length}
            </p>
            <div className="flex items-center gap-2">
              {allowShare ? (
                <button
                  aria-label="Compartilhar foto"
                  className="grid size-11 place-items-center rounded-full bg-white/10"
                  onClick={sharePhoto}
                  type="button"
                >
                  <Share2 size={20} />
                </button>
              ) : null}
              <button
                aria-label="Fechar foto"
                className="grid size-11 place-items-center rounded-full bg-white/10"
                onClick={() => setActiveIndex(null)}
                type="button"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-1 sm:px-16">
            {photos.length > 1 ? (
              <button
                aria-label="Foto anterior"
                className="absolute left-2 z-10 grid size-11 place-items-center rounded-full bg-black/45 ring-1 ring-white/15 sm:left-5"
                onClick={() => setActiveIndex((current) => current === null ? null : (current - 1 + photos.length) % photos.length)}
                type="button"
              >
                <ChevronLeft size={24} />
              </button>
            ) : null}

            <img
              alt={active.legenda || "Foto do álbum"}
              className="max-h-full max-w-full object-contain"
              src={active.url}
            />

            {photos.length > 1 ? (
              <button
                aria-label="Próxima foto"
                className="absolute right-2 z-10 grid size-11 place-items-center rounded-full bg-black/45 ring-1 ring-white/15 sm:right-5"
                onClick={() => setActiveIndex((current) => current === null ? null : (current + 1) % photos.length)}
                type="button"
              >
                <ChevronRight size={24} />
              </button>
            ) : null}
          </div>

          {active.legenda ? (
            <p className="shrink-0 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-center text-sm font-semibold text-white/85">
              {active.legenda}
            </p>
          ) : (
            <div className="h-[max(.75rem,env(safe-area-inset-bottom))] shrink-0" />
          )}
        </div>
      ) : null}
    </>
  );
}
