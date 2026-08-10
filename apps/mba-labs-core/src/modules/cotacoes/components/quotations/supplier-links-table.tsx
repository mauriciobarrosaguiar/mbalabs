"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, MessageCircle, RefreshCcw, ShieldOff, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/cotacoes/components/ui/table";
import { StatusBadge } from "@/modules/cotacoes/components/dashboard/status-badge";
import type { ModuleType, SupplierQuoteSession } from "@/modules/cotacoes/lib/types";

const sessionStatusLabels: Record<string, string> = { opened: "Pendente", draft: "Rascunho", submitted: "Respondido", expired: "Expirado", canceled: "Revogado/Cancelado" };
const whatsappLabels: Record<string, string> = { pendente: "pendente", enviado: "enviado", falhou: "falhou" };
const SEMI_AUTO_EVENT = "mba-cotacoes:whatsapp-semi-auto";
const WHATSAPP_WINDOW_NAME = "mba-cotacoes-whatsapp";
type WhatsappEnvio = { vendedorId: string; telefone: string; status: "pendente" | "enviado" | "falhou"; erro?: string };
type SemiAutoQueue = { vendedorIds: string[]; index: number };

type SemiAutoEventDetail = {
  quotationId?: string;
  vendedorIds?: string[];
};

export function SupplierLinksTable({ moduleType, sessions }: { moduleType: ModuleType; sessions: SupplierQuoteSession[]; deadlineAt: string }) {
  const [rows, setRows] = useState(sessions);
  const [sendStatus, setSendStatus] = useState<Record<string, WhatsappEnvio>>({});
  const [semiAutoQueue, setSemiAutoQueue] = useState<SemiAutoQueue | null>(null);
  const [openedVendorId, setOpenedVendorId] = useState<string | null>(null);
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
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SemiAutoEventDetail>).detail;
      if (detail?.quotationId && detail.quotationId !== quotationId) return;
      const ids = Array.isArray(detail?.vendedorIds) ? detail.vendedorIds : [];
      startSemiAutomatic(ids);
    };
    window.addEventListener(SEMI_AUTO_EVENT, handler);
    return () => window.removeEventListener(SEMI_AUTO_EVENT, handler);
  }, [quotationId, rows, sendStatus]);

  function linkFor(session: SupplierQuoteSession) { return `${baseUrl}/${prefix}/responder/${session.publicToken}`; }
  async function copyLink(session: SupplierQuoteSession) { await navigator.clipboard.writeText(linkFor(session)); toast.success("Link copiado."); }

  function buildWhatsAppUrl(session: SupplierQuoteSession) {
    const phone = normalizeWhatsAppNumber(session.sellerWhatsapp);
    if (!phone) return "";
    const sellerName = session.sellerName || session.sellerCompany || "vendedor";
    const message = `Olá ${sellerName}, segue o link da cotação para resposta no MBA Cotações:\n\n${linkFor(session)}\n\nA resposta deve ser feita pelo link acima.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  function openWhatsApp(session: SupplierQuoteSession) {
    const url = buildWhatsAppUrl(session);
    if (!url) {
      toast.error("Cadastre o WhatsApp deste vendedor para usar o envio manual.");
      return false;
    }
    const popup = window.open(url, WHATSAPP_WINDOW_NAME);
    if (!popup) {
      toast.error("O navegador bloqueou a abertura do WhatsApp. Permita pop-ups para o MBA Cotações.");
      return false;
    }
    popup.focus();
    setOpenedVendorId(vendorIdFor(session));
    return true;
  }

  function startSemiAutomatic(requestedVendorIds?: string[]) {
    const requested = new Set((requestedVendorIds ?? []).filter(Boolean));
    const candidates = rows.filter((session) => {
      const vendorId = vendorIdFor(session);
      if (!session.sellerWhatsapp || session.status === "submitted" || session.status === "canceled") return false;
      if (requested.size > 0) return requested.has(vendorId);
      return statusFor(session, sendStatus) === "falhou";
    });
    const ids = candidates.map(vendorIdFor);
    if (ids.length === 0) {
      toast.info("Não há envios com falha aguardando o modo semiautomático.");
      return;
    }
    setSemiAutoQueue({ vendedorIds: ids, index: 0 });
    setOpenedVendorId(null);
    toast.info(`${ids.length} vendedor(es) colocado(s) na fila semiautomática. Será usada sempre a mesma aba do WhatsApp.`);
  }

  function currentSemiAutoSession() {
    if (!semiAutoQueue) return undefined;
    return rows.find((session) => vendorIdFor(session) === semiAutoQueue.vendedorIds[semiAutoQueue.index]);
  }

  function confirmManualAndOpenNext() {
    const queue = semiAutoQueue;
    const current = currentSemiAutoSession();
    if (!queue || !current) return;
    const currentVendorId = vendorIdFor(current);
    if (openedVendorId !== currentVendorId) {
      toast.warning("Abra o WhatsApp deste vendedor antes de confirmar o envio.");
      return;
    }

    const nextIndex = queue.index + 1;
    const nextVendorId = queue.vendedorIds[nextIndex];
    const nextSession = nextVendorId ? rows.find((session) => vendorIdFor(session) === nextVendorId) : undefined;

    setSendStatus((state) => ({
      ...state,
      [currentVendorId]: {
        vendedorId: currentVendorId,
        telefone: current.sellerWhatsapp,
        status: "enviado",
      },
    }));

    void confirmManualSend(current).catch(() => {
      setSendStatus((state) => ({
        ...state,
        [currentVendorId]: {
          vendedorId: currentVendorId,
          telefone: current.sellerWhatsapp,
          status: "falhou",
          erro: "Não foi possível registrar a confirmação manual.",
        },
      }));
      toast.warning("O envio manual foi feito, mas não foi possível registrar a confirmação no sistema.");
    });

    if (!nextSession) {
      setSemiAutoQueue(null);
      setOpenedVendorId(null);
      toast.success("Fila semiautomática concluída.");
      return;
    }

    setSemiAutoQueue({ vendedorIds: queue.vendedorIds, index: nextIndex });
    setOpenedVendorId(null);
    openWhatsApp(nextSession);
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
    if (!quotationId) return;
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
  }

  async function resend(session: SupplierQuoteSession) {
    if (!quotationId) return;
    try {
      const vendedorId = vendorIdFor(session);
      const response = await fetch("/api/whatsapp-envios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resend", quotationId, tipoEnvio: "link_cotacao", vendedorId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível reenviar.");
      const result = payload.whatsapp?.results?.[0] as WhatsappEnvio | undefined;
      if (result) setSendStatus((current) => ({ ...current, [vendedorId]: result }));
      if (payload.whatsapp?.falhou) {
        toast.warning("A Evolution não confirmou o envio. Use o modo semiautomático para enviar sem abrir várias abas.");
        startSemiAutomatic([vendedorId]);
      } else {
        toast.success("WhatsApp reenviado.");
      }
    } catch (error) {
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
    if (!hasSupabaseBrowserConfig()) {
      const publicToken = crypto.randomUUID().replaceAll("-", "");
      setRows((current) => current.map((row) => row.id === session.id ? { ...row, publicToken, status: "opened" } : row));
      toast.success("Novo token gerado no modo local.");
      return;
    }

    const payload = await mutateSession({ id: session.id, action: "regenerate" });
    if (!payload?.token) return;

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
    toast.success("Novo token gerado. Tentando enviar o novo link pelo WhatsApp.");
    await resend(updatedSession);
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
            <p className="text-sm text-amber-800">Use a fila semiautomática. O sistema reaproveita uma única aba do WhatsApp e avança vendedor por vendedor.</p>
          </div>
          <Button type="button" onClick={() => startSemiAutomatic()}><MessageCircle className="h-4 w-4" />Iniciar envio semiautomático</Button>
        </div>
      ) : null}

      {semiAutoQueue && semiAutoSession ? (
        <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Envio semiautomático · {semiAutoQueue.index + 1} de {semiAutoQueue.vendedorIds.length}</p>
              <p className="mt-1 font-semibold text-slate-950">{semiAutoSession.sellerName || semiAutoSession.sellerCompany || "Vendedor"}</p>
              <p className="text-sm text-slate-600">{semiAutoSession.sellerWhatsapp}</p>
              <p className="mt-1 text-xs text-slate-500">Sempre será reutilizada a mesma aba do WhatsApp.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => openWhatsApp(semiAutoSession)}><MessageCircle className="h-4 w-4" />{openedVendorId === vendorIdFor(semiAutoSession) ? "Reabrir atual" : "Abrir no WhatsApp"}</Button>
              <Button type="button" onClick={confirmManualAndOpenNext} disabled={openedVendorId !== vendorIdFor(semiAutoSession)}><CheckCircle2 className="h-4 w-4" />{semiAutoQueue.index + 1 >= semiAutoQueue.vendedorIds.length ? "Enviado, concluir" : "Enviado, abrir próximo"}</Button>
              <Button type="button" variant="outline" onClick={skipCurrent}><SkipForward className="h-4 w-4" />Pular</Button>
              <Button type="button" variant="ghost" onClick={() => { setSemiAutoQueue(null); setOpenedVendorId(null); }}>Encerrar fila</Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:hidden">
        {rows.map((session) => {
          const status = statusFor(session, sendStatus);
          return <div key={session.id} className="rounded-md border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-950">{session.sellerName || session.sellerCompany || "-"}</p><p className="mt-1 text-sm text-muted-foreground">{session.sellerWhatsapp || "WhatsApp não cadastrado"}</p><p className="mt-1 text-xs text-muted-foreground">Resposta: {sessionStatusLabels[session.status] ?? session.status}</p></div><StatusBadge status={status} label={whatsappLabels[status] ?? status} /></div><SupplierLinkActions session={session} onCopy={copyLink} onOpenWhatsApp={openWhatsApp} onRegenerate={regenerate} onResend={resend} onRevoke={revoke} /></div>;
        })}
      </div>
      <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead>WhatsApp</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{rows.map((session) => { const status = statusFor(session, sendStatus); return <TableRow key={session.id}><TableCell><p className="font-medium">{session.sellerName || session.sellerCompany || "-"}</p><p className="text-xs text-muted-foreground">{session.sellerCompany || "Fornecedor"}</p></TableCell><TableCell>{session.sellerWhatsapp || "WhatsApp não cadastrado"}</TableCell><TableCell><StatusBadge status={status} label={whatsappLabels[status] ?? status} /></TableCell><TableCell><SupplierLinkActions session={session} onCopy={copyLink} onOpenWhatsApp={openWhatsApp} onRegenerate={regenerate} onResend={resend} onRevoke={revoke} align="end" /></TableCell></TableRow>; })}</TableBody></Table></div>
    </div>
  );
}

function SupplierLinkActions({ session, onCopy, onOpenWhatsApp, onRegenerate, onResend, onRevoke, align = "start" }: { session: SupplierQuoteSession; onCopy: (session: SupplierQuoteSession) => Promise<void>; onOpenWhatsApp: (session: SupplierQuoteSession) => boolean; onRegenerate: (session: SupplierQuoteSession) => Promise<void>; onResend: (session: SupplierQuoteSession) => Promise<void>; onRevoke: (session: SupplierQuoteSession) => Promise<void>; align?: "start" | "end" }) {
  return <div className={`mt-3 flex flex-wrap gap-2 ${align === "end" ? "justify-end" : ""}`}><Button type="button" variant="outline" size="sm" onClick={() => void onCopy(session)}><Copy className="h-4 w-4" />Copiar link</Button>{session.sellerWhatsapp ? <Button type="button" variant="outline" size="sm" onClick={() => onOpenWhatsApp(session)}><MessageCircle className="h-4 w-4" />Abrir WhatsApp</Button> : null}<Button type="button" variant="outline" size="sm" onClick={() => void onResend(session)} disabled={session.status === "submitted" || session.status === "canceled"}><RefreshCcw className="h-4 w-4" />Reenviar WhatsApp</Button><Button type="button" variant="outline" size="sm" onClick={() => void onRegenerate(session)} disabled={session.status === "submitted" || session.status === "canceled"}><RefreshCcw className="h-4 w-4" />Novo token</Button><Button type="button" variant="outline" size="sm" onClick={() => void onRevoke(session)} disabled={session.status === "submitted" || session.status === "canceled"}><ShieldOff className="h-4 w-4" />Revogar</Button></div>;
}
function statusFor(session: SupplierQuoteSession, sendStatus: Record<string, WhatsappEnvio>) { return sendStatus[vendorIdFor(session)]?.status ?? "pendente"; }
function vendorIdFor(session: SupplierQuoteSession) { return session.supplierId || session.id; }
function normalizeWhatsAppNumber(value: string) { const digits = String(value ?? "").replace(/\D/g, ""); if (!digits) return ""; return digits.startsWith("55") ? digits : `55${digits}`; }
async function mutateSession(body: Record<string, unknown>) { try { const response = await fetch("/api/cotacoes/supplier-sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar o link."); return payload as Record<string, unknown>; } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o link."); return null; } }
function hasSupabaseBrowserConfig() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
