"use server";

import { createSupabaseQuotation } from "@/modules/cotacoes/lib/data/supabase-operational";
import type { ModuleType } from "@/modules/cotacoes/lib/types";

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
  const appUrl = resolvePublicAppUrl();

  return {
    ...result,
    links: result.sessions.map((session: { supplierId?: string; publicToken: string }) => ({
      supplierId: session.supplierId,
      token: session.publicToken,
      url: `${appUrl}/cotacoes/responder/${session.publicToken}`,
    })),
  };
}

function resolvePublicAppUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_CORE_URL;
  if (explicitUrl) return normalizeOrigin(explicitUrl);

  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelUrl) return normalizeOrigin(vercelUrl);

  return "http://localhost:3000";
}

function normalizeOrigin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "http://localhost:3000";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
