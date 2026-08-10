import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/modules/cotacoes/components/ui/card";
import { cn } from "@/modules/cotacoes/lib/utils";

const toneClasses = {
  default: "bg-[#e4f6ef] text-[#08755f]",
  success: "bg-[#e3f6ec] text-[#159261]",
  warning: "bg-[#fff1dc] text-[#9a6114]",
  danger: "bg-[#fee9e7] text-[#c23e35]",
  info: "bg-[#e7f2f8] text-[#2b80aa]",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: keyof typeof toneClasses;
  icon?: LucideIcon;
}) {
  return (
    <Card className="group relative overflow-hidden border-[#dce7e2] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,63,49,0.08)]">
      <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[#008970] transition-transform duration-200 group-hover:scale-x-100" />
      <CardContent className="flex min-h-[144px] items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#657a72]">{label}</p>
          <p className="mt-4 truncate text-[2rem] font-semibold leading-none tracking-[-0.035em] text-[#10251f] tabular-nums">
            {value}
          </p>
          <p className="mt-3 text-xs leading-5 text-[#73867f]">{hint}</p>
        </div>
        {Icon ? (
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", toneClasses[tone])}>
            <Icon className="size-[1.05rem]" />
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
