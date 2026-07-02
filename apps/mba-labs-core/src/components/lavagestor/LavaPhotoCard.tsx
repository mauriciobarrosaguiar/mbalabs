"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo, useState, type ReactNode } from "react";
import { formatDate } from "@/components/ui-kit";

type Row = Record<string, unknown>;
type GalleryItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  alt: string;
  syncRows: Row[];
};

export function LavaPhotoCard({
  foto,
  title,
  subtitle,
  returnTo,
  children,
  compact = false,
  className = "",
  gallery,
  galleryIndex = 0
}: {
  foto: Row;
  title?: string;
  subtitle?: string;
  returnTo: string;
  children?: ReactNode;
  compact?: boolean;
  className?: string;
  gallery?: Row[];
  galleryIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const syncRows = Array.isArray(foto.sync_rows) ? foto.sync_rows as Row[] : [];
  const imageUrl = photoUrl(foto);
  const galleryItems = useMemo(() => {
    const items = gallery?.length ? gallery : [foto];
    return items.map((item, index) => toGalleryItem(item, index === galleryIndex ? title : undefined, index === galleryIndex ? subtitle : undefined));
  }, [foto, gallery, galleryIndex, subtitle, title]);
  const initialIndex = Math.min(Math.max(galleryIndex, 0), Math.max(galleryItems.length - 1, 0));
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const active = galleryItems[activeIndex] ?? galleryItems[0];

  function openCarousel() {
    setActiveIndex(initialIndex);
    setOpen(true);
  }

  function previousPhoto() {
    setActiveIndex((current) => (current - 1 + galleryItems.length) % galleryItems.length);
  }

  function nextPhoto() {
    setActiveIndex((current) => (current + 1) % galleryItems.length);
  }

  return (
    <figure className={`min-w-0 overflow-hidden rounded-xl border border-border bg-white shadow-sm ${className}`}>
      {imageUrl ? (
        <button className="block w-full cursor-zoom-in bg-black text-left" type="button" onClick={openCarousel}>
          <img alt={String(foto.legenda || foto.tipo || "Foto do checklist")} className="aspect-[4/3] w-full object-cover transition hover:opacity-90" src={imageUrl} />
        </button>
      ) : (
        <button className="grid aspect-[4/3] w-full place-items-center bg-muted p-3 text-center text-sm font-bold text-muted-foreground" type="button" onClick={openCarousel}>
          Foto salva, mas a prévia não carregou.
        </button>
      )}
      <figcaption className={`grid gap-2 ${compact ? "p-2" : "p-3"}`}>
        <div>
          <strong className="text-sm">{title || String(foto.legenda || foto.tipo || "Foto")}</strong>
          {subtitle ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{subtitle}</p> : null}
          {foto.preview_error ? <p className="mt-1 text-xs font-bold text-amber-800">Foto salva, mas a URL assinada falhou: {String(foto.preview_error)}</p> : null}
          <button className="mt-2 inline-flex text-xs font-black text-emerald-800 underline" type="button" onClick={openCarousel}>Abrir no app</button>
        </div>
        <BackupStatusList rows={syncRows} returnTo={returnTo} fotoId={String(foto.id ?? "")} compact={compact} />
        {children}
      </figcaption>
      {open ? (
        <div className="fixed inset-0 z-50 grid bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Visualizar fotos">
          <div className="grid max-h-full min-h-0 w-full max-w-5xl self-center justify-self-center overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <div className="min-w-0">
                <strong className="block truncate text-sm">{active?.title || "Foto"}</strong>
                <span className="text-xs font-bold text-muted-foreground">{activeIndex + 1} de {galleryItems.length}</span>
              </div>
              <button className="rounded-lg border border-border px-3 py-2 text-sm font-black" type="button" onClick={() => setOpen(false)}>Fechar</button>
            </div>
            <div className="grid min-h-0 gap-3 p-3 lg:grid-cols-[1fr_320px]">
              <div className="relative grid min-h-[48vh] place-items-center overflow-hidden rounded-lg bg-black">
                {active?.imageUrl ? (
                  <img alt={active.alt} className="max-h-[72vh] w-full object-contain" src={active.imageUrl} />
                ) : (
                  <div className="p-6 text-center text-sm font-bold text-white">Foto salva, mas a prévia não carregou.</div>
                )}
                {galleryItems.length > 1 ? (
                  <>
                    <button className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-xl font-black text-slate-950 shadow" type="button" onClick={previousPhoto} aria-label="Foto anterior">‹</button>
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-xl font-black text-slate-950 shadow" type="button" onClick={nextPhoto} aria-label="Próxima foto">›</button>
                  </>
                ) : null}
              </div>
              <aside className="grid min-h-0 content-start gap-3 overflow-auto rounded-lg border border-border bg-muted/40 p-3">
                <div>
                  <h3 className="break-words text-lg font-black">{active?.title || "Foto"}</h3>
                  {active?.subtitle ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{active.subtitle}</p> : null}
                </div>
                {active ? <BackupStatusList rows={active.syncRows} returnTo={returnTo} fotoId={active.id} /> : null}
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </figure>
  );
}

export function BackupStatusList({
  rows,
  returnTo,
  fotoId,
  compact = false
}: {
  rows: Row[];
  returnTo: string;
  fotoId: string;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg bg-muted px-2 py-1.5 text-xs font-bold text-muted-foreground">Foto salva no LavaGestor. Backup externo sem provedor conectado.</p>;
  }

  return (
    <div className="grid gap-1.5">
      {rows.map((row) => {
        const provider = String(row.provider ?? "");
        const status = String(row.status ?? "pendente");
        const error = String(row.erro ?? "").trim();
        const lastAttempt = row.last_attempt_at || row.updated_at || row.synced_at;
        return (
          <div className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${statusTone(status)}`} key={`${fotoId}-${provider}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black">{providerLabel(provider)}: {statusLabel(status)}</span>
              {lastAttempt ? <span className="text-[11px]">{status === "sincronizado" ? "sincronizado" : "tentativa"} {formatDate(lastAttempt)}</span> : null}
            </div>
            {error ? <p className={`mt-1 break-words ${compact ? "max-h-16 overflow-auto" : ""}`}>{providerLabel(provider)}: erro - {error}</p> : null}
            {status === "erro" ? (
              <form action="/api/lavagestor/storage/sync" className={compact ? "mt-1" : "mt-2"} method="post">
                <input name="foto_id" type="hidden" value={fotoId} />
                <input name="provider" type="hidden" value={provider} />
                <input name="return_to" type="hidden" value={returnTo} />
                <button className="rounded-md border border-current px-2 py-1 text-[11px] font-black" type="submit">Tentar novamente</button>
              </form>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function LavaSyncPendingButton({ returnTo, lavagemId, compact = false }: { returnTo: string; lavagemId?: string; compact?: boolean }) {
  return (
    <form action="/api/lavagestor/storage/sync" method="post">
      {lavagemId ? <input name="lavagem_id" type="hidden" value={lavagemId} /> : null}
      <input name="return_to" type="hidden" value={returnTo} />
      <button className={compact ? "button-secondary min-h-10 px-3 text-xs" : "button-secondary"} type="submit">Sincronizar pendentes</button>
    </form>
  );
}

export function providerLabel(provider: string) {
  if (provider === "google_drive") return "Google Drive";
  if (provider === "dropbox") return "Dropbox";
  return provider || "Backup";
}

function statusLabel(status: string) {
  if (status === "sincronizado") return "sincronizado";
  if (status === "erro") return "erro";
  return "pendente";
}

function statusTone(status: string) {
  if (status === "sincronizado") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (status === "erro") return "border-red-200 bg-red-50 text-red-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function photoUrl(foto: Row) {
  return String(foto.signed_url || foto.preview_url || "");
}

function toGalleryItem(foto: Row, title?: string, subtitle?: string): GalleryItem {
  const imageUrl = photoUrl(foto);
  const syncRows = Array.isArray(foto.sync_rows) ? foto.sync_rows as Row[] : [];
  return {
    id: String(foto.id ?? ""),
    title: title || String(foto.legenda || foto.tipo || "Foto"),
    subtitle,
    imageUrl,
    alt: String(foto.legenda || foto.tipo || "Foto do checklist"),
    syncRows
  };
}
