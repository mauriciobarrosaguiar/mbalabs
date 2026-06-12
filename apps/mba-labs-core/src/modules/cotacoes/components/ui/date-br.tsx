import { formatDateBR } from "@/modules/cotacoes/lib/formatters";

export function DateBR({ value }: { value?: string | null }) {
  return <span>{formatDateBR(value)}</span>;
}
