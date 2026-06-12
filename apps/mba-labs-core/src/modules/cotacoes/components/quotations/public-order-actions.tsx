"use client";

import { Copy, Download, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import type { PurchaseOrder } from "@/modules/cotacoes/lib/types";
import { formatCurrencyBRL, formatInteger } from "@/modules/cotacoes/lib/formatters";
import { getPurchaseOrderSupplierDisplay } from "@/modules/cotacoes/lib/purchase-order-display";

export function PublicOrderActions({ order }: { order: PurchaseOrder }) {
  const text = buildOrderText(order);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Pedido copiado");
    } catch (error) {
      console.error("Erro ao copiar pedido vencedor", error);
      toast.error("Não foi possível copiar o pedido.");
    }
  }

  function openWhatsapp() {
    const phone = (order.supplierWhatsapp ?? "").replace(/\D/g, "");
    const url = `https://wa.me/${phone || ""}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        Imprimir/PDF
      </Button>
      <Button asChild type="button" variant="outline">
        <a href={`/api/cotacoes/export/pedido/${order.publicToken}`}>
          <Download className="h-4 w-4" />
          Baixar Excel
        </a>
      </Button>
      <Button type="button" variant="outline" onClick={() => void copy()}>
        <Copy className="h-4 w-4" />
        Copiar pedido
      </Button>
      <Button type="button" onClick={openWhatsapp}>
        <MessageCircle className="h-4 w-4" />
        Abrir WhatsApp
      </Button>
    </div>
  );
}

function buildOrderText(order: PurchaseOrder) {
  const lines = [
    `Pedido MBA Cotações - ${getPurchaseOrderSupplierDisplay(order)}`,
    order.supplierWhatsapp ? `WhatsApp: ${order.supplierWhatsapp}` : undefined,
    `Total: ${formatCurrencyBRL(order.totalAmount)}`,
    "",
    ...order.items.map(
      (item) =>
        `- ${item.offeredProductName ?? item.productName}: ${formatInteger(item.quantityToBuy)} ${item.unit} | ${formatCurrencyBRL(item.totalPrice)}`,
    ),
  ].filter((line): line is string => line !== undefined);

  return lines.join("\n");
}
