"use client";

import { useEffect, useState } from "react";
import { Copy, MessageCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/modules/cotacoes/components/dashboard/status-badge";
import { Button } from "@/modules/cotacoes/components/ui/button";
import type { PurchaseOrder } from "@/modules/cotacoes/lib/types";

type WhatsappStatus = "pendente" | "enviado" | "falhou";
type WhatsappEnvio = {
  vendedorId: string;
  status: WhatsappStatus;
  erro?: string;
  deliveryStatus?: string;
  enviadoEm?: string;
  entregueEm?: string;
  lidoEm?: string;
};

export function WinnerOrderLinks({ order }: { order?: PurchaseOrder }) {
  const [envio, setEnvio] = useState<WhatsappEnvio | null>(null);

  useEffect(() => {
    if (!order) return;
    let active = true;
    const query = new URLSearchParams({
      quotationId: order.quotationId,
      tipoEnvio: "resultado_cotacao",
      vendedorId: vendorIdFor(order),
    });

    async function loadStatus() {
      try {
        const response = await fetch(`/api/whatsapp-envios?${query.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!active) return;
        const first = Array.isArray(payload.envios) ? payload.envios[0] as WhatsappEnvio | undefined : undefined;
        if (first) setEnvio(first);
      } catch {
        // O acompanhamento é complementar e não deve interromper a análise.
      }
    }

    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [order]);

  if (!order) return <span className="text-sm text-muted-foreground">Pedido pendente</span>;
  if (!order.publicToken) return <span className="text-sm text-muted-foreground">Link pendente</span>;

  const safeOrder = order;
  const path = `/${safeOrder.moduleType === "bidding" ? "licitacao" : "cotacao"}/pedido/${safeOrder.publicToken}`;
  const status = envio?.status ?? "pendente";

  function buildPublicLink() { return `${window.location.origin}${path}`; }
  function copyLink() { void navigator.clipboard.writeText(buildPublicLink()); toast.success("Link copiado"); }

  function openWhatsApp() {
    const phone = normalizeWhatsAppNumber(safeOrder.supplierWhatsapp);
    if (!phone) {
      toast.error("Cadastre o WhatsApp deste vendedor para usar o envio manual.");
      return;
    }
    const sellerName = safeOrder.supplierName || safeOrder.supplierCompany || "vendedor";
    const message = `Olá ${sellerName}, segue o link do pedido/resultado da cotação no MBA Cotações:\n\n${buildPublicLink()}\n\nAcesse o link acima para visualizar o pedido.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function resend() {
    try {
      const response = await fetch("/api/whatsapp-envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resend",
          quotationId: safeOrder.quotationId,
          tipoEnvio: "resultado_cotacao",
          vendedorId: vendorIdFor(safeOrder),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível reenviar.");
      const result = payload.whatsapp?.results?.[0] as WhatsappEnvio | undefined;
      if (result) setEnvio(result);
      if (payload.whatsapp?.falhou) {
        toast.warning("A Evolution não confirmou o envio. Use 'Abrir WhatsApp' para enviar pelo WhatsApp do aparelho.");
      } else {
        toast.success("WhatsApp reenviado.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reenviar WhatsApp.");
    }
  }

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-end">
      <StatusBadge status={status} label={whatsappLabel(envio)} />
      <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto">
        <Button type="button" variant="outline" size="sm" className="w-full whitespace-normal" onClick={copyLink}>
          <Copy className="h-4 w-4" />Copiar link
        </Button>
        {safeOrder.supplierWhatsapp ? (
          <Button type="button" variant="outline" size="sm" className="w-full whitespace-normal" onClick={openWhatsApp}>
            <MessageCircle className="h-4 w-4" />WhatsApp
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="w-full whitespace-normal" onClick={() => void resend()}>
          <RefreshCcw className="h-4 w-4" />Reenviar
        </Button>
      </div>
      {envio?.erro ? <p className="max-w-xs text-right text-xs text-red-700">{envio.erro}</p> : null}
    </div>
  );
}

function whatsappLabel(envio: WhatsappEnvio | null) {
  if (!envio) return "pendente";
  if (envio.status === "falhou") return "falhou";
  if (["read", "played"].includes(envio.deliveryStatus ?? "")) return "lido";
  if (envio.deliveryStatus === "delivered") return "entregue";
  if (envio.status === "enviado") return "enviado";
  return "pendente";
}

function vendorIdFor(order: PurchaseOrder) { return order.supplierId || order.id; }
function normalizeWhatsAppNumber(value?: string) { const digits = String(value ?? "").replace(/\D/g, ""); if (!digits) return ""; return digits.startsWith("55") ? digits : `55${digits}`; }
