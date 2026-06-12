import { formatDateBR } from "@/lib/formatters";

export function DateBR({ value }: { value?: string | null }) {
  return <span>{formatDateBR(value)}</span>;
}
