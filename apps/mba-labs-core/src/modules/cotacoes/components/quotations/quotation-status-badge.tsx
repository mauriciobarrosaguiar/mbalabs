import { StatusBadge } from "@/modules/cotacoes/components/ui/status-badge";
import { labelFrom, quotationStatusLabels } from "@/modules/cotacoes/lib/labels";
import type { QuotationStatus } from "@/modules/cotacoes/lib/types";

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return <StatusBadge status={status} label={labelFrom(quotationStatusLabels, status)} />;
}
