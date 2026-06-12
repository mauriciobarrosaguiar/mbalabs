import type { PurchaseOrderItemFulfillmentStatus } from "@/lib/types";

const markerPrefix = "[MBA_ORDER_REVIEW:";
const markerPattern = /\n?\[MBA_ORDER_REVIEW:([^\]]+)\]\s*$/;

export interface LegacyPurchaseOrderReview {
  fulfillmentStatus?: PurchaseOrderItemFulfillmentStatus;
  vendorObservation?: string;
  reviewedAt?: string;
  observation?: string;
}

export function buildLegacyPurchaseOrderItemObservation({
  currentObservation,
  fulfillmentStatus,
  vendorObservation,
  reviewedAt,
}: {
  currentObservation?: string | null;
  fulfillmentStatus: PurchaseOrderItemFulfillmentStatus;
  vendorObservation?: string | null;
  reviewedAt: string;
}) {
  const visibleObservation = stripLegacyPurchaseOrderReview(currentObservation ?? "");
  const payload = encodeURIComponent(JSON.stringify({
    fulfillmentStatus,
    vendorObservation: vendorObservation ?? "",
    reviewedAt,
  }));
  return `${visibleObservation}${visibleObservation ? "\n" : ""}${markerPrefix}${payload}]`;
}

export function parseLegacyPurchaseOrderReview(value?: string | null): LegacyPurchaseOrderReview | null {
  if (!value) return null;
  const match = value.match(markerPattern);
  if (!match?.[1]) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as {
      fulfillmentStatus?: unknown;
      vendorObservation?: unknown;
      reviewedAt?: unknown;
    };
    return {
      fulfillmentStatus: normalizeLegacyFulfillmentStatus(parsed.fulfillmentStatus),
      vendorObservation: typeof parsed.vendorObservation === "string" ? parsed.vendorObservation : "",
      reviewedAt: typeof parsed.reviewedAt === "string" ? parsed.reviewedAt : undefined,
      observation: stripLegacyPurchaseOrderReview(value),
    };
  } catch {
    return null;
  }
}

export function stripLegacyPurchaseOrderReview(value?: string | null) {
  return String(value ?? "").replace(markerPattern, "").trim();
}

function normalizeLegacyFulfillmentStatus(value: unknown): PurchaseOrderItemFulfillmentStatus | undefined {
  if (value === "faturado" || value === "parcial" || value === "nao_faturado" || value === "pendente") {
    return value;
  }
  if (value === "a_faturar") return "pendente";
  return undefined;
}
