import {
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  FileText,
  Scale,
  UsersRound,
} from "lucide-react";
import type { LexDashboardMetric } from "@/lib/lexgestor/data";

const iconByIndex = [
  UsersRound,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  FileCheck2,
  CalendarClock,
  Scale,
  FileCheck2,
];

export function DashboardCards({ metrics }: { metrics: LexDashboardMetric[] }) {
  return (
    <section className="grid" aria-label="Indicadores do dashboard">
      {metrics.map((card, index) => {
        const Icon = iconByIndex[index] ?? BriefcaseBusiness;

        return (
          <article className="stat-card" key={card.label}>
            <Icon size={22} color="var(--primary)" aria-hidden />
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.note}</small>
          </article>
        );
      })}
    </section>
  );
}
