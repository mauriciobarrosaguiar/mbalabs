import { NextRequest, NextResponse } from "next/server";
import {
  createQuotationFromWinnerPendingItems,
  redirectWinnerPendingItemToNextSupplier,
  updateWinnerPendingItemStatus,
} from "@/modules/cotacoes/lib/data/repository";
import * as demoRepository from "@/modules/cotacoes/lib/data/demo-repository";

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

    if (action === "send_next") {
      const result = useDemo
        ? demoRepository.redirectWinnerPendingItemToNextSupplier(pendingId)
        : await redirectWinnerPendingItemToNextSupplier(pendingId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "new_quotation") {
      const pendingIds = Array.isArray(body.pendingIds) ? body.pendingIds.map(String) : pendingId ? [pendingId] : undefined;
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

function isDemoQuotationRequest(quotationId: string, requestUrl: string) {
  const host = new URL(requestUrl).host;
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  return local && (
    quotationId.startsWith("quote-pharmacy") ||
    quotationId.startsWith("quote-bidding") ||
    quotationId.startsWith("demo-")
  );
}
