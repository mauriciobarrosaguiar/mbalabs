import type { UnitDefinition } from "./types";
import {
  productTypeLabels as sharedProductTypeLabels,
  quotationStatusLabels as sharedQuotationStatusLabels,
  statusLabels,
  unitLabels,
} from "./labels";

export const unitTypes: UnitDefinition[] = [
  { code: "CP", name: "Comprimido", plural: "Comprimidos" },
  { code: "CAP", name: "Cápsula", plural: "Cápsulas" },
  { code: "AMP", name: "Ampola", plural: "Ampolas" },
  { code: "FR", name: "Frasco", plural: "Frascos" },
  { code: "BIS", name: "Bisnaga", plural: "Bisnagas" },
  { code: "SACHE", name: "Sachê", plural: "Sachês" },
  { code: "FLAC", name: "Flaconete", plural: "Flaconetes" },
  { code: "ML", name: "Mililitro", plural: "Mililitros" },
  { code: "G", name: "Grama", plural: "Gramas" },
  { code: "KG", name: "Quilograma", plural: "Quilogramas" },
  { code: "DOSE", name: "Dose", plural: "Doses" },
  { code: "UN", name: "Unidade", plural: "Unidades" },
  { code: "CX", name: "Caixa", plural: "Caixas" },
];

export const packageQuantityOptions = [
  1, 2, 3, 4, 5, 6, 7, 10, 12, 14, 15, 20, 21, 28, 30, 45, 50, 60, 90, 100,
  120, 200, 500, 1000,
];

export const productTypeLabels: Record<string, string> = sharedProductTypeLabels;

export const quotationStatusLabels: Record<string, string> = sharedQuotationStatusLabels;

export const paymentStatusLabels: Record<string, string> = {
  pending: statusLabels.pending,
  paid: statusLabels.paid,
  overdue: statusLabels.overdue,
  canceled: statusLabels.canceled,
  refunded: statusLabels.refunded,
};

export function getUnitLabel(code?: string) {
  if (!code) return "Unidade";
  return unitTypes.find((unit) => unit.code === code)?.name ?? unitLabels[code] ?? code;
}
