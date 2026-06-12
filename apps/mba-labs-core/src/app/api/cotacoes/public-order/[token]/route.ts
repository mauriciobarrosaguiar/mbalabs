import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import * as demoRepository from "@/modules/cotacoes/lib/data/demo-repository";
import {
  canUseSupabaseOperational,
  markSupabasePurchaseOrderOpened,
  saveSupabasePurchaseOrderReview,
} from "@/modules/cotacoes/lib/data/supabase-operational";
import type { PurchaseOrderItemFulfillmentStatus } from "@/modules/cotacoes/lib/types";

type OrderAction = "open" | "save" | "finalize";
const orderActions = new Set<OrderAction>(["open", "save", "finalize"]);
const notFoundMessage = "Pedido não encontrado ou link expirado.";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  let action: OrderAction = "save";
  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    action = normalizeAction(body.action);
    const items = Array.isArray(body.items)
      ? body.items.map((item: Record<string, unknown>) => ({
          id: String(item.id ?? ""),
          fulfillmentStatus: normalizeFulfillmentStatus(item.fulfillmentStatus),
          billedQuantity: normalizeQuantity(item.billedQuantity),
          vendorObservation: String(item.vendorObservation ?? ""),
        })).filter((item: { id: string }) => item.id)
      : [];

    console.info("[PublicOrder] Payload recebido", {
      token,
      action,
      itemCount: items.length,
      payload: body,
    });

    const useDemo = await shouldUseDemoForToken(token);
    const order = useDemo
      ? runDemoAction(token, action, items)
      : await runSupabaseAction(token, action, items);

    if (!order) {
      console.warn("[PublicOrder] Pedido não encontrado após ação", { token, action });
      return NextResponse.json({ error: notFoundMessage }, { status: 404 });
    }

    console.info("[PublicOrder] Pedido atualizado", {
      token,
      action,
      orderId: order.id,
      status: order.status,
      itemCount: order.items.length,
    });

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error("[PublicOrder] Erro ao atualizar pedido público", {
      action,
      error,
    });
    const status = isNotFoundError(error) ? 404 : 500;
    return NextResponse.json(
      { error: resolvePublicOrderErrorMessage(error, action) },
      { status },
    );
  }
}

async function shouldUseDemoForToken(token: string) {
  const host = (await headers()).get("host") ?? "";
  const isLocalRequest =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");
  return isLocalRequest && (
    token.includes("demo-token") ||
    token.startsWith("farmacia-pedido") ||
    token.startsWith("licitacao-pedido") ||
    token.startsWith("pedido-pharmacy") ||
    token.startsWith("pedido-bidding")
  );
}

function runDemoAction(
  token: string,
  action: OrderAction,
  items: Array<{ id: string; fulfillmentStatus: PurchaseOrderItemFulfillmentStatus; vendorObservation?: string; billedQuantity?: number }>,
) {
  if (action === "open") return demoRepository.markPurchaseOrderOpened(token);
  return demoRepository.savePurchaseOrderReview(token, items, action === "finalize");
}

async function runSupabaseAction(
  token: string,
  action: OrderAction,
  items: Array<{ id: string; fulfillmentStatus: PurchaseOrderItemFulfillmentStatus; vendorObservation?: string; billedQuantity?: number }>,
) {
  if (!canUseSupabaseOperational()) {
    throw new Error("Supabase não configurado para atualizar pedidos reais.");
  }
  if (action === "open") return markSupabasePurchaseOrderOpened(token);
  return saveSupabasePurchaseOrderReview(token, items, action === "finalize");
}

function normalizeFulfillmentStatus(value: unknown): PurchaseOrderItemFulfillmentStatus {
  if (value === "faturado" || value === "parcial" || value === "nao_faturado" || value === "pendente") {
    return value;
  }
  if (value === "a_faturar") return "pendente";
  return "pendente";
}

function normalizeAction(value: unknown): OrderAction {
  return orderActions.has(value as OrderAction) ? value as OrderAction : "save";
}

function normalizeQuantity(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : undefined;
}

function isNotFoundError(error: unknown) {
  return error instanceof Error && error.message === notFoundMessage;
}

function resolvePublicOrderErrorMessage(error: unknown, action: OrderAction) {
  if (isNotFoundError(error)) return notFoundMessage;
  if (error instanceof Error && isControlledPublicOrderError(error.message)) return error.message;
  return action === "finalize"
    ? "Não foi possível finalizar o pedido. Verifique os itens e tente novamente."
    : "Não foi possível salvar a conferência do pedido. Verifique os itens e tente novamente.";
}

function isControlledPublicOrderError(message: string) {
  return [
    "Não foi possível salvar a conferência do pedido.",
    "Não foi possível finalizar o pedido.",
    "Supabase não configurado",
  ].some((prefix) => message.startsWith(prefix));
}
