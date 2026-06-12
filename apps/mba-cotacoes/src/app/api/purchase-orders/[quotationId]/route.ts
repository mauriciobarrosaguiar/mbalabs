import { NextRequest, NextResponse } from "next/server";
import { generatePurchaseOrders } from "@/lib/data/repository";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ quotationId: string }> },
) {
  const { quotationId } = await params;
  try {
    const orders = await generatePurchaseOrders(quotationId);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Erro ao gerar pedidos dos vencedores", { quotationId, error });
    return NextResponse.json(
      { error: resolveErrorMessage(error, "Erro ao gerar pedidos.") },
      { status: 500 },
    );
  }
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (parts.length > 0) return parts.join(" ");
  }
  return fallback;
}
