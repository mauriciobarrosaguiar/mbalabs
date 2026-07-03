import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/modules/cotacoes/lib/auth/session";
import { ensureQuotationAccess } from "@/modules/cotacoes/lib/auth/quotation-access";
import {
  createQuotationFromWinnerPendingItems,
  redirectWinnerPendingItemToNextSupplier,
  updateWinnerPendingItemStatus,
} from "@/modules/cotacoes/lib/data/repository";
import * as demoRepository from "@/modules/cotacoes/lib/data/demo-repository";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quotationId: string }> },
) {
  try {
    const { quotationId } = await params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const pendingId = String(body.pendingId ?? "");
    const useDemo = isDemoQuotationRequest(quotationId, request.url);
    const pendingIds = Array.isArray(body.pendingIds) ? body.pendingIds.map(String) : pendingId ? [pendingId] : undefined;

    if (!useDemo) {
      const auth = await getCurrentAuthContext();
      const access = await ensureQuotationAccess(auth, quotationId);
      if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
      if (pendingIds?.length) {
        const pendingAccess = await ensurePendingItemsBelongToQuotation(pendingIds, quotationId, access.tenantId);
        if (!pendingAccess.ok) return NextResponse.json({ error: pendingAccess.error }, { status: pendingAccess.status });
      }
    }

    if (action === "send_next") {
      const result = useDemo
        ? demoRepository.redirectWinnerPendingItemToNextSupplier(pendingId)
        : await redirectWinnerPendingItemToNextSupplier(pendingId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "new_quotation") {
      const quotation = useDemo
        ? demoRepository.createQuotationFromWinnerPendingItems(quotationId, pendingIds)
        : await createQuotationFromWinnerPendingItems(quotationId, pendingIds);
      return NextResponse.json({ ok: true, quotation });
    }

    if (action === "resolve" || action === "cancel") {
      const status = action === "resolve" ? "resolvido" : "cancelado";
      const pending = useDemo
        ? demoRepository.updateWinnerPendingItemStatus(pendingId, status)
        : await updateWinnerPendingItemStatus(pendingId, status);
      return NextResponse.json({ ok: true, pending });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar pendência." },
      { status: 500 },
    );
  }
}

async function ensurePendingItemsBelongToQuotation(pendingIds: string[], quotationId: string, tenantId?: string) {
  type PendingItemRow = { id: string; quotation_id: string | null; tenant_id: string | null };
  const ids = Array.from(new Set(pendingIds.filter(Boolean)));
  if (ids.length === 0) return { ok: true as const };

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("winner_order_pending_items")
    .select("id,quotation_id,tenant_id")
    .in("id", ids);
  if (tenantId) query = query.eq("tenant_id", tenantId);

  const { data, error } = await query;
  const rows = (data ?? []) as PendingItemRow[];
  if (error) throw error;
  if (rows.length !== ids.length) {
    return { ok: false as const, status: 404, error: "Pendencia nao encontrada." };
  }
  if (rows.some((item) => item.quotation_id !== quotationId)) {
    return { ok: false as const, status: 403, error: "Pendencia nao pertence a esta cotacao." };
  }

  return { ok: true as const };
}

function isDemoQuotationRequest(quotationId: string, requestUrl: string) {
  const host = new URL(requestUrl).host;
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  return local && (
    quotationId.startsWith("quote-pharmacy") ||
    quotationId.startsWith("quote-bidding") ||
    quotationId.startsWith("demo-")
  );
}
