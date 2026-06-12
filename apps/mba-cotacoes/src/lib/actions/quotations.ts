"use server";

import { createSupabaseQuotation } from "@/lib/data/supabase-operational";
import type { ModuleType } from "@/lib/types";

export async function createQuotationAction(payload: Parameters<typeof createSupabaseQuotation>[0]) {
  return createSupabaseQuotation(payload);
}

export async function addQuotationItemsAction() {
  throw new Error("Itens são gravados junto da cotação nesta versão do MVP.");
}

export async function createSupplierSessionsAction() {
  throw new Error("Sessões de fornecedor são geradas junto da cotação nesta versão do MVP.");
}

export async function generateQuotationLinksAction(payload: Parameters<typeof createSupabaseQuotation>[0] & { moduleType: ModuleType }) {
  const result = await createSupabaseQuotation(payload);
  const prefix = result.quotation.moduleType === "bidding" ? "licitacao" : "cotacao";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

  return {
    ...result,
    links: result.sessions.map((session: { supplierId: string; publicToken: string }) => ({
      supplierId: session.supplierId,
      token: session.publicToken,
      url: `${appUrl}/${prefix}/responder/${session.publicToken}`,
    })),
  };
}
