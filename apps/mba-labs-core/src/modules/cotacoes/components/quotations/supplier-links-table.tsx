"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, MessageCircle, RefreshCcw, ShieldOff, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/cotacoes/components/ui/table";
import { StatusBadge } from "@/modules/cotacoes/components/dashboard/status-badge";
import type { ModuleType, SupplierQuoteSession } from "@/modules/cotacoes/lib/types";

const sessionStatusLabels: Record<string, string> = {
  opened: "Aguardando resposta",
  draft: "Rascunho",
  submitted: "Respondido",
  expired: "Expirado",
  canceled: "Revogado/Cancelado",
};
const SEMI_AUTO_EVENT = "mba-cotacoes:whatsapp-semi-auto";
const PREPARE_WHATSAPP_EVENT = "mba-cotacoes:whatsapp-prepare-window";
const RELEASE_WHATSAPP_EVENT = "mba-cotacoes:whatsapp-release-window";
const WHATSAPP_STATUS_EVENT = "mba-cotacoes:whatsapp-status-updated";
const WHATSAPP_WINDOW_NAME = "mba-cotacoes-whatsapp";

type WhatsappEnvio = {
  vendedorId: string;
  telefone: string;
  status: "pendente" | "enviado" | "falhou";
  erro?: string;
  enviadoPor?: string;
  enviadoEm?: string;
  skipped?: boolean;
  providerMessageId?: string;
};
type SemiAutoQueue = { vendedorIds: string[]; index: number };

type SemiAutoEventDetail = {
  quotationId?: string;
  vendedorIds?: string[];
  autoOpen?: boolean;
};

type WhatsappStatusEventDetail = {
  quotationId?: string;
  results?: WhatsappEnvio[];
};

export function SupplierLinksTable({ moduleType, sessions }: { moduleType: ModuleType; sessions: SupplierQuoteSession[]; deadlineAt: string }) {
  const [rows, setRows] = useState(sessions);
  const [sendStatus, setSendStatus] = useState<Record<string, WhatsappEnvio>>({});
  const [semiAutoQueue, setSemiAutoQueue] = useState<SemiAutoQueue | null>(null);
  const [openedVendorId, setOpenedVendorId] = useState<string | null>(null);
  const [manualConfirming, setManualConfirming] = useState(false);
  const whatsappWindowRef = useRef<Window | null>(null);
  const preparedWindowRef = useRef(false);
  const prefix = moduleType === "bidding" ? "licitacao" : "cotacao";
  const quotationId = rows[0]?.quotationId;
  const baseUrl = useMemo(() => typeof window === "undefined" ? "http://localhost:3001" : window.location.origin, []);

  useEffect(() => {
    if (!quotationId) return;
    let active = true;
    fetch(`/api/whatsapp-envios?quotationId=${encodeURIComponent(quotationId)}&tipoEnvio=link_cotacao`)
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const envios = Array.isArray(payload.envios) ? payload.envios as WhatsappEnvio[] : [];
        setSendStatus(Object.fromEntries(envios.map((envio) => [envio.vendedorId, envio])));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [quotationId]);

  useEffect(() => {
    if (!quotationId) return;

    const prepareHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ quotationId?: string }>).detail;
      if (detail?.quotationId && detail.quotationId !== quotationId) return;
      prepareWhatsAppWindow();
    };

    const releaseHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ quotationId?: string }>).detail;
      if (detail?.quotationId && detail.quotationId !== quotationId) return;
      releasePreparedWindow();
    };

    const statusHandler = (event: Event) => {
      const detail = (event as CustomEvent<WhatsappStatusEventDetail>).detail;
      if (detail?.quotationId && detail.quotationId !== quotationId) return;
      const results = Array.isArray(detail?.results) ? detail.results : [];
      if (results.length === 0) return;
      setSendStatus((current) => ({
        ...current,
        ...Object.fromEntries(results.filter((result) => result.vendedorId).map((result) => [result.vendedorId, result])),
      }));
    };

    const semiAutoHandler = (event: Event) => {
      const detail = (event as CustomEvent<SemiAutoEventDetail>).detail;
      if (detail?.quotationId && detail.quotationId !== quotationId) return;
      const ids = Array.isArray(detail?.vendedorIds) ? detail.vendedorIds : [];
      startSemiAutomatic(ids, Boolean(detail?.autoOpen));
    };

    window.addEventListener(PREPARE_WHATSAPP_EVENT, prepareHandler);
    window.addEventListener(RELEASE_WHATSAPP_EVENT, releaseHandler);
    window.addEventListener(WHATSAPP_STATUS_EVENT, statusHandler);
    window.addEventListener(SEMI_AUTO_EVENT, semiAutoHandler);
    return () => {
      window.removeEventListener(PREPARE_WHATSAPP_EVENT, prepareHandler);
      window.removeEventListener(RELEASE_WHATSAPP_EVENT, releaseHandler);
      window.removeEventListener(WHATSAPP_STATUS_EVENT, statusHandler);
      window.removeEventListener(SEMI_AUTO_EVENT, semiAutoHandler);
    };
  }, [quotationId, rows, sendStatus]);

  function linkFor(session: SupplierQuoteSession) { return `${baseUrl}/${prefix}/responder/${session.publicToken}`; }
  async function copyLink(session: SupplierQuoteSession) { await navigator.clipboard.writeText(linkFor(session)); toast.success("Link copiado."); }

  function buildWhatsAppUrl(session: SupplierQuoteSession) {
    const phone = normalizeWhatsAppNumber(session.sellerWhatsapp);
    if (!phone) return "";
    const sellerName = session.sellerName || session.sellerCompany || "vendedor";
    const message = `Olá ${sellerName}, segue o link da cotação para resposta no MBA Cotações:\n\n${linkFor(session)}\n\nA resposta deve ser feita pelo link acima.`;
    return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
  }

  function prepareWhatsAppWindow() {
    const existing = whatsappWindowRef.current;
    if (existing && !existing.closed) return existing;
    const popup = window.open("about:blank", WHATSAPP_WINDOW_NAME);
    if (!popup) {
      toast.warning("O navegador bloqueou a aba do WhatsApp. Permita pop-ups para que a fila manual abra automaticamente.");
      return null;
    }
    whatsappWindowRef.current = popup;
    preparedWindowRef.current = true;
    try {
      popup.document.title = "MBA Cotações · aguardando WhatsApp";
      popup.document.body.innerHTML = "<div style='font-family:Arial,sans-serif;padding:32px'><h2>MBA Cotações</h2><p>Aguardando o resultado do envio pela Evolution...</p></div>";
    } catch {
      // A aba será reutilizada mesmo se o navegador não permitir editar o conteúdo temporário.
    }
    return popup;
  }

  function releasePreparedWindow() {
    if (!preparedWindowRef.current) return;
    const popup = whatsappWindowRef.current;
    if (popup && !popup.closed) popup.close();
    whatsappWindowRef.current = null;
    preparedWindowRef.current = false;
  }

  function openWhatsApp(session: SupplierQuoteSession) {
    const url = buildWhatsAppUrl(session);
    if (!url) {
      toast.error("Cadastre o WhatsApp deste vendedor para usar o envio manual.");
      return false;
    }

    let popup = whatsappWindowRef.current;
    if (!popup || popup.closed) popup = window.open("about:blank", WHATSAPP_WINDOW_NAME);
    if (!popup) {
      toast.error("O navegador bloqueou a abertura do WhatsApp. Permita pop-ups para o MBA Cotações.");
      return false;
    }

    whatsappWindowRef.current = popup;
    preparedWindowRef.current = false;
    popup.location.href = url;
    popup.focus();
    setOpenedVendorId(vendorIdFor(session));
    return true;
  }

  function startSemiAutomatic(requestedVendorIds?: string[], autoOpen = false) {
    const requested = new Set((requestedVendorIds ?? []).filter(Boolean));
    const candidates = rows.filter((session) => {
      const vendorId = vendorIdFor(session);
      if (!session.sellerWhatsapp || session.status === "submitted" || session.status === "canceled") return false;
      if (requested.size > 0) return requested.has(vendorId);
      return statusFor(session, sendStatus) === "falhou";
    });
    const ids = candidates.map(vendorIdFor);
    if (ids.length === 0) {
      releasePreparedWindow();
      toast.info("Não há envios com falha aguardando o modo semiautomático.");
      return;
    }

    setSemiAutoQueue({ vendedorIds: ids, index: 0 });
    setOpenedVendorId(null);
    toast.info(`${ids.length} vendedor(es) na fila manual. A mesma aba do WhatsApp será reutilizada.`);
    if (autoOpen && candidates[0]) openWhatsApp(candidates[0]);
  }

  function currentSemiAutoSession() {
    if (!semiAutoQueue) return undefined;
    return rows.find((session) => vendorIdFor(session) === semiAutoQueue.vendedorIds[semiAutoQueue.index]);
  }

  async function confirmManualAndOpenNext() {
    const queue = semiAutoQueue;
    const current = currentSemiAutoSession();
    if (!queue || !current || manualConfirming) return;
    const currentVendorId = vendorIdFor(current);
    if (openedVendorId !== currentVendorId) {
      toast.warning("Abra o WhatsApp deste vendedor antes de confirmar o envio.");
      return;
    }

    setManualConfirming(true);
    try {
      const confirmed = await confirmManualSend(current);
      setSendStatus((state) => ({
        ...state,
        [currentVendorId]: confirmed ?? {
          vendedorId: currentVendorId,
          telefone: current.sellerWhatsapp,
          status: "enviado",
          enviadoPor: "manual_whatsapp",
          enviadoEm: new Date().toISOString(),
        },
      }));

      const nextIndex = queue.index + 1;
      const nextVendorId = queue.vendedorIds[nextIndex];
      const nextSession = nextVendorId ? rows.find((session) => vendorIdFor(session) === nextVendorId) : undefined;

      if (!nextSession) {
        setSemiAutoQueue(null);
        setOpenedVendorId(null);
        toast.success("Fila manual concluída. Todos os envios confirmados foram registrados.");
        return;
      }

      setSemiAutoQueue({ vendedorIds: queue.vendedorIds, index: nextIndex });
      setOpenedVendorId(null);
      openWhatsApp(nextSession);
    } catch (error) {
      toast.warning(error instanceof Error ? error.message : "Não foi possível registrar a confirmação manual.");
    } finally {
      setManualConfirming(false);
    }
  }

  function skipCurrent() {
    const queue = semiAutoQueue;
    if (!queue) return;
    const nextIndex = queue.index + 1;
    const nextVendorId = queue.vendedorIds[nextIndex];
    const nextSession = nextVendorId ? rows.find((session) => vendorIdFor(session) === nextVendorId) : undefined;
    if (!nextSession) {
      setSemiAutoQueue(null);
      setOpenedVendorId(null);
      toast.info("Fila encerrada.");
      return;
    }
    setSemiAutoQueue({ vendedorIds: queue.vendedorIds, index: nextIndex });
    setOpenedVendorId(null);
    openWhatsApp(nextSession);
  }

  async function confirmManualSend(session: SupplierQuoteSession) {
    if (!quotationId) return undefined;
    const response = await fetch("/api/whatsapp-envios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm_manual",
        quotationId,
        tipoEnvio: "link_cotacao",
        vendedorId: vendorIdFor(session),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível registrar o envio manual.");
    return payload.envio as WhatsappEnvio | undefined;
  }

  async function resend(session: SupplierQuoteSession, windowPrepared = false) {
    if (!quotationId) return;
    if (!windowPrepared) prepareWhatsAppWindow();
    try {
      const vendedorId = vendorIdFor(session);
      const response = await fetch("/api/whatsapp-envios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resend", quotationId, tipoEnvio: "link_cotacao", vendedorId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível reenviar.");
      const result = payload.whatsapp?.results?.[0] as WhatsappEnvio | undefined;
      if (result) setSendStatus((current) => ({ ...current, [vendedorId]: result }));
      if (payload.whatsapp?.falhou) {
        toast.warning("A Evolution não confirmou o envio. Abrindo este vendedor no WhatsApp Web.");
        startSemiAutomatic([vendedorId], true);
      } else {
        releasePreparedWindow();
        toast.success("A Evolution confirmou o reenvio.");
      }
    } catch (error) {
      releasePreparedWindow();
      toast.error(error instanceof Error ? error.message : "Não foi possível reenviar WhatsApp.");
    }
  }

  async function revoke(session: SupplierQuoteSession) {
    if (!window.confirm("Revogar este link? O fornecedor não conseguirá mais responder por ele.")) return;
    if (!hasSupabaseBrowserConfig()) { setRows((current) => current.map((row) => row.id === session.id ? { ...row, status: "canceled" } : row)); toast.success("Link revogado no modo local."); return; }
    const payload = await mutateSession({ id: session.id, action: "revoke" });
    if (!payload) return;
    setRows((current) => current.map((row) => row.id === session.id ? { ...row, status: "canceled" } : row));
    toast.success("Link revogado.");
  }

  async function regenerate(session: SupplierQuoteSession) {
    prepareWhatsAppWindow();
    if (!hasSupabaseBrowserConfig()) {
      const publicToken = crypto.randomUUID().replaceAll("-", "");
      setRows((current) => current.map((row) => row.id === session.id ? { ...row, publicToken, status: "opened" } : row));
      releasePreparedWindow();
      toast.success("Novo token gerado no modo local.");
      return;
    }

    const payload = await mutateSession({ id: session.id, action: "regenerate" });
    if (!payload?.token) {
      releasePreparedWindow();
      return;
    }

    const updatedSession: SupplierQuoteSession = {
      ...session,
      publicToken: String(payload.token),
      status: String(payload.status ?? "opened") as SupplierQuoteSession["status"],
    };
    const vendedorId = vendorIdFor(session);
    setRows((current) => current.map((row) => row.id === session.id ? updatedSession : row));
    setSendStatus((current) => ({
      ...current,
      [vendedorId]: {
        vendedorId,
        telefone: session.sellerWhatsapp,
        status: "pendente",
      },
    }));
    toast.success("Novo token gerado. Tentando enviar o novo link pela Evolution.");
    await resend(updatedSession, true);
  }

  if (rows.length === 0) return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-muted-foreground">Nenhum link gerado para esta cotação ainda.</div>;

  const failedCount = rows.filter((session) => session.sellerWhatsapp && statusFor(session, sendStatus) === "falhou" && session.status !== "submitted" && session.status !== "canceled").length;
  const semiAutoSession = currentSemiAutoSession();

  return (
    <div className="space-y-3 p-4">
      {failedCount > 0 && !semiAutoQueue ? (
        <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-amber-950">Evolution falhou em {failedCount} envio(s)</p>
            <p className="text-sm text-amber-800">Use a fila manual. O sistema reutiliza uma única aba do WhatsApp e avança vendedor por vendedor.</p>
          </div>
          <Button type="button" onClick={() => { prepareWhatsAppWindow(); startSemiAutomatic([], true); }}><MessageCircle className="h-4 w-4" />Iniciar fila manual</Button>
        </div>
      ) : null}

      {semiAutoQueue && semiAutoSession ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Fila manual · {semiAutoQueue.index + 1} de {semiAutoQueue.vendedorIds.length}</p>
              <p className="mt-1 font-semibold text-slate-950">{semiAutoSession.sellerName || semiAutoSession.sellerCompany || "Vendedor"}</p>
              <p className="text-sm text-slate-600">{semiAutoSession.sellerWhatsapp}</p>
              <p className="mt-1 text-xs text-slate-500">A conversa abre com a mensagem e o link preenchidos. Clique em Enviar no WhatsApp e depois confirme aqui para abrir o próximo.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => openWhatsApp(semiAutoSession)}><MessageCircle className="h-4 w-4" />{openedVendorId === vendorIdFor(semiAutoSession) ? "Reabrir atual" : "Abrir no WhatsApp"}</Button>
              <Button type="button" onClick={() => void confirmManualAndOpenNext()} disabled={openedVendorId !== vendorIdFor(semiAutoSession) || manualConfirming}><CheckCircle2 className="h-4 w-4" />{manualConfirming ? "Registrando..." : semiAutoQueue.index + 1 >= semiAutoQueue.vendedorIds.length ? "Enviado, concluir" : "Enviado, abrir próximo"}</Button>
              <Button type="button" variant="outline" onClick={skipCurrent} disabled={manualConfirming}><SkipForward className="h-4 w-4" />Pular</Button>
              <Button type="button" variant="ghost" onClick={() => { setSemiAutoQueue(null); setOpenedVendorId(null); }} disabled={manualConfirming}>Encerrar fila</Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:hidden">
        {rows.map((session) => {
          const envio = sendStatus[vendorIdFor(session)];
          const status = statusFor(session, sendStatus);
          return (
            <div key={session.id} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-950">{session.sellerName || session.sellerCompany || "-"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{session.sellerWhatsapp || "WhatsApp não cadastrado"}</p>
                  <div className="mt-2">
                    <p className="mb-1 text-xs font-medium text-slate-500">Resposta</p>
                    <ResponseStatusBadge status={session.status} />
                  </div>
                </div>
                <div className="text-right">
                  <StatusBadge status={status} label={whatsappStatusLabel(envio)} />
                  <p className="mt-1 text-xs text-muted-foreground">{whatsappStatusDetail(envio)}</p>
                </div>
              </div>
              <SupplierLinkActions session={session} onCopy={copyLink} onOpenWhatsApp={openWhatsApp} onRegenerate={regenerate} onResend={resend} onRevoke={revoke} />
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Resposta</TableHead>
              <TableHead>Status do envio</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((session) => {
              const envio = sendStatus[vendorIdFor(session)];
              const status = statusFor(session, sendStatus);
              return (
                <TableRow key={session.id}>
                  <TableCell><p className="font-medium">{session.sellerName || session.sellerCompany || "-"}</p><p className="text-xs text-muted-foreground">{session.sellerCompany || "Fornecedor"}</p></TableCell>
                  <TableCell>{session.sellerWhatsapp || "WhatsApp não cadastrado"}</TableCell>
                  <TableCell><ResponseStatusBadge status={session.status} /></TableCell>
                  <TableCell><StatusBadge status={status} label={whatsappStatusLabel(envio)} /><p className="mt-1 text-xs text-muted-foreground">{whatsappStatusDetail(envio)}</p></TableCell>
                  <TableCell><SupplierLinkActions session={session} onCopy={copyLink} onOpenWhatsApp={openWhatsApp} onRegenerate={regenerate} onResend={resend} onRevoke={revoke} align="end" /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ResponseStatusBadge({ status }: { status: SupplierQuoteSession["status"] }) {
  const responded = status === "submitted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
        responded
          ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
          : "bg-amber-100 text-amber-900 ring-amber-200"
      }`}
    >
      {responded ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      {sessionStatusLabels[status] ?? status}
    </span>
  );
}

function SupplierLinkActions({ session, onCopy, onOpenWhatsApp, onRegenerate, onResend, onRevoke, align = "start" }: { session: SupplierQuoteSession; onCopy: (session: SupplierQuoteSession) => Promise<void>; onOpenWhatsApp: (session: SupplierQuoteSession) => boolean; onRegenerate: (session: SupplierQuoteSession) => Promise<void>; onResend: (session: SupplierQuoteSession, windowPrepared?: boolean) => Promise<void>; onRevoke: (session: SupplierQuoteSession) => Promise<void>; align?: "start" | "end" }) {
  return <div className={`mt-3 flex flex-wrap gap-2 ${align === "end" ? "justify-end" : ""}`}><Button type="button" variant="outline" size="sm" onClick={() => void onCopy(session)}><Copy className="h-4 w-4" />Copiar link</Button>{session.sellerWhatsapp ? <Button type="button" variant="outline" size="sm" onClick={() => onOpenWhatsApp(session)}><MessageCircle className="h-4 w-4" />Abrir WhatsApp</Button> : null}<Button type="button" variant="outline" size="sm" onClick={() => void onResend(session)} disabled={session.status === "submitted" || session.status === "canceled"}><RefreshCcw className="h-4 w-4" />Reenviar WhatsApp</Button><Button type="button" variant="outline" size="sm" onClick={() => void onRegenerate(session)} disabled={session.status === "submitted" || session.status === "canceled"}><RefreshCcw className="h-4 w-4" />Novo token</Button><Button type="button" variant="outline" size="sm" onClick={() => void onRevoke(session)} disabled={session.status === "submitted" || session.status === "canceled"}><ShieldOff className="h-4 w-4" />Revogar</Button></div>;
}

function whatsappStatusLabel(envio?: WhatsappEnvio) {
  if (!envio) return "Pendente";
  if (envio.status === "falhou") return envio.enviadoPor === "evolution_api" ? "Falhou via Evolution" : "Falhou";
  if (envio.status === "pendente") return "Pendente";
  if (envio.enviadoPor === "evolution_api") return "Enviado via Evolution";
  if (envio.enviadoPor === "manual_whatsapp") return "Enviado manualmente";
  if (envio.enviadoPor === "zapi") return "Enviado via Z-API";
  if (envio.enviadoPor === "meta_cloud_api") return "Enviado via Meta";
  return "Enviado automático";
}

function whatsappStatusDetail(envio?: WhatsappEnvio) {
  if (!envio) return "Ainda sem registro de disparo";
  if (envio.status === "falhou") return envio.erro || "O provedor não confirmou o envio";
  if (envio.status === "pendente") return "Aguardando confirmação do provedor";
  const when = formatSentAt(envio.enviadoEm);
  if (envio.enviadoPor === "evolution_api") return `Evolution confirmou o disparo${when ? ` · ${when}` : ""}`;
  if (envio.enviadoPor === "manual_whatsapp") return `Confirmado manualmente${when ? ` · ${when}` : ""}`;
  if (envio.skipped) return `Já constava como enviado${when ? ` · ${when}` : ""}`;
  return `Envio registrado${when ? ` · ${when}` : ""}`;
}

function formatSentAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusFor(session: SupplierQuoteSession, sendStatus: Record<string, WhatsappEnvio>) { return sendStatus[vendorIdFor(session)]?.status ?? "pendente"; }
function vendorIdFor(session: SupplierQuoteSession) { return session.supplierId || session.id; }
function normalizeWhatsAppNumber(value: string) { const digits = String(value ?? "").replace(/\D/g, ""); if (!digits) return ""; return digits.startsWith("55") ? digits : `55${digits}`; }
async function mutateSession(body: Record<string, unknown>) { try { const response = await fetch("/api/cotacoes/supplier-sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar o link."); return payload as Record<string, unknown>; } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o link."); return null; } }
function hasSupabaseBrowserConfig() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
