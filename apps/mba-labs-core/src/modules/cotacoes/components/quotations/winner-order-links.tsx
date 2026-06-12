"use client";

import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import type { PurchaseOrder } from "@/modules/cotacoes/lib/types";

export function WinnerOrderLinks({ order }: { order?: PurchaseOrder }) {
  if (!order) {
    return <span className="text-sm text-muted-foreground">Pedido pendente</span>;
  }

  const resolvedOrder = order;
  const path = `/${resolvedOrder.moduleType === "bidding" ? "licitacao" : "cotacao"}/pedido/${resolvedOrder.publicToken}`;

  function buildPublicLink() {
    return `${window.location.origin}${path}`;
  }

  function copyLink() {
    void navigator.clipboard.writeText(buildPublicLink());
    toast.success("Link copiado");
  }

  function openWhatsapp() {
    const phone = (resolvedOrder.supplierWhatsapp ?? "").replace(/\D/g, "");
    const text = `Pedido vencedor MBA Cotacoes: ${buildPublicLink()}`;
    window.open(`https://wa.me/${phone || ""}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" size="sm" onClick={copyLink}>
        <Copy className="h-4 w-4" />
        Copiar link
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={openWhatsapp}>
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
    </div>
  );
}
