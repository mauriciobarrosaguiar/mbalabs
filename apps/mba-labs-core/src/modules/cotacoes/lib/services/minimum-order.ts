import type { PurchaseOrder } from "@/modules/cotacoes/lib/types";

export type MinimumOrderRule = {
  orderId: string;
  distributorId: string;
  distributorName: string;
  minimum: number;
  itemIds: string[];
};

export type MinimumOrderShortfall = MinimumOrderRule & {
  amount: number;
  shortfall: number;
};

/**
 * O mínimo aplica-se ao valor por distribuidora dentro de cada pedido de
 * representante. Um mesmo pedido pode ter mais de uma distribuidora.
 * O resultado é uma prévia: a aprovação refaz o cálculo dentro do PostgreSQL.
 */
export function calculateMinimumOrderShortfalls(
  orders: PurchaseOrder[],
  rules: MinimumOrderRule[],
  editedQuantities: Record<string, string | number> = {},
): MinimumOrderShortfall[] {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  return rules.flatMap((rule) => {
    const order = orderById.get(rule.orderId);
    if (!order || !Number.isFinite(rule.minimum) || rule.minimum <= 0) return [];
    const selected = new Set(rule.itemIds);
    const amount = order.items.reduce((total, item) => {
      if (!selected.has(item.id)) return total;
      const raw = editedQuantities[item.id] ?? item.quantityToBuy;
      const quantity = typeof raw === "string" ? Number(raw.replace(",", ".")) : raw;
      if (!Number.isFinite(quantity) || quantity <= 0) return total;
      return total + quantity * item.unitPrice;
    }, 0);
    const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
    if (rounded <= 0 || rounded >= rule.minimum) return [];
    return [{
      ...rule,
      amount: rounded,
      shortfall: Math.round((rule.minimum - rounded + Number.EPSILON) * 100) / 100,
    }];
  });
}
