import type {
  PendingBalance,
  QuotationAward,
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
} from "@/modules/cotacoes/lib/types";

export interface BiddingCalculationInput {
  requestedQuantity: number;
  packageQuantity: number;
  packagePrice: number;
  hasFullQuantity: boolean;
  availableQuantity?: number | null;
}

export interface BiddingCalculationResult {
  convertedUnitPrice: number;
  requiredPackagesTotal: number;
  totalPriceIfFull: number;
  quantityToBuy: number;
  packagesToBuy: number;
  quantityShortage: number;
  technicalSurplus: number;
  totalPriceAvailable: number;
  status: "atendido_total" | "atendido_parcial" | "nao_atendido";
}

export interface BiddingAnalysisResult {
  ranking: SupplierQuoteResponseItem[];
  awards: QuotationAward[];
  pendingBalances: PendingBalance[];
  totals: {
    totalItems: number;
    answeredItems: number;
    fullySuppliedItems: number;
    pendingItems: number;
    estimatedTotal: number;
    averageUnitPrice: number;
  };
  alerts: string[];
}

export function calculateConvertedUnitPrice(
  packagePrice: number,
  packageQuantity: number,
) {
  if (packageQuantity <= 0) {
    throw new Error("A quantidade por embalagem deve ser maior que zero.");
  }

  if (packagePrice < 0) {
    throw new Error("O preço da embalagem não pode ser negativo.");
  }

  return roundMoney(packagePrice / packageQuantity);
}

export function calculateBiddingResponseItem(
  input: BiddingCalculationInput,
): BiddingCalculationResult {
  const { requestedQuantity, packageQuantity, packagePrice, hasFullQuantity } =
    input;
  const convertedUnitPrice = calculateConvertedUnitPrice(
    packagePrice,
    packageQuantity,
  );
  const requiredPackagesTotal = Math.ceil(requestedQuantity / packageQuantity);
  const totalPriceIfFull = roundMoney(requiredPackagesTotal * packagePrice);
  const available = hasFullQuantity
    ? requestedQuantity
    : Math.max(0, input.availableQuantity ?? 0);
  const quantityToBuy = Math.min(available, requestedQuantity);
  const packagesToBuy = Math.ceil(quantityToBuy / packageQuantity);
  const totalPriceAvailable = roundMoney(packagesToBuy * packagePrice);
  const quantityShortage = Math.max(0, requestedQuantity - quantityToBuy);
  const technicalSurplus = Math.max(
    0,
    packagesToBuy * packageQuantity - quantityToBuy,
  );
  const status =
    quantityToBuy <= 0
      ? "nao_atendido"
      : quantityShortage > 0
        ? "atendido_parcial"
        : "atendido_total";

  return {
    convertedUnitPrice,
    requiredPackagesTotal,
    totalPriceIfFull,
    quantityToBuy,
    packagesToBuy,
    quantityShortage,
    technicalSurplus,
    totalPriceAvailable,
    status,
  };
}

export function calculateBiddingResponseItems(
  quotationItem: QuotationItem,
  responseItems: SupplierQuoteResponseItem[],
) {
  return responseItems
    .filter((responseItem) => responseItem.quotationItemId === quotationItem.id)
    .map((responseItem) => {
      if (
        responseItem.packagePrice == null ||
        responseItem.packageQuantity == null ||
        !responseItem.offeredUnit
      ) {
        return {
          ...responseItem,
          alertStatus: "Resposta incompleta",
        };
      }

      const compatible = isUnitCompatible(
        quotationItem.requestedUnit,
        responseItem.offeredUnit,
      );

      if (!compatible) {
        return {
          ...responseItem,
          alertStatus: "Unidade incompatível",
        };
      }

      const calculated = calculateBiddingResponseItem({
        requestedQuantity: quotationItem.requestedQuantity,
        packageQuantity: responseItem.packageQuantity,
        packagePrice: responseItem.packagePrice,
        hasFullQuantity: Boolean(responseItem.hasFullQuantity),
        availableQuantity: responseItem.availableQuantity,
      });

      return {
        ...responseItem,
        ...calculated,
        alertStatus: buildBiddingAlert(quotationItem, responseItem, calculated),
      };
    })
    .sort((a, b) => {
      const first = a.convertedUnitPrice ?? Number.POSITIVE_INFINITY;
      const second = b.convertedUnitPrice ?? Number.POSITIVE_INFINITY;
      return first - second;
    })
    .map((item, index) => ({
      ...item,
      rankingPosition: item.convertedUnitPrice ? index + 1 : undefined,
    }));
}

export function generateBiddingAwards(
  quotationItem: QuotationItem,
  responseItems: SupplierQuoteResponseItem[],
  responses: SupplierQuoteResponse[] = [],
) {
  const calculatedItems = calculateBiddingResponseItems(
    quotationItem,
    responseItems,
  ).filter(
    (item) =>
      item.convertedUnitPrice != null &&
      item.packageQuantity != null &&
      item.packagePrice != null &&
      item.alertStatus !== "Unidade incompatível",
  );

  const awards: QuotationAward[] = [];
  let remainingBalance = quotationItem.requestedQuantity;

  for (const responseItem of calculatedItems) {
    if (remainingBalance <= 0) break;

    const packageQuantity = responseItem.packageQuantity ?? 1;
    const packagePrice = responseItem.packagePrice ?? 0;
    const supplierCapacity = responseItem.hasFullQuantity
      ? quotationItem.requestedQuantity
      : Math.max(0, responseItem.availableQuantity ?? 0);
    const awardedQuantity = Math.min(supplierCapacity, remainingBalance);

    if (awardedQuantity <= 0) continue;

    const awardedPackages = Math.ceil(awardedQuantity / packageQuantity);
    const totalPrice = roundMoney(awardedPackages * packagePrice);
    remainingBalance = Math.max(0, remainingBalance - awardedQuantity);

    awards.push({
      id: `award-${quotationItem.id}-${responseItem.id}`,
      tenantId: quotationItem.tenantId,
      quotationId: quotationItem.quotationId,
      quotationItemId: quotationItem.id,
      supplierResponseItemId: responseItem.id,
      supplierId: responseItem.supplierId,
      supplierName:
        responses.find((response) => response.id === responseItem.responseId)
          ?.sellerName ??
        responses.find((response) => response.id === responseItem.responseId)
          ?.sellerCompany ??
        responses.find((response) => response.supplierId === responseItem.supplierId)
          ?.sellerName ??
        responses.find((response) => response.supplierId === responseItem.supplierId)
          ?.sellerCompany ??
        "Fornecedor",
      moduleType: "bidding",
      rankingPosition: responseItem.rankingPosition ?? awards.length + 1,
      awardedQuantity,
      awardedPackages,
      unitPrice: responseItem.convertedUnitPrice ?? 0,
      packagePrice,
      totalPrice,
      remainingBalanceAfter: remainingBalance,
      status: remainingBalance > 0 ? "partial" : "winner",
    });
  }

  const pendingBalance =
    remainingBalance > 0
      ? ({
          id: `pending-${quotationItem.id}`,
          tenantId: quotationItem.tenantId,
          quotationId: quotationItem.quotationId,
          quotationItemId: quotationItem.id,
          productName: quotationItem.productName,
          requestedQuantity: quotationItem.requestedQuantity,
          suppliedQuantity: quotationItem.requestedQuantity - remainingBalance,
          pendingQuantity: remainingBalance,
          unit: quotationItem.requestedUnit,
          status: "pending",
        } satisfies PendingBalance)
      : null;

  const status =
    remainingBalance <= 0
      ? "atendido_total"
      : awards.length > 0
        ? "atendido_parcial"
        : "nao_atendido";

  return { awards, pendingBalance, status };
}

export function buildBiddingAnalysis(
  quotationItems: QuotationItem[],
  responseItems: SupplierQuoteResponseItem[],
  responses: SupplierQuoteResponse[],
): BiddingAnalysisResult {
  const ranking = quotationItems.flatMap((item) =>
    calculateBiddingResponseItems(item, responseItems),
  );
  const awards: QuotationAward[] = [];
  const pendingBalances: PendingBalance[] = [];

  for (const item of quotationItems) {
    const result = generateBiddingAwards(item, responseItems, responses);
    awards.push(...result.awards);
    if (result.pendingBalance) pendingBalances.push(result.pendingBalance);
  }

  const totalItems = quotationItems.length;
  const answeredItems = new Set(ranking.map((item) => item.quotationItemId)).size;
  const fullySuppliedItems = totalItems - pendingBalances.length;
  const estimatedTotal = roundMoney(
    awards.reduce((total, award) => total + award.totalPrice, 0),
  );
  const averageUnitPrice =
    ranking.length > 0
      ? roundMoney(
          ranking.reduce((total, item) => total + (item.convertedUnitPrice ?? 0), 0) /
            ranking.length,
        )
      : 0;
  const alerts = ranking
    .map((item) => item.alertStatus)
    .filter((alert): alert is string => Boolean(alert));

  return {
    ranking,
    awards,
    pendingBalances,
    totals: {
      totalItems,
      answeredItems,
      fullySuppliedItems,
      pendingItems: pendingBalances.length,
      estimatedTotal,
      averageUnitPrice,
    },
    alerts,
  };
}

function isUnitCompatible(requestedUnit: string, offeredUnit: string) {
  return requestedUnit.toUpperCase() === offeredUnit.toUpperCase();
}

function buildBiddingAlert(
  quotationItem: QuotationItem,
  responseItem: SupplierQuoteResponseItem,
  calculated: BiddingCalculationResult,
) {
  if (
    quotationItem.laboratoryRequired &&
    quotationItem.requestedLaboratory &&
    responseItem.offeredLaboratory?.toLowerCase() !==
      quotationItem.requestedLaboratory.toLowerCase()
  ) {
    return "Laboratório obrigatório divergente";
  }

  if (calculated.quantityShortage > 0) {
    return "Atendimento parcial";
  }

  if (calculated.technicalSurplus > 0) {
    return "Sobra técnica";
  }

  return undefined;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
