import "server-only";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";
import type { PurchaseOrder } from "@/modules/cotacoes/lib/types";
import type { MinimumOrderRule } from "@/modules/cotacoes/lib/services/minimum-order";

/**
 * Exibe apenas regras de distribuidoras cadastradas na MESMA farmácia.
 * Não inventa mínimo quando a oferta não possui distribuidora identificada.
 */
export async function loadMinimumOrderRules(
  tenantId: string,
  orders: PurchaseOrder[],
  enabled: boolean,
): Promise<MinimumOrderRule[]> {
  if (!enabled || !orders.length) return [];

  const ids = [...new Set(orders.flatMap((order) =>
    order.items.map((item) => item.distributorId).filter((id): id is string => Boolean(id)),
  ))];
  if (!ids.length) return [];

  const { data, error } = await createSupabaseAdminClient()
    .from("distributors")
    .select("id, nome, pedido_minimo")
    .eq("tenant_id", tenantId)
    .in("id", ids);
  if (error) throw new Error("Não foi possível verificar pedidos mínimos das distribuidoras.");
  type DistributorRow = { id: string; nome: string; pedido_minimo: number | string };
  const byId = new Map<string, { name: string; minimum: number }>(
    ((data ?? []) as DistributorRow[]).map((d): [string, { name: string; minimum: number }] =>
      [d.id, { name: d.nome, minimum: Number(d.pedido_minimo) }]),
  );

  return orders.flatMap((order) => {
    const groups = new Map<string, string[]>();
    for (const item of order.items) {
      if (!item.distributorId || !byId.has(item.distributorId)) continue;
      groups.set(item.distributorId, [...(groups.get(item.distributorId) ?? []), item.id]);
    }
    return [...groups.entries()].flatMap(([distributorId, itemIds]) => {
      const distributor = byId.get(distributorId);
      if (!distributor || !Number.isFinite(distributor.minimum) || distributor.minimum <= 0) return [];
      return [{
        orderId: order.id,
        distributorId,
        distributorName: distributor.name,
        minimum: distributor.minimum,
        itemIds,
      }];
    });
  });
}
