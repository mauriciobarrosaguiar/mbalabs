import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { quotationStatusLabels, statusLabels } from "@/modules/cotacoes/lib/labels";
import { cn } from "@/modules/cotacoes/lib/utils";

const statusMap: Record<string, { label: string; className: string }> = {
  ativo: { label: statusLabels.ativo, className: "bg-emerald-50 text-emerald-700" },
  active: { label: statusLabels.active, className: "bg-emerald-50 text-emerald-700" },
  teste: { label: statusLabels.teste, className: "bg-blue-50 text-blue-700" },
  test: { label: statusLabels.test, className: "bg-blue-50 text-blue-700" },
  suspenso: { label: statusLabels.suspenso, className: "bg-amber-50 text-amber-700" },
  suspended: { label: statusLabels.suspended, className: "bg-amber-50 text-amber-700" },
  cancelado: { label: statusLabels.cancelado, className: "bg-red-50 text-red-700" },
  canceled: { label: statusLabels.canceled, className: "bg-red-50 text-red-700" },
  inativo: { label: statusLabels.inativo, className: "bg-slate-100 text-slate-700" },
  inactive: { label: statusLabels.inactive, className: "bg-slate-100 text-slate-700" },
  draft: { label: quotationStatusLabels.draft, className: "bg-slate-100 text-slate-700" },
  open: { label: quotationStatusLabels.open, className: "bg-blue-50 text-blue-700" },
  waiting_responses: {
    label: quotationStatusLabels.waiting_responses,
    className: "bg-amber-50 text-amber-700",
  },
  analyzing: { label: quotationStatusLabels.analyzing, className: "bg-cyan-50 text-cyan-700" },
  finished: { label: quotationStatusLabels.finished, className: "bg-emerald-50 text-emerald-700" },
  generated: { label: quotationStatusLabels.generated, className: "bg-blue-50 text-blue-700" },
  gerado: { label: quotationStatusLabels.gerado, className: "bg-blue-50 text-blue-700" },
  pedido_gerado: { label: quotationStatusLabels.pedido_gerado, className: "bg-blue-50 text-blue-700" },
  excluida: { label: quotationStatusLabels.excluida, className: "bg-red-50 text-red-700" },
  deleted: { label: quotationStatusLabels.deleted, className: "bg-red-50 text-red-700" },
  pending: { label: statusLabels.pending, className: "bg-amber-50 text-amber-700" },
  paid: { label: "Pedido digitado", className: "bg-emerald-50 text-emerald-700" },
  faturado: { label: "Pedido digitado", className: "bg-emerald-50 text-emerald-700" },
  confirmed: { label: "Pedido digitado", className: "bg-emerald-50 text-emerald-700" },
  overdue: { label: statusLabels.overdue, className: "bg-red-50 text-red-700" },
  submitted: { label: statusLabels.submitted, className: "bg-emerald-50 text-emerald-700" },
  opened: { label: statusLabels.opened, className: "bg-blue-50 text-blue-700" },
  winner: { label: statusLabels.winner, className: "bg-emerald-50 text-emerald-700" },
  partial: { label: "Pedido parcial", className: "bg-amber-50 text-amber-700" },
  enviado: { label: statusLabels.enviado, className: "bg-blue-50 text-blue-700" },
  enviado_ao_vendedor: { label: statusLabels.enviado_ao_vendedor, className: "bg-blue-50 text-blue-700" },
  aberto_pelo_vendedor: { label: statusLabels.aberto_pelo_vendedor, className: "bg-cyan-50 text-cyan-700" },
  em_conferencia: { label: statusLabels.em_conferencia, className: "bg-amber-50 text-amber-700" },
  finalizado_pelo_vendedor: { label: "Pedido digitado", className: "bg-emerald-50 text-emerald-700" },
  parcialmente_faturado: { label: "Pedido parcial", className: "bg-amber-50 text-amber-700" },
  nao_faturado: { label: "Não digitado", className: "bg-red-50 text-red-700" },
  falta_parcial: { label: "Pedido parcial", className: "bg-amber-50 text-amber-700" },
  atendido_total: { label: statusLabels.atendido_total, className: "bg-emerald-50 text-emerald-700" },
  atendido_parcial: { label: statusLabels.atendido_parcial, className: "bg-amber-50 text-amber-700" },
  nao_atendido: { label: statusLabels.nao_atendido, className: "bg-red-50 text-red-700" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const config = statusMap[status] ?? {
    label: label ?? status,
    className: "bg-slate-100 text-slate-700",
  };

  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-auto min-h-5 max-w-full overflow-visible whitespace-normal rounded-md border border-transparent px-2 py-1 text-left leading-tight font-medium",
        config.className,
        className,
      )}
    >
      {label ?? config.label}
    </Badge>
  );
}
