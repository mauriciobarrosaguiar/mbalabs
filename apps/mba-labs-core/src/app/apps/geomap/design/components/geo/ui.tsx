"use client";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { FlaskConical, Clock } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ProjectStatus } from "../../lib/mock-data";

export function PageHeader({ title, subtitle, actions, icon: Icon, demo = true }: { title: string; subtitle?: string; actions?: ReactNode; icon?: LucideIcon; demo?: boolean }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-5 shrink-0 text-primary" />}
          <h1 className="geomap-page-title min-w-0 break-words font-bold tracking-tight">{title}</h1>
          {demo && <DemoBadge />}
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <span title="Dados simulados para homologação do design" className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning", className)}>
      <FlaskConical className="size-3" /> Demo
    </span>
  );
}

export function Panel({ title, action, children, className, bodyClass }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card text-card-foreground shadow-xs", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, icon: Icon, tone = "primary" }: { label: string; value: string; hint?: string; icon: LucideIcon; tone?: "primary" | "success" | "warning" | "destructive" | "info" }) {
  const tones = { primary: "bg-primary/12 text-primary", success: "bg-success/12 text-success", warning: "bg-warning/15 text-warning", destructive: "bg-destructive/12 text-destructive", info: "bg-[var(--info)]/12 text-[color:var(--info)]" };
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3.5 shadow-xs">
      <div className={cn("grid size-9 shrink-0 place-items-center rounded-md", tones[tone])}><Icon className="size-4.5" /></div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-bold leading-tight">{value}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

const statusTone: Record<string, string> = {
  "Disponível": "bg-success/12 text-success border-success/30",
  "Processando": "bg-primary/12 text-primary border-primary/30",
  "Enviando arquivos": "bg-[var(--info)]/12 text-[color:var(--info)] border-[var(--info)]/30",
  "Aguardando processamento": "bg-muted text-muted-foreground border-border",
  "Preparando servidor": "bg-[var(--info)]/12 text-[color:var(--info)] border-[var(--info)]/30",
  "Falhou": "bg-destructive/12 text-destructive border-destructive/30",
  "Arquivos expirados": "bg-muted text-muted-foreground border-border line-through",
  "Operacional": "bg-success/12 text-success border-success/30",
  "Em manutenção": "bg-warning/15 text-warning border-warning/30",
  "Inativo": "bg-muted text-muted-foreground border-border",
  "Ocupado": "bg-primary/12 text-primary border-primary/30",
  "Ocioso": "bg-success/12 text-success border-success/30",
  "Inicializando": "bg-[var(--info)]/12 text-[color:var(--info)] border-[var(--info)]/30",
  "Desligado": "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status }: { status: ProjectStatus | string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", statusTone[status] ?? "bg-muted text-muted-foreground")}>{status}</span>;
}

export function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (days <= 0) return <span className="text-xs text-muted-foreground">Expirado</span>;
  const tone = days <= 2 ? "text-destructive bg-destructive/10" : days <= 4 ? "text-warning bg-warning/12" : "text-success bg-success/10";
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold", tone)}>
      <Clock className="size-3" /> {days} {days === 1 ? "dia" : "dias"}
    </span>
  );
}

export function Bar({ value, tone = "primary", className }: { value: number; tone?: "primary" | "success" | "warning" | "destructive" | "info"; className?: string }) {
  const tones = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", destructive: "bg-destructive", info: "bg-[var(--info)]" };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-all", tones[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function ExpiryNotice({ days }: { days: number }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <Clock className="mt-0.5 size-4 shrink-0 text-warning" />
      <p><strong>Política de 7 dias:</strong> os arquivos ficam disponíveis por sete dias após a conclusão e são excluídos automaticamente. Restam <strong>{days} {days === 1 ? "dia" : "dias"}</strong> para baixar.</p>
    </div>
  );
}