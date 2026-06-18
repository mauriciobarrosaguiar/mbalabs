"use client";

import Link from "next/link";
import { useState } from "react";

export type DashboardListRow = {
  href: string;
  label: string;
  meta: string;
  note?: string;
};

type DashboardListCardProps = {
  title: string;
  empty: string;
  rows: DashboardListRow[];
  maxMobile?: number;
};

export function DashboardListCard({
  title,
  empty,
  rows,
  maxMobile = 3,
}: DashboardListCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasExtraRows = rows.length > maxMobile;

  return (
    <section className={`card stack dashboard-list-card${expanded ? " expanded" : ""}`}>
      <div className="section-title">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="stack compact-stack">
          {rows.map((row, index) => (
            <Link
              className={`list-row${index >= maxMobile ? " mobile-extra-row" : ""}`}
              href={row.href}
              key={`${row.href}-${row.label}`}
            >
              <strong>{row.label}</strong>
              <span>{row.meta}</span>
              {row.note ? <small>{row.note}</small> : null}
            </Link>
          ))}
        </div>
      )}
      {hasExtraRows ? (
        <button
          className="button secondary mobile-list-toggle"
          type="button"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      ) : null}
    </section>
  );
}
