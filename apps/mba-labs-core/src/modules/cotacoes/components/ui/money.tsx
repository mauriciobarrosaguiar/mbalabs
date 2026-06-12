import { formatCurrencyBRL } from "@/modules/cotacoes/lib/formatters";

export function Money({ value }: { value?: number | null }) {
  return <span>{formatCurrencyBRL(value)}</span>;
}
