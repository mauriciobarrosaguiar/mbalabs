"use client";

import { useMemo, useState } from "react";
import { Copy, MessageCircle, RefreshCcw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { formatDateBR } from "@/lib/formatters";
import type { ModuleType, SupplierQuoteSession } from "@/lib/types";

const sessionStatusLabels: Record<string, string> = {
  opened: "Pendente",
  draft: "Rascunho",
  submitted: "Respondido",
  expired: "Expirado",
  canceled: "Revogado/Cancelado",
};

export function SupplierLinksTable({
  moduleType,
  sessions,
  deadlineAt,
}: {
  moduleType: ModuleType;
  sessions: SupplierQuoteSession[];
  deadlineAt: string;
}) {
  const [rows, setRows] = useState(sessions);
  const prefix = moduleType === "bidding" ? "licitacao" : "cotacao";
  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "http://localhost:3001";
    return window.location.origin;
  }, []);

  function linkFor(session: SupplierQuoteSession) {
    return `${baseUrl}/${prefix}/responder/${session.publicToken}`;
  }

  async function copyLink(session: SupplierQuoteSession) {
    await navigator.clipboard.writeText(linkFor(session));
    toast.success("Link copiado.");
  }

  function whatsappUrl(session: SupplierQuoteSession) {
    const phone = session.sellerWhatsapp?.replace(/\D/g, "") ?? "";
    const text = `Olá, estou enviando uma cotação. Acesse o link abaixo, preencha os preços disponíveis e envie sua resposta até ${formatDateBR(deadlineAt)}: ${linkFor(session)}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  async function revoke(session: SupplierQuoteSession) {
    if (!window.confirm("Revogar este link? O fornecedor não conseguirá mais responder por ele.")) return;
    if (!hasSupabaseBrowserConfig()) {
      setRows((current) => current.map((row) => row.id === session.id ? { ...row, status: "canceled" } : row));
      toast.success("Link revogado no modo local.");
      return;
    }
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
    setRows((current) => current.map((row) => row.id === session.id ? {
      ...row,
      publicToken: String(payload.token),
      status: String(payload.status ?? "opened") as SupplierQuoteSession["status"],
    } : row));
    toast.success("Novo token gerado.");
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-muted-foreground">
        Nenhum link gerado para esta cotação ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="grid gap-3 md:hidden">
        {rows.map((session) => (
          <div key={session.id} className="rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-950">{session.sellerCompany || session.sellerName || "-"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{session.sellerWhatsapp || "-"}</p>
              </div>
              <StatusBadge status={session.status} label={sessionStatusLabels[session.status] ?? session.status} />
            </div>
            <SupplierLinkActions
              session={session}
              whatsappUrl={whatsappUrl(session)}
              onCopy={copyLink}
              onRegenerate={regenerate}
              onRevoke={revoke}
            />
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((session) => (
              <TableRow key={session.id}>
                <TableCell>
                  <p className="font-medium">{session.sellerCompany || "-"}</p>
                  <p className="text-xs text-muted-foreground">{session.sellerName || "Fornecedor"}</p>
                </TableCell>
                <TableCell>{session.sellerWhatsapp || "-"}</TableCell>
                <TableCell>
                  <StatusBadge status={session.status} label={sessionStatusLabels[session.status] ?? session.status} />
                </TableCell>
                <TableCell>
                  <SupplierLinkActions
                    session={session}
                    whatsappUrl={whatsappUrl(session)}
                    onCopy={copyLink}
                    onRegenerate={regenerate}
                    onRevoke={revoke}
                    align="end"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SupplierLinkActions({
  session,
  whatsappUrl,
  onCopy,
  onRegenerate,
  onRevoke,
  align = "start",
}: {
  session: SupplierQuoteSession;
  whatsappUrl: string;
  onCopy: (session: SupplierQuoteSession) => Promise<void>;
  onRegenerate: (session: SupplierQuoteSession) => Promise<void>;
  onRevoke: (session: SupplierQuoteSession) => Promise<void>;
  align?: "start" | "end";
}) {
  return (
    <div className={`mt-3 flex flex-wrap gap-2 ${align === "end" ? "justify-end" : ""}`}>
      <Button type="button" variant="outline" size="sm" onClick={() => void onCopy(session)}>
        <Copy className="h-4 w-4" />Copiar link
      </Button>
      <Button asChild type="button" variant="outline" size="sm">
        <a href={whatsappUrl} target="_blank" rel="noreferrer">
          <MessageCircle className="h-4 w-4" />WhatsApp
        </a>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void onRegenerate(session)} disabled={session.status === "submitted" || session.status === "canceled"}>
        <RefreshCcw className="h-4 w-4" />Novo token
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => void onRevoke(session)} disabled={session.status === "submitted" || session.status === "canceled"}>
        <ShieldOff className="h-4 w-4" />Revogar
      </Button>
    </div>
  );
}

async function mutateSession(body: Record<string, unknown>) {
  try {
    const response = await fetch("/api/supplier-sessions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar o link.");
    return payload as Record<string, unknown>;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o link.");
    return null;
  }
}

function hasSupabaseBrowserConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
