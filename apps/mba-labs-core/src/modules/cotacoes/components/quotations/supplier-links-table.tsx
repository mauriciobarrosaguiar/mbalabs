"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCcw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/modules/cotacoes/components/ui/table";
import { StatusBadge } from "@/modules/cotacoes/components/dashboard/status-badge";
import type { ModuleType, SupplierQuoteSession } from "@/modules/cotacoes/lib/types";

const sessionStatusLabels: Record<string, string> = { opened: "Pendente", draft: "Rascunho", submitted: "Respondido", expired: "Expirado", canceled: "Revogado/Cancelado" };
const whatsappLabels: Record<string, string> = { pendente: "pendente", enviado: "enviado", falhou: "falhou" };
type WhatsappEnvio = { vendedorId: string; telefone: string; status: "pendente" | "enviado" | "falhou"; erro?: string };

export function SupplierLinksTable({ moduleType, sessions }: { moduleType: ModuleType; sessions: SupplierQuoteSession[]; deadlineAt: string }) {
  const [rows, setRows] = useState(sessions);
  const [sendStatus, setSendStatus] = useState<Record<string, WhatsappEnvio>>({});
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

  function linkFor(session: SupplierQuoteSession) { return `${baseUrl}/${prefix}/responder/${session.publicToken}`; }
  async function copyLink(session: SupplierQuoteSession) { await navigator.clipboard.writeText(linkFor(session)); toast.success("Link copiado."); }
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
        toast.warning("Reenvio falhou.");
      } else {
        toast.success("WhatsApp reenviado.");
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível reenviar WhatsApp."); }
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
    if (!hasSupabaseBrowserConfig()) { const publicToken = crypto.randomUUID().replaceAll("-", ""); setRows((current) => current.map((row) => row.id === session.id ? { ...row, publicToken, status: "opened" } : row)); toast.success("Novo token gerado no modo local."); return; }
    const payload = await mutateSession({ id: session.id, action: "regenerate" });
    if (!payload?.token) return;
    setRows((current) => current.map((row) => row.id === session.id ? { ...row, publicToken: String(payload.token), status: String(payload.status ?? "opened") as SupplierQuoteSession["status"] } : row));
    toast.success("Novo token gerado.");
  }

  if (rows.length === 0) return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-muted-foreground">Nenhum link gerado para esta cotação ainda.</div>;

  return (
    <div className="space-y-3 p-4">
      <div className="grid gap-3 md:hidden">
        {rows.map((session) => {
          const status = statusFor(session, sendStatus);
          return <div key={session.id} className="rounded-md border border-slate-200 bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-950">{session.sellerName || session.sellerCompany || "-"}</p><p className="mt-1 text-sm text-muted-foreground">{session.sellerWhatsapp || "WhatsApp não cadastrado"}</p><p className="mt-1 text-xs text-muted-foreground">Resposta: {sessionStatusLabels[session.status] ?? session.status}</p></div><StatusBadge status={status} label={whatsappLabels[status] ?? status} /></div><SupplierLinkActions session={session} status={status} onCopy={copyLink} onRegenerate={regenerate} onResend={resend} onRevoke={revoke} /></div>;
        })}
      </div>
      <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Vendedor</TableHead><TableHead>WhatsApp</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{rows.map((session) => { const status = statusFor(session, sendStatus); return <TableRow key={session.id}><TableCell><p className="font-medium">{session.sellerName || session.sellerCompany || "-"}</p><p className="text-xs text-muted-foreground">{session.sellerCompany || "Fornecedor"}</p></TableCell><TableCell>{session.sellerWhatsapp || "WhatsApp não cadastrado"}</TableCell><TableCell><StatusBadge status={status} label={whatsappLabels[status] ?? status} /></TableCell><TableCell><SupplierLinkActions session={session} status={status} onCopy={copyLink} onRegenerate={regenerate} onResend={resend} onRevoke={revoke} align="end" /></TableCell></TableRow>; })}</TableBody></Table></div>
    </div>
  );
}

function SupplierLinkActions({ session, status, onCopy, onRegenerate, onResend, onRevoke, align = "start" }: { session: SupplierQuoteSession; status: WhatsappEnvio["status"]; onCopy: (session: SupplierQuoteSession) => Promise<void>; onRegenerate: (session: SupplierQuoteSession) => Promise<void>; onResend: (session: SupplierQuoteSession) => Promise<void>; onRevoke: (session: SupplierQuoteSession) => Promise<void>; align?: "start" | "end" }) {
  return <div className={`mt-3 flex flex-wrap gap-2 ${align === "end" ? "justify-end" : ""}`}><Button type="button" variant="outline" size="sm" onClick={() => void onCopy(session)}><Copy className="h-4 w-4" />Copiar link</Button>{status === "falhou" ? <Button type="button" variant="outline" size="sm" onClick={() => void onResend(session)}><RefreshCcw className="h-4 w-4" />Reenviar WhatsApp</Button> : null}<Button type="button" variant="outline" size="sm" onClick={() => void onRegenerate(session)} disabled={session.status === "submitted" || session.status === "canceled"}><RefreshCcw className="h-4 w-4" />Novo token</Button><Button type="button" variant="outline" size="sm" onClick={() => void onRevoke(session)} disabled={session.status === "submitted" || session.status === "canceled"}><ShieldOff className="h-4 w-4" />Revogar</Button></div>;
}
function statusFor(session: SupplierQuoteSession, sendStatus: Record<string, WhatsappEnvio>) { return sendStatus[vendorIdFor(session)]?.status ?? "pendente"; }
function vendorIdFor(session: SupplierQuoteSession) { return session.supplierId || session.id; }
async function mutateSession(body: Record<string, unknown>) { try { const response = await fetch("/api/cotacoes/supplier-sessions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar o link."); return payload as Record<string, unknown>; } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o link."); return null; } }
function hasSupabaseBrowserConfig() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
