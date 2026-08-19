import "server-only";

import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

export type ShortageItem = {
  id: string;
  tenantId: string;
  productName: string;
  ean?: string;
  requestedQuantity: number;
  requestedUnit: string;
  notes?: string;
  status: "pending" | "quoted";
  quotationId?: string;
  createdAt: string;
  updatedAt: string;
};

export async function listPendingShortageItems(tenantId: string): Promise<ShortageItem[]> {
  if (!tenantId) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shortage_items")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapShortageItem);
}

export function mapShortageItem(row: Record<string, unknown>): ShortageItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    productName: String(row.product_name),
    ean: row.ean ? String(row.ean) : undefined,
    requestedQuantity: Number(row.requested_quantity ?? 0),
    requestedUnit: String(row.requested_unit ?? "UN"),
    notes: row.notes ? String(row.notes) : undefined,
    status: row.status === "quoted" ? "quoted" : "pending",
    quotationId: row.quotation_id ? String(row.quotation_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
