import type {
  Distributor,
  QuotationAward,
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
} from "@/modules/cotacoes/lib/types";

export interface PharmacyAnalysisResult {
  ranking: SupplierQuoteResponseItem[];
  awards: QuotationAward[];
  distributorMinimums: Array<{
    distributorName: string;
    sellerName: string;
    totalWon: number;
    minimumOrder: number;
    status: "atingiu" | "não atingiu" | "atenção";
  }>;
  totals: {
    totalItems: number;
    answeredItems: number;
    estimatedTotal: number;
    estimatedSavings: number;
  };
}

export function generatePharmacyAwards(
  quotationItem: QuotationItem,
  responseItems: SupplierQuoteResponseItem[],
  responses: SupplierQuoteResponse[] = [],
) {
  const validResponses = responseItems
    .filter(
      (item) =>
        item.quotationItemId === quotationItem.id &&
        isEligibleOffer(quotationItem, item),
    )
    .sort((a, b) => comparePharmacyResponseItems(a, b, responses));

  let remaining = quotationItem.requestedQuantity;
  const awards: QuotationAward[] = [];
  for (const [index, winner] of validResponses.entries()) {
    if (remaining <= 0) break;
    const awardedQuantity = Math.min(remaining, offeredQuantity(quotationItem, winner));
    remaining -= awardedQuantity;
    awards.push({
      id: `award-${quotationItem.id}-${winner.id}`,
      tenantId: quotationItem.tenantId,
      quotationId: quotationItem.quotationId,
      quotationItemId: quotationItem.id,
      supplierResponseItemId: winner.id,
      supplierId: winner.supplierId,
      supplierName:
        responses.find((response) => response.id === winner.responseId)
          ?.sellerName ??
        responses.find((response) => response.id === winner.responseId)
          ?.sellerCompany ??
        "Fornecedor",
      moduleType: "pharmacy",
      rankingPosition: index + 1,
      awardedQuantity,
      awardedPackages: awardedQuantity,
      unitPrice: winner.unitPrice ?? 0,
      totalPrice: roundMoney(awardedQuantity * (winner.unitPrice ?? 0)),
      remainingBalanceAfter: remaining,
      status: remaining > 0 ? "partial" : "winner",
    });
  }
  return awards;
}

// Legacy price-only responses retain their previous full-quantity meaning.
// Explicit stock/quantity answers always take precedence over that fallback.
function offeredQuantity(item: QuotationItem, offer: SupplierQuoteResponseItem) {
  if (offer.availableQuantity != null) {
    return Number.isFinite(offer.availableQuantity) ? Math.max(0, offer.availableQuantity) : 0;
  }
  return offer.hasFullQuantity === false ? 0 : item.requestedQuantity;
}

function isEligibleOffer(item: QuotationItem, offer: SupplierQuoteResponseItem) {
  const quantity = offeredQuantity(item, offer);
  return Number.isFinite(item.requestedQuantity) && item.requestedQuantity > 0 &&
    Number.isFinite(offer.unitPrice) && (offer.unitPrice ?? 0) > 0 &&
    offer.hasStock !== false && quantity > 0 &&
    (item.allowPartialSupply || quantity >= item.requestedQuantity);
}

export function buildPharmacyAnalysis(
  quotationItems: QuotationItem[],
  responseItems: SupplierQuoteResponseItem[],
  responses: SupplierQuoteResponse[],
  distributors: Distributor[],
): PharmacyAnalysisResult {
  const submittedResponseIds = new Set(
    responses
      .filter((response) => response.status === "submitted")
      .map((response) => response.id),
  );
  const validResponseItems = responseItems.filter(
    (responseItem) =>
      submittedResponseIds.has(responseItem.responseId) &&
      Number.isFinite(responseItem.unitPrice) && (responseItem.unitPrice ?? 0) > 0,
  );
  const ranking = quotationItems.flatMap((item) =>
    validResponseItems
      .filter((responseItem) => responseItem.quotationItemId === item.id && isEligibleOffer(item, responseItem))
      .sort((a, b) => comparePharmacyResponseItems(a, b, responses))
      .map((responseItem, index) => ({
        ...responseItem,
        rankingPosition: responseItem.unitPrice ? index + 1 : undefined,
      })),
  );
  const awards = quotationItems.flatMap((item) =>
    generatePharmacyAwards(item, validResponseItems, responses),
  );

  const distributorMinimums = distributors.map((distributor) => {
    const distributorResponseIds = validResponseItems
      .filter((item) => item.distributorId === distributor.id)
      .map((item) => item.id);
    const totalWon = awards
      .filter((award) =>
        distributorResponseIds.includes(award.supplierResponseItemId),
      )
      .reduce((total, award) => total + award.totalPrice, 0);
    const sellerName =
      responses.find((response) =>
        validResponseItems.some(
          (item) =>
            item.distributorId === distributor.id &&
            item.responseId === response.id,
        ),
      )?.sellerName ?? "-";

    const status: "atingiu" | "não atingiu" | "atenção" =
      totalWon >= distributor.pedidoMinimo
        ? "atingiu"
        : totalWon > 0
          ? "atenção"
          : "não atingiu";

    return {
      distributorName: `${distributor.nome} ${distributor.uf}`,
      sellerName,
      totalWon,
      minimumOrder: distributor.pedidoMinimo,
      status,
    };
  });

  const lastPurchaseTotal = quotationItems.reduce(
    (total, item) =>
      total + (item.lastPurchasePrice ?? 0) * item.requestedQuantity,
    0,
  );
  const estimatedTotal = awards.reduce(
    (total, award) => total + award.totalPrice,
    0,
  );

  return {
    ranking,
    awards,
    distributorMinimums,
    totals: {
      totalItems: quotationItems.length,
      answeredItems: new Set(ranking.map((item) => item.quotationItemId)).size,
      estimatedTotal: roundMoney(estimatedTotal),
      estimatedSavings: roundMoney(Math.max(0, lastPurchaseTotal - estimatedTotal)),
    },
  };
}

function comparePharmacyResponseItems(
  a: SupplierQuoteResponseItem,
  b: SupplierQuoteResponseItem,
  responses: SupplierQuoteResponse[],
) {
  const priceDiff = (a.unitPrice ?? Infinity) - (b.unitPrice ?? Infinity);
  if (priceDiff !== 0) return priceDiff;

  // Confirmed quantities break price ties; missing stock does not imply unlimited stock.
  const confirmedA = Number.isFinite(a.availableQuantity) ? Math.max(0, a.availableQuantity ?? 0) : 0;
  const confirmedB = Number.isFinite(b.availableQuantity) ? Math.max(0, b.availableQuantity ?? 0) : 0;
  if (confirmedA !== confirmedB) return confirmedB - confirmedA;

  const responseById = new Map(responses.map((response) => [response.id, response]));
  const submittedA = new Date(
    responseById.get(a.responseId)?.submittedAt ?? "9999-12-31T23:59:59.999Z",
  ).getTime();
  const submittedB = new Date(
    responseById.get(b.responseId)?.submittedAt ?? "9999-12-31T23:59:59.999Z",
  ).getTime();
  if (submittedA !== submittedB) return submittedA - submittedB;

  const supplierA = a.supplierId ?? responseById.get(a.responseId)?.supplierId ?? a.responseId;
  const supplierB = b.supplierId ?? responseById.get(b.responseId)?.supplierId ?? b.responseId;
  return supplierA.localeCompare(supplierB);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
