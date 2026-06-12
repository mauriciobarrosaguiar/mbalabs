import { parseCurrencyBRToNumber, parseCurrencyInput } from "@/modules/cotacoes/lib/formatters";
import type { ModuleType, QuotationItem } from "@/modules/cotacoes/lib/types";

export type StockAnswer = "sim" | "nao";

export interface SellerResponseRowDraft {
  quotationItemId: string;
  offeredProductName?: string;
  offeredLaboratory?: string;
  grossPrice?: string;
  extraDiscount?: string;
  netPrice?: string;
  attendedQuantity?: string;
  deliveryText?: string;
  observation?: string;
  hasStock?: StockAnswer;
  offeredUnit?: string;
  packageQuantity?: string;
  packageQuantityOther?: string;
  packagePrice?: string;
  hasFullQuantity?: StockAnswer;
}

export interface SellerRowCalculation {
  grossPrice: number;
  extraDiscount: number;
  netPrice: number;
  attendedQuantity: number;
  itemTotal: number;
  convertedUnitPrice: number;
  packagesToBuy: number;
  quantityShortage: number;
  status: "respondido" | "sem_resposta" | "parcial" | "sem_estoque";
}

export interface SellerResponseSummary {
  totalAmount: number;
  respondedItems: number;
  totalItems: number;
  missingItems: number;
  partialItems: number;
  outOfStockItems: number;
}

export function parseNumberInput(value: string | number | null | undefined) {
  return parseCurrencyInput(value);
}

export function calculateNetPrice({
  grossPrice,
  extraDiscount,
  manualNetPrice,
}: {
  grossPrice?: string | number | null;
  extraDiscount?: string | number | null;
  manualNetPrice?: string | number | null;
}) {
  const manualHasValue =
    manualNetPrice !== undefined &&
    manualNetPrice !== null &&
    String(manualNetPrice).trim() !== "";

  if (manualHasValue) return Math.max(0, parseCurrencyBRToNumber(manualNetPrice));

  const gross = parseCurrencyInput(grossPrice);
  const extraRaw = String(extraDiscount ?? "").trim();
  if (!extraRaw) return gross;

  const extra = parseCurrencyInput(extraRaw);
  const discount = extraRaw.includes("%") ? gross * (extra / 100) : extra;
  return Math.max(0, gross - discount);
}

export function calculateItemTotal(unitPrice: number, quantity: number) {
  return Math.max(0, unitPrice) * Math.max(0, quantity);
}

export function getPackageQuantity(row: SellerResponseRowDraft) {
  const selected = row.packageQuantity === "outro" ? row.packageQuantityOther : row.packageQuantity;
  const parsed = parseNumberInput(selected);
  return parsed > 0 ? parsed : 0;
}

export function calculateSellerRow(
  moduleType: ModuleType,
  item: QuotationItem,
  row: SellerResponseRowDraft,
): SellerRowCalculation {
  if (moduleType === "bidding") {
    const packageQuantity = getPackageQuantity(row);
    const packagePrice = parseCurrencyInput(row.packagePrice ?? row.grossPrice);
    const convertedUnitPrice = packageQuantity > 0 ? packagePrice / packageQuantity : 0;
    const hasFullQuantity = row.hasFullQuantity !== "nao";
    const attendedQuantity = hasFullQuantity
      ? item.requestedQuantity
      : parseNumberInput(row.attendedQuantity);
    const packagesToBuy =
      packageQuantity > 0 && attendedQuantity > 0
        ? Math.ceil(attendedQuantity / packageQuantity)
        : 0;
    const itemTotal = packagesToBuy * packagePrice;
    const quantityShortage = Math.max(item.requestedQuantity - attendedQuantity, 0);

    return {
      grossPrice: packagePrice,
      extraDiscount: 0,
      netPrice: convertedUnitPrice,
      attendedQuantity,
      itemTotal,
      convertedUnitPrice,
      packagesToBuy,
      quantityShortage,
      status: resolveStatus(convertedUnitPrice, attendedQuantity, item.requestedQuantity, hasFullQuantity),
    };
  }

  const grossPrice = parseCurrencyInput(row.grossPrice);
  const extraDiscount = parseCurrencyInput(row.extraDiscount);
  const netPrice = calculateNetPrice({
    grossPrice: row.grossPrice,
    extraDiscount: row.extraDiscount,
    manualNetPrice: row.netPrice,
  });
  const attendedQuantity = netPrice > 0 ? item.requestedQuantity : 0;
  const itemTotal = calculateItemTotal(netPrice, attendedQuantity);

  return {
    grossPrice,
    extraDiscount,
    netPrice,
    attendedQuantity,
    itemTotal,
    convertedUnitPrice: netPrice,
    packagesToBuy: attendedQuantity > 0 ? Math.ceil(attendedQuantity) : 0,
    quantityShortage: Math.max(item.requestedQuantity - attendedQuantity, 0),
    status: netPrice > 0 ? "respondido" : "sem_resposta",
  };
}

export function calculateResponseSummary(
  moduleType: ModuleType,
  items: QuotationItem[],
  rows: SellerResponseRowDraft[],
): SellerResponseSummary {
  return items.reduce<SellerResponseSummary>(
    (summary, item) => {
      const row = rows.find((candidate) => candidate.quotationItemId === item.id);
      const calculation = row
        ? calculateSellerRow(moduleType, item, row)
        : undefined;

      if (!calculation || calculation.status === "sem_resposta") {
        summary.missingItems += 1;
        return summary;
      }

      summary.respondedItems += 1;
      summary.totalAmount += calculation.itemTotal;
      if (calculation.status === "parcial") summary.partialItems += 1;
      if (calculation.status === "sem_estoque") summary.outOfStockItems += 1;
      return summary;
    },
    {
      totalAmount: 0,
      respondedItems: 0,
      totalItems: items.length,
      missingItems: 0,
      partialItems: 0,
      outOfStockItems: 0,
    },
  );
}

export function validateSellerResponse({
  moduleType,
  items,
  rows,
}: {
  moduleType: ModuleType;
  items: QuotationItem[];
  rows: SellerResponseRowDraft[];
}) {
  const errors: string[] = [];
  const respondedRows = rows.filter((row) => {
    const item = items.find((candidate) => candidate.id === row.quotationItemId);
    return item ? calculateSellerRow(moduleType, item, row).status !== "sem_resposta" : false;
  });

  if (moduleType === "bidding" && respondedRows.length === 0) {
    errors.push("Responda pelo menos um item antes de enviar a cotação.");
  }

  if (moduleType === "pharmacy") {
    const validPriceRows = rows.filter((row) => {
      const item = items.find((candidate) => candidate.id === row.quotationItemId);
      return item ? calculateSellerRow(moduleType, item, row).netPrice > 0 : false;
    });

    if (validPriceRows.length === 0) {
      errors.push("Informe o preço de pelo menos um item para enviar a resposta.");
    }

    return errors;
  }

  for (const row of rows) {
    const item = items.find((candidate) => candidate.id === row.quotationItemId);
    if (!item) continue;

    const calculation = calculateSellerRow(moduleType, item, row);
    const touched = isRowTouched(row);

    if (!touched || calculation.status === "sem_resposta") continue;

    if (calculation.grossPrice < 0 || calculation.netPrice < 0) {
      errors.push(`${item.productName}: preço não pode ser negativo.`);
    }

    if (moduleType === "bidding" && calculation.attendedQuantity < 0) {
      errors.push(`${item.productName}: quantidade atendida não pode ser negativa.`);
    }

    if (moduleType === "bidding" && calculation.attendedQuantity > item.requestedQuantity) {
      errors.push(`${item.productName}: quantidade atendida não pode ser maior que a quantidade pedida.`);
    }

    if (moduleType === "bidding" && calculation.status !== "sem_estoque") {
      if (calculation.netPrice <= 0) {
        errors.push(`${item.productName}: informe o preço líquido/final.`);
      }

      if (calculation.attendedQuantity <= 0) {
        errors.push(`${item.productName}: informe uma quantidade atendida maior que zero.`);
      }
    }

    if (moduleType === "bidding") {
      if (getPackageQuantity(row) <= 0) {
        errors.push(`${item.productName}: informe a quantidade por embalagem.`);
      }

      if (!row.offeredUnit) {
        errors.push(`${item.productName}: informe a unidade ofertada.`);
      }
    }
  }

  return errors;
}

export function isRowTouched(row: SellerResponseRowDraft) {
  return Boolean(
    row.offeredProductName?.trim() ||
      row.offeredLaboratory?.trim() ||
      row.grossPrice?.trim() ||
      row.extraDiscount?.trim() ||
      row.netPrice?.trim() ||
      row.attendedQuantity?.trim() ||
      row.deliveryText?.trim() ||
      row.observation?.trim() ||
      row.hasStock === "nao" ||
      row.hasFullQuantity === "nao" ||
      row.packagePrice?.trim() ||
      row.packageQuantity?.trim() ||
      row.packageQuantityOther?.trim(),
  );
}

function resolveStatus(
  netPrice: number,
  attendedQuantity: number,
  requestedQuantity: number,
  hasStock: boolean,
): SellerRowCalculation["status"] {
  if (!hasStock && attendedQuantity <= 0) return "sem_estoque";
  if (netPrice <= 0 || attendedQuantity <= 0) return "sem_resposta";
  if (attendedQuantity > 0 && attendedQuantity < requestedQuantity) return "parcial";
  return "respondido";
}
