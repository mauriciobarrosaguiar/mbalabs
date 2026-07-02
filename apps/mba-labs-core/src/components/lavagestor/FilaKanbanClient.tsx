"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatDateTime, formatMoney } from "@/components/ui-kit";
import { registrarPagamentoLavagem, updateLavagemStatus } from "@/lib/actions/lavagestor-actions";
import { moveLavagemKanban } from "@/lib/actions/lavagestor-kanban-actions";

type FilaRow = Record<string, unknown>;
type LavaConfig = Record<string, unknown>;

type Group = {
  title: string;
  subtitle: string;
  statuses: string[];
  targetStatus: string;
  tone: string;
  dropTone: string;
};

const groups: Group[] = [
  { title: "Na fila", subtitle: "Próximos para iniciar", statuses: ["na_fila"], targetStatus: "na_fila", tone: "border-amber-200 bg-amber-50", dropTone: "ring-amber-300" },
  { title: "Em lavagem", subtitle: "Em execução agora", statuses: ["em_lavagem"], targetStatus: "em_lavagem", tone: "border-sky-200 bg-sky-50", dropTone: "ring-sky-300" },
  { title: "Finalizadas", subtitle: "Aguardam aviso ou pagamento", statuses: ["aguardando_finalizacao", "finalizado"], targetStatus: "finalizado", tone: "border-emerald-200 bg-emerald-50", dropTone: "ring-emerald-300" },
  { title: "Retirada", subtitle: "Prontas para entregar", statuses: ["cliente_avisado", "pago"], targetStatus: "cliente_avisado", tone: "border-violet-200 bg-violet-50", dropTone: "ring-violet-300" }
];

const statusLabels: Record<string, string> = {
  na_fila: "Na fila",
  em_lavagem: "Em lavagem",
  aguardando_finalizacao: "Aguardando finalização",
  finalizado: "Finalizado",
  cliente_avisado: "Cliente avisado",
  pago: "Pago"
};

export function FilaKanbanClient({ rows, config }: { rows: FilaRow[]; config: LavaConfig }) {
  const [items, setItems] = useState(rows);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function moveCard(id: string, targetStatus: string) {
    const row = items.find((item) => String(item.id) === id);
    if (!row) return;

    startTransition(async () => {
      setPendingId(id);
      setNotice(null);
      const result = await moveLavagemKanban(id, targetStatus);

      if (!result.ok) {
        setNotice({ type: "error", text: result.error ?? "Não foi possível mover." });
        setPendingId(null);
        return;
      }

      if (result.status) {
        setItems((current) =>
          current.map((item) =>
            String(item.id) === id
              ? {
                  ...item,
                  status: result.status,
                  status_label: statusLabels[result.status] ?? result.status
                }
              : item
          )
        );
      }

      setNotice({ type: "ok", text: result.message ?? "Etapa atualizada." });
      setPendingId(null);
    });
  }

  function targetFromPoint(x: number, y: number) {
    const element = document.elementFromPoint(x, y);
    const column = element?.closest<HTMLElement>("[data-kanban-target]");
    return column?.dataset.kanbanTarget ?? null;
  }

  function startPointerDrag(id: string, event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(id);
    setActiveTarget(targetFromPoint(event.clientX, event.clientY));
  }

  function movePointerDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingId) return;
    event.preventDefault();
    event.stopPropagation();
    setActiveTarget(targetFromPoint(event.clientX, event.clientY));
  }

  function endPointerDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!draggingId) return;
    event.preventDefault();
    event.stopPropagation();
    const target = targetFromPoint(event.clientX, event.clientY);
    const id = draggingId;
    setDraggingId(null);
    setActiveTarget(null);
    if (target) moveCard(id, target);
  }

  return (
    <div className="grid gap-4 sm:gap-5">
      {notice ? (
        <p className={`rounded-[8px] border p-3 text-sm font-black leading-6 shadow-sm ${notice.type === "error" ? "border-red-500 bg-red-50 text-red-950" : "border-emerald-500 bg-emerald-50 text-emerald-950"}`}>
          {notice.text}
        </p>
      ) : null}

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {groups.map((group) => {
          const count = items.filter((row) => group.statuses.includes(String(row.status))).length;
          return <MiniCounter key={group.title} label={group.title} value={count} />;
        })}
      </div>

      <div className="-mx-3 overflow-x-auto px-3 pb-3 xl:mx-0 xl:overflow-visible xl:px-0">
        <div className="grid auto-cols-[minmax(292px,86vw)] grid-flow-col gap-4 xl:grid-flow-row xl:grid-cols-4 xl:auto-cols-auto">
          {groups.map((group) => {
            const columnItems = sortByPriority(items.filter((row) => group.statuses.includes(String(row.status))), group.statuses);
            const isActive = activeTarget === group.targetStatus;

            return (
              <section
                className={`grid min-w-0 content-start gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm transition ${isActive ? `ring-4 ${group.dropTone}` : ""}`}
                data-kanban-target={group.targetStatus}
                key={group.title}
              >
                <div className={`sticky top-0 z-[1] rounded-xl border p-3 ${group.tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black">{group.title}</h2>
                      <p className="mt-1 text-xs font-bold text-muted-foreground">{group.subtitle}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-black shadow-sm">{columnItems.length}</span>
                  </div>
                </div>

                {columnItems.length === 0 ? (
                  <p className="rounded-xl bg-muted p-4 text-sm font-semibold text-muted-foreground">Nenhuma lavagem nesta etapa.</p>
                ) : (
                  columnItems.map((row, index) => (
                    <FilaCard
                      config={config}
                      disabled={isPending && pendingId === String(row.id)}
                      dragging={draggingId === String(row.id)}
                      key={String(row.id)}
                      onDragEnd={endPointerDrag}
                      onDragMove={movePointerDrag}
                      onDragStart={startPointerDrag}
                      onMove={moveCard}
                      priority={index + 1}
                      row={row}
                    />
                  ))
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilaCard({
  row,
  config,
  priority,
  onDragStart,
  onDragMove,
  onDragEnd,
  onMove,
  disabled,
  dragging
}: {
  row: FilaRow;
  config: LavaConfig;
  priority: number;
  onDragStart: (id: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  onDragMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onMove: (id: string, targetStatus: string) => void;
  disabled: boolean;
  dragging: boolean;
}) {
  const status = String(row.status);
  const id = String(row.id);
  const phone = phoneFromRow(row);
  const isPaid = row.status_pagamento === "pago";
  const pendingPayment = moneyNumber(row.valor_pendente) > 0 || row.status_pagamento !== "pago";
  const isRetirada = status === "cliente_avisado" || status === "pago";
  const pendingAmount = paymentDisplayAmount(row);
  const checklistOk = row.checklist_status === "concluido";
  const checkoutAvailable = status === "finalizado" || status === "cliente_avisado" || status === "pago";
  const checkoutOk = Number(row.fotos_checkout_count ?? 0) > 0;

  return (
    <details className={`group min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-[#fbfdfc] shadow-sm transition hover:shadow-md ${disabled ? "opacity-60" : ""} ${dragging ? "scale-[0.98] ring-4 ring-emerald-300" : ""}`}>
      <summary className="grid min-w-0 cursor-pointer list-none gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <div className="grid min-w-0 grid-cols-[auto_1fr_auto] items-start gap-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-black text-white" title={`Prioridade ${priority}`}>#{priority}</div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-black" title={String(row.cliente || "Cliente")}>{String(row.cliente || "Cliente")}</h3>
            <p className="truncate text-xs font-semibold text-muted-foreground" title={String(row.veiculo || "-")}>{String(row.veiculo || "-")}</p>
          </div>
          <span className="max-w-[96px] shrink-0 truncate rounded-full bg-[#dff7ec] px-2 py-1 text-center text-[11px] font-black text-[#0f5132]" title={String(row.status_label ?? status)}>{String(row.status_label ?? status)}</span>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 text-xs text-muted-foreground">
          <MiniInfo label="Pagamento" value={String(row.status_pagamento_label ?? "Aberto")} warning={pendingPayment} />
          <MiniInfo label="Valor" value={formatMoney(row.valor_final ?? row.valor)} strong />
          <MiniInfo label="Lavador" value={String(row.funcionario || "-")} />
          <MiniInfo label="Entrega" value={String(row.entrega_label || "Cliente retira")} />
          <MiniInfo label="Checklist" value={String(row.checklist_label || "Pendente")} warning={!checklistOk} />
          <MiniInfo label="Entrada" value={shortTime(row.data_entrada ?? row.data_lavagem)} />
          <MiniInfo label="Depois" value={checkoutOk ? "Com foto" : checkoutAvailable ? "Pendente" : "A liberar"} warning={checkoutAvailable && !checkoutOk} />
        </div>

        <PhotoStrip row={row} checkoutAvailable={checkoutAvailable} />

        {isRetirada && pendingPayment ? (
          <Link
            className="grid rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-center text-xs font-black uppercase tracking-[0.08em] text-amber-950 shadow-sm active:scale-[0.98]"
            href={`/lavagestor/pagamentos?lavagem=${id}`}
            onClick={(event) => event.stopPropagation()}
          >
            Receber pagamento • {formatMoney(pendingAmount)}
          </Link>
        ) : null}

        <div className="grid gap-2 text-xs font-black uppercase tracking-[0.1em] text-primary">
          <div className="flex items-center justify-between gap-2">
            <span>{priorityLabel(row)}</span>
            <span className="group-open:hidden">Expandir</span>
            <span className="hidden group-open:inline">Recolher</span>
          </div>
          <button
            className="touch-none rounded-xl border border-emerald-200 bg-white px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-800 shadow-sm active:scale-[0.98]"
            disabled={disabled}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerCancel={onDragEnd}
            onPointerDown={(event) => onDragStart(id, event)}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            type="button"
          >
            {dragging ? "Solte em uma coluna" : "Segurar e arrastar"}
          </button>
        </div>
      </summary>

      <div className="grid min-w-0 gap-4 border-t border-border p-3">
        <dl className="grid min-w-0 gap-3 text-sm">
          <Info label="Serviços" value={String(row.servicos_resumo || row.servico || "-")} />
          <Info label="WhatsApp" value={String(row.whatsapp || "Não informado")} />
          <Info label="Entrada" value={formatDateTime(row.data_entrada ?? row.data_lavagem)} />
          <Info label="Entrega" value={entregaInfo(row)} />
          <Info label="Observações" value={String(row.observacoes || "-")} />
        </dl>

        <MoveSelect currentStatus={status} disabled={disabled} id={id} onMove={onMove} />

        <div className="grid min-w-0 gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Link className={checklistOk ? "button-secondary" : "button-primary"} href={`/lavagestor/checklists/${id}`}>Checklist</Link>
            <Link className="button-secondary" href={`/lavagestor/tickets/${id}`}>Ticket</Link>
            <Link className="button-secondary" href={`/lavagestor/pagamentos?lavagem=${id}`}>Pagamento</Link>
            <Link className="button-secondary" href={`/lavagestor/recibos/${id}`}>Recibo</Link>
            {checkoutAvailable ? <Link className={checkoutOk ? "button-secondary" : "button-primary"} href={`/lavagestor/checklists/${id}`}>{checkoutOk ? "Ver checkout" : "Foto checkout"}</Link> : null}
          </div>
          {status === "na_fila" ? <><StatusButton id={id} action="iniciar" label="Iniciar lavagem" /><CancelForm id={id} reasons={configArray(config, "motivos_cancelamento")} /></> : null}
          {status === "em_lavagem" ? <StatusButton id={id} action="finalizar" label="Finalizar lavagem" /> : null}
          {status === "finalizado" || status === "aguardando_finalizacao" ? <>{phone ? <a className="button-secondary" href={whatsappLink(row, config)} target="_blank" rel="noreferrer">Avisar veículo finalizado</a> : <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">WhatsApp não informado para este cliente.</p>}<StatusButton id={id} action="avisar_cliente" label="Marcar cliente avisado" /><Link className="button-primary" href={`/lavagestor/pagamentos?lavagem=${id}`}>Registrar pagamento</Link><p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Recibo liberado somente após pagamento.</p></> : null}
          {status === "cliente_avisado" || status === "pago" ? <><MiniPaymentForm row={row} config={config} />{isPaid ? <Link className="button-secondary" href={`/lavagestor/recibos/${id}`}>Ver recibo</Link> : <p className="rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">Registre o pagamento para liberar o recibo.</p>}{isPaid ? <StatusButton id={id} action="entregar" label={row.entrega_tipo === "levar" ? "Marcar entregue ao cliente" : "Entregar veículo"} returnTo={`/lavagestor/recibos/${id}`} /> : null}</> : null}
        </div>
      </div>
    </details>
  );
}

function MoveSelect({ currentStatus, disabled, id, onMove }: { currentStatus: string; disabled: boolean; id: string; onMove: (id: string, targetStatus: string) => void }) {
  return (
    <label className="grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">
      Mover para
      <select className="input bg-white" disabled={disabled} defaultValue="" onChange={(event) => {
        const value = event.target.value;
        event.currentTarget.value = "";
        if (value) onMove(id, value);
      }}>
        <option value="">Selecione uma etapa</option>
        {groups.map((group) => <option disabled={group.statuses.includes(currentStatus)} key={group.targetStatus} value={group.targetStatus}>{group.title}</option>)}
      </select>
    </label>
  );
}

function MiniCounter({ label, value }: { label: string; value: number }) {
  const shortLabel: Record<string, string> = { "Na fila": "Fila", "Em lavagem": "Lavando", Finalizadas: "Final.", Retirada: "Retirada" };
  return <div className="min-w-0 rounded-xl border border-border bg-white px-2 py-2 text-center shadow-sm"><p className="truncate text-[10px] font-black uppercase tracking-[0.06em] text-muted-foreground sm:text-xs">{shortLabel[label] ?? label}</p><strong className="mt-0.5 block text-xl font-black leading-none sm:text-2xl">{value}</strong></div>;
}

function PhotoStrip({ row, checkoutAvailable }: { row: FilaRow; checkoutAvailable: boolean }) {
  const entradaCount = Number(row.fotos_entrada_count ?? 0);
  const checkoutCount = Number(row.fotos_checkout_count ?? 0);
  const entradaPhotos = arrayRows(row.fotos_entrada);
  const checkoutPhotos = arrayRows(row.fotos_checkout);
  return (
    <div className="grid grid-cols-2 gap-2">
      <PhotoThumb label="Antes" photos={entradaPhotos} count={entradaCount} />
      <PhotoThumb label="Depois" photos={checkoutPhotos} count={checkoutCount} muted={!checkoutAvailable && checkoutCount === 0} />
    </div>
  );
}

function PhotoThumb({ label, photos, count, muted = false }: { label: string; photos: FilaRow[]; count: number; muted?: boolean }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = photos[activeIndex] ?? photos[0];
  const thumbnailUrl = photoUrl(active);
  const summaryRows = backupSummaryRows(photos);

  function openPhoto(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!photos.length) return;
    setActiveIndex(0);
    setOpen(true);
  }

  function closePhoto(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
  }

  function previousPhoto(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setActiveIndex((current) => (current - 1 + photos.length) % photos.length);
  }

  function nextPhoto(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setActiveIndex((current) => (current + 1) % photos.length);
  }

  return (
    <div className={`min-w-0 overflow-hidden rounded-xl border border-border bg-white ${muted ? "opacity-60" : ""}`}>
      <button
        className={`block w-full min-w-0 text-left ${photos.length ? "cursor-zoom-in" : "cursor-default"}`}
        disabled={!photos.length}
        onClick={openPhoto}
        type="button"
      >
        {thumbnailUrl ? (
          <img className="aspect-[4/3] w-full object-cover" src={thumbnailUrl} alt={`Foto ${label.toLowerCase()}`} />
        ) : photos.length ? (
          <div className="grid aspect-[4/3] place-items-center bg-muted px-2 text-center text-[11px] font-black leading-4 text-muted-foreground">Foto salva, mas a prévia não carregou.</div>
        ) : (
          <div className="grid aspect-[4/3] place-items-center bg-muted text-xs font-black text-muted-foreground">{label}</div>
        )}
      </button>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] font-black uppercase tracking-[0.06em] text-muted-foreground">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      {summaryRows.length ? (
        <div className="grid gap-1 border-t border-border px-2 py-1.5 text-[10px] font-black leading-4">
          {summaryRows.map((row) => (
            <span className={`truncate rounded-md px-1.5 py-0.5 ${compactStatusTone(row.status)}`} key={`${label}-${row.provider}`} title={row.error || undefined}>
              {providerLabel(row.provider)}: {statusLabel(row.status)}{row.count > 1 ? ` (${row.count})` : ""}
            </span>
          ))}
        </div>
      ) : null}
      {open && active ? (
        <div className="fixed inset-0 z-50 grid bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Fotos ${label}`} onClick={(event) => event.stopPropagation()}>
          <div className="grid max-h-full min-h-0 w-full max-w-5xl self-center justify-self-center overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <div className="min-w-0">
                <strong className="block truncate text-sm">Fotos {label.toLowerCase()}</strong>
                <span className="text-xs font-bold text-muted-foreground">{activeIndex + 1} de {photos.length}</span>
              </div>
              <button className="rounded-lg border border-border px-3 py-2 text-sm font-black" type="button" onClick={closePhoto}>Fechar</button>
            </div>
            <div className="grid min-h-0 gap-3 p-3 lg:grid-cols-[1fr_320px]">
              <div className="relative grid min-h-[48vh] place-items-center overflow-hidden rounded-lg bg-black">
                {photoUrl(active) ? (
                  <img alt={`Foto ${label.toLowerCase()}`} className="max-h-[72vh] w-full object-contain" src={photoUrl(active)} />
                ) : (
                  <div className="p-6 text-center text-sm font-bold text-white">Foto salva, mas a prévia não carregou.</div>
                )}
                {photos.length > 1 ? (
                  <>
                    <button className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm font-black text-slate-950 shadow" type="button" onClick={previousPhoto} aria-label="Foto anterior">Anterior</button>
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-3 py-2 text-sm font-black text-slate-950 shadow" type="button" onClick={nextPhoto} aria-label="Próxima foto">Próxima</button>
                  </>
                ) : null}
              </div>
              <aside className="grid min-h-0 content-start gap-3 overflow-auto rounded-lg border border-border bg-muted/40 p-3">
                <div>
                  <h3 className="text-lg font-black">Foto {label.toLowerCase()}</h3>
                  {active.created_at ? <p className="mt-1 text-sm font-semibold text-muted-foreground">{formatDateTime(active.created_at)}</p> : null}
                  {String(active.legenda ?? "").trim() ? <p className="mt-2 break-words text-sm font-bold">{String(active.legenda)}</p> : null}
                </div>
                <PhotoBackupDetails rows={arrayRows(active.sync_rows)} fotoId={String(active.id ?? "")} />
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PhotoBackupDetails({ rows, fotoId }: { rows: FilaRow[]; fotoId: string }) {
  if (!rows.length) {
    return <p className="rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-muted-foreground">Foto salva no LavaGestor. Backup externo sem provedor conectado.</p>;
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => {
        const provider = String(row.provider ?? "");
        const status = String(row.status ?? "pendente");
        const error = String(row.erro ?? "").trim();
        const lastAttempt = row.last_attempt_at || row.updated_at || row.synced_at;
        return (
          <div className={`rounded-lg border px-2 py-1.5 text-xs font-semibold ${detailStatusTone(status)}`} key={`${fotoId}-${provider}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-black">{providerLabel(provider)}: {statusLabel(status)}</span>
              {lastAttempt ? <span className="text-[11px]">{status === "sincronizado" ? "sincronizado" : "tentativa"} {formatDateTime(lastAttempt)}</span> : null}
            </div>
            {error ? <p className="mt-1 max-h-32 overflow-auto break-words">{providerLabel(provider)}: erro - {error}</p> : null}
            {status === "erro" ? (
              <form action="/api/lavagestor/storage/sync" className="mt-2" method="post">
                <input name="foto_id" type="hidden" value={fotoId} />
                <input name="provider" type="hidden" value={provider} />
                <input name="return_to" type="hidden" value="/lavagestor/fila" />
                <button className="rounded-md border border-current px-2 py-1 text-[11px] font-black" type="submit">Tentar novamente</button>
              </form>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function backupSummaryRows(photos: FilaRow[]) {
  const byProvider = new Map<string, { provider: string; status: string; count: number; error: string }>();

  for (const photo of photos) {
    for (const syncRow of arrayRows(photo.sync_rows)) {
      const provider = String(syncRow.provider ?? "");
      if (!provider) continue;
      const status = String(syncRow.status ?? "pendente");
      const current = byProvider.get(provider);
      const next = {
        provider,
        status: current && statusRank(current.status) >= statusRank(status) ? current.status : status,
        count: (current?.count ?? 0) + 1,
        error: current?.error || String(syncRow.erro ?? "").trim()
      };
      byProvider.set(provider, next);
    }
  }

  return Array.from(byProvider.values()).sort((a, b) => providerLabel(a.provider).localeCompare(providerLabel(b.provider), "pt-BR"));
}

function photoUrl(foto: FilaRow | undefined) {
  return foto ? String(foto.signed_url || foto.preview_url || "") : "";
}

function statusLabel(status: string) {
  if (status === "sincronizado") return "sincronizado";
  if (status === "erro") return "erro";
  return "pendente";
}

function statusRank(status: string) {
  if (status === "erro") return 3;
  if (status === "pendente") return 2;
  if (status === "sincronizado") return 1;
  return 2;
}

function compactStatusTone(status: string) {
  if (status === "sincronizado") return "bg-emerald-50 text-emerald-800";
  if (status === "erro") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-800";
}

function detailStatusTone(status: string) {
  if (status === "sincronizado") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (status === "erro") return "border-red-200 bg-red-50 text-red-950";
  return "border-amber-200 bg-amber-50 text-amber-950";
}

function MiniInfo({ label, value, strong = false, warning = false }: { label: string; value: string; strong?: boolean; warning?: boolean }) {
  return <div className={`min-w-0 rounded-lg px-2 py-2 ${warning ? "bg-amber-50" : "bg-muted"}`}><dt className="truncate font-black uppercase tracking-[0.08em]">{label}</dt><dd className={`mt-1 truncate ${strong ? "font-black text-foreground" : "font-semibold text-foreground"}`} title={value}>{value}</dd></div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>; }
function StatusButton({ id, action, label, returnTo = "/lavagestor/fila" }: { id: string; action: string; label: string; returnTo?: string }) { return <form action={updateLavagemStatus} className="min-w-0"><input name="id" type="hidden" value={id} /><input name="acao" type="hidden" value={action} /><input name="return_to" type="hidden" value={returnTo} /><button className="button-primary w-full" type="submit">{label}</button></form>; }
function CancelForm({ id, reasons }: { id: string; reasons: string[] }) { const options = reasons.length ? reasons : ["Cliente desistiu", "Serviço lançado errado", "Outro motivo"]; return <form action={updateLavagemStatus} className="grid min-w-0 gap-2 rounded-lg border border-red-200 bg-red-50 p-3"><input name="id" type="hidden" value={id} /><input name="acao" type="hidden" value="cancelar" /><input name="return_to" type="hidden" value="/lavagestor/fila" /><label className="grid gap-2 text-sm font-bold text-red-900">Motivo do cancelamento<select className="input border-red-200 bg-white" name="motivo_cancelamento" required defaultValue=""><option value="">Selecione o motivo</option>{options.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label><button className="button-danger w-full" type="submit">Cancelar lavagem</button></form>; }
function MiniPaymentForm({ row, config }: { row: FilaRow; config: LavaConfig }) { if (row.status_pagamento === "pago") return null; return <form action={registrarPagamentoLavagem} className="grid min-w-0 gap-2"><input name="id" type="hidden" value={String(row.id)} /><input name="return_to" type="hidden" value="/lavagestor/fila" /><input name="status_pagamento" type="hidden" value="pago" /><input className="input" name="valor_recebido" placeholder="Valor recebido" type="number" min="0" step="0.01" defaultValue={paymentInputValue(row)} /><select className="input" name="forma_pagamento" defaultValue={configText(config, "forma_pagamento_padrao") || "pix"}><option value="dinheiro">Dinheiro</option><option value="pix">Pix</option><option value="cartao">Cartão</option>{configBoolean(config, "permitir_fiado") ? <option value="fiado">Fiado</option> : null}</select><button className="button-primary w-full" type="submit">Registrar pagamento</button></form>; }
function whatsappLink(row: FilaRow, config: LavaConfig) { const phone = phoneFromRow(row); const vehicle = String(row.veiculo ?? "-"); const value = formatMoney(row.valor_final ?? row.valor); const entrega = entregaInfo(row); const fotos = Number(row.fotos_checkout_count ?? 0) > 0 ? "Fotos de entrada e checkout registradas." : "Fotos de entrada registradas."; const variables: Record<string, string> = { cliente: String(row.cliente ?? ""), veiculo: vehicle, total: value, entrega, empresa: configText(config, "nome_exibicao"), recibo: String(row.id ?? "").slice(0, 8).toUpperCase(), fotos }; const fallback = "Olá, {cliente}! Seu veículo/item {veiculo} está pronto. Total: {total}. {entrega} {fotos}"; const text = applyTemplate(configText(config, "mensagem_veiculo_pronto") || fallback, variables); return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`; }
function entregaInfo(row: FilaRow) { const entregaTipo = String(row.entrega_tipo ?? "retirar"); if (entregaTipo !== "levar") return "Cliente irá retirar"; const endereco = String(row.endereco_entrega ?? "").trim(); return endereco ? `Levar ao cliente: ${endereco}` : "Levar ao cliente"; }
function phoneFromRow(row: FilaRow) { return String(row.whatsapp ?? "").replace(/\D/g, ""); }
function applyTemplate(template: string, variables: Record<string, string>) { return Object.entries(variables).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template); }
function paymentInputValue(row: FilaRow) { const pending = moneyNumber(row.valor_pendente); const finalValue = moneyNumber(row.valor_final ?? row.valor); const received = moneyNumber(row.valor_recebido); const value = pending > 0 ? pending : Math.max(finalValue - received, 0); return value > 0 ? value.toFixed(2) : ""; }
function paymentDisplayAmount(row: FilaRow) { const pending = moneyNumber(row.valor_pendente); const finalValue = moneyNumber(row.valor_final ?? row.valor); const received = moneyNumber(row.valor_recebido); return pending > 0 ? pending : Math.max(finalValue - received, 0); }
function moneyNumber(value: unknown) { const number = Number(value ?? 0); return Number.isFinite(number) ? number : 0; }
function timeValue(value: unknown) { const time = new Date(String(value ?? "")).getTime(); return Number.isFinite(time) ? time : 0; }
function shortTime(value: unknown) { const time = new Date(String(value ?? "")); return Number.isFinite(time.getTime()) ? time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "-"; }
function sortByPriority(rows: FilaRow[], statuses: string[]) { return [...rows].sort((a, b) => priorityScore(a, statuses) - priorityScore(b, statuses) || timeValue(a.data_entrada ?? a.data_lavagem ?? a.created_at) - timeValue(b.data_entrada ?? b.data_lavagem ?? b.created_at)); }
function priorityScore(row: FilaRow, statuses: string[]) { const status = String(row.status); const statusIndex = statuses.indexOf(status); const paymentPenalty = row.status_pagamento === "pago" ? 10 : 0; return (statusIndex < 0 ? 99 : statusIndex) * 10 + paymentPenalty; }
function priorityLabel(row: FilaRow) { if (row.status_pagamento !== "pago") return "Prioridade: receber"; const status = String(row.status); if (status === "na_fila") return "Prioridade: iniciar"; if (status === "em_lavagem") return "Prioridade: finalizar"; if (status === "finalizado" || status === "aguardando_finalizacao") return "Prioridade: avisar"; return "Prioridade: entregar"; }
function configText(config: LavaConfig, key: string) { const value = config[key]; return typeof value === "string" ? value : ""; }
function configBoolean(config: LavaConfig, key: string) { return config[key] === true; }
function configArray(config: LavaConfig, key: string) { const value = config[key]; return Array.isArray(value) ? value.map(String).filter(Boolean) : []; }
function arrayRows(value: unknown) { return Array.isArray(value) ? value as FilaRow[] : []; }
function providerLabel(provider: string) { if (provider === "google_drive") return "Google Drive"; if (provider === "dropbox") return "Dropbox"; return provider || "Backup"; }
