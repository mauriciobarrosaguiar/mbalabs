import { Badge } from "@/components/ui/badge";
import { getRuntimeLabel } from "@/lib/runtime-mode";

export function ModeBadge() {
  const label = getRuntimeLabel();

  if (!label) return null;

  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
      {label}
    </Badge>
  );
}
