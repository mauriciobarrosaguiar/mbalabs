import { randomBytes } from "node:crypto";
import type { ModuleType } from "@/modules/cotacoes/lib/types";

export function createPurchaseOrderPublicToken(order: { moduleType: ModuleType }) {
  return `pedido-${order.moduleType}-${randomBytes(32).toString("hex")}`;
}
