/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { formatDate } from "@/components/ui-kit";

type Row = Record<string, unknown>;

export function LavaPhotoCard({
  foto,
  title,
  subtitle,
  returnTo,
  children,
  compact = false
}: {
  foto: Row;
  title?: string;
  subtitle?: string;
  returnTo: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const imageUrl = String(foto.signed_url || foto.preview_url || "");
  const openUrl = String(foto.preview_url || foto.signed_url || "");
  const syncRows = Array.isArray(foto.sync_rows) ? foto.sync_rows as Row[] : [];

  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      {imageUrl ? (
        <img alt={String(foto.legenda || foto.tipo || "Foto do checklist")} className="aspect-[4/3] w-full object-cover" src={imageUrl} />
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-muted p-3 text-center text-sm font-bold text-muted-foreground">
          Foto salva, mas a previa nao carregou.
        </div>
      )}
      <figcaption className={`grid gap-2 ${compact ? "p-2" : "p-3"}`}>
        <div>
          <strong className="text-sm">{title || String(foto.legenda || foto.tipo || "Foto")}</strong>
          {subtitle ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{subtitle}</p> : null}
          {foto.preview_error ? <p className="mt-1 text-xs font-bold text-amber-800">Foto salva, mas a URL assinada falhou: {String(foto.preview_error)}</p> : null}
          {openUrl ? <a className="mt-2 inline-flex text-xs font-black text-emerald-800 underline" href={openUrl} target="_blank" rel="noreferrer">Abrir foto</a> : null}
        </div>
        <BackupStatusList rows={syncRows} returnTo={returnTo} fotoId={String(foto.id ?? "")} compact={compact} />
        {children}
      </figcaption>
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
            {error ? <p className="mt-1 break-words">{providerLabel(provider)}: erro - {error}</p> : null}
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
