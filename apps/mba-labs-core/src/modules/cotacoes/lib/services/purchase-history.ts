import type { PurchaseOrder } from "@/modules/cotacoes/lib/types";

/** Histórico de compras usa a conferência dos pedidos, inclusive faltas. */
export function buildBilledPurchaseHistory(orders: PurchaseOrder[], tenantId?: string) {
  return orders.filter((order) =>
    (!tenantId || order.tenantId === tenantId) &&
    !["canceled", "cancelado"].includes(order.status) &&
    Boolean(order.completedAt || ["confirmed", "finalizado_pelo_vendedor", "parcialmente_faturado", "nao_faturado"].includes(order.status)),
  ).flatMap((order) => order.items.filter((item) => item.tenantId === order.tenantId).map((item) => {
    const requested = Number(item.quantityToBuy) || 0;
    const billed = Number(item.billedQuantity ?? (item.fulfillmentStatus === "faturado" ? requested : 0)) || 0;
    return {
      id: item.id,
      orderId: order.id,
      productName: item.offeredProductName || item.productName,
      supplierName: order.supplierName,
      date: order.completedAt || order.generatedAt,
      requested,
      billed,
      missing: Math.max(0, requested - billed),
      billedAmount: billed * item.unitPrice,
      status: item.fulfillmentStatus || "pendente",
    };
  })).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
