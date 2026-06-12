import { formatCurrencyBRL } from "@/lib/formatters";

export function Money({ value }: { value?: number | null }) {
  return <span>{formatCurrencyBRL(value)}</span>;
}
