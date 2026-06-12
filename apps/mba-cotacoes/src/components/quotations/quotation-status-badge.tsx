import { StatusBadge } from "@/components/ui/status-badge";
import { labelFrom, quotationStatusLabels } from "@/lib/labels";
import type { QuotationStatus } from "@/lib/types";

export function QuotationStatusBadge({ status }: { status: QuotationStatus }) {
  return <StatusBadge status={status} label={labelFrom(quotationStatusLabels, status)} />;
}
