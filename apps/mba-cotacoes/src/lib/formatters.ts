import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export const integerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

export function formatCurrency(value?: number | null) {
  return brlFormatter.format(value ?? 0);
}

export function formatCurrencyBRL(value?: number | null) {
  return formatCurrency(value);
}

export function formatCurrencyBRInput(value: string | number | null | undefined) {
  const raw = String(value ?? "");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  const cents = Number.parseInt(digits, 10);
  if (!Number.isFinite(cents)) return "";

  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseCurrencyBRToNumber(value: string | number | null | undefined) {
  return parseCurrencyInput(value);
}

export function formatCurrencyBRFromNumber(value?: number | null) {
  return (value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNumber(value?: number | null) {
  return numberFormatter.format(value ?? 0);
}

export function formatNumberBR(value?: number | null) {
  return formatNumber(value);
}

export function formatInteger(value?: number | null) {
  return integerFormatter.format(value ?? 0);
}

export function formatPercent(value?: number | null) {
  return `${numberFormatter.format(value ?? 0)}%`;
}

export function formatPercentBR(value?: number | null) {
  return formatPercent(value);
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
}

export function formatDateBR(value?: string | null) {
  return formatDate(value);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function parseCurrencyInput(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  if (!raw) return 0;

  const cleaned = raw
    .replace(/[R$\s]/gi, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/(?!^)-/g, "");
  if (!/\d/.test(cleaned)) return 0;

  const isNegative = cleaned.startsWith("-");
  const unsigned = isNegative ? cleaned.slice(1) : cleaned;
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  const decimalSeparator = resolveDecimalSeparator(unsigned, lastComma, lastDot);
  const normalized = decimalSeparator
    ? normalizeDecimalCurrency(unsigned, decimalSeparator)
    : unsigned.replace(/[,.]/g, "");
  const parsed = Number(`${isNegative ? "-" : ""}${normalized}`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveDecimalSeparator(value: string, lastComma: number, lastDot: number): "," | "." | "" {
  if (lastComma >= 0 && lastDot >= 0) return lastComma > lastDot ? "," : ".";
  const separator = lastComma >= 0 ? "," : lastDot >= 0 ? "." : "";
  if (!separator) return "";

  const index = value.lastIndexOf(separator);
  const fraction = value.slice(index + 1);
  if (fraction.length === 0) return "";
  if (fraction.length <= 2) return separator;
  return "";
}

function normalizeDecimalCurrency(value: string, decimalSeparator: "," | ".") {
  const index = value.lastIndexOf(decimalSeparator);
  const integerPart = value.slice(0, index).replace(/[,.]/g, "") || "0";
  const fractionPart = value.slice(index + 1).replace(/[,.]/g, "");
  return `${integerPart}.${fractionPart}`;
}
