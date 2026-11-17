"use client";
import { AgroDocDroneIcon as Drone } from "./AgroDocDroneIcon";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import {
  type LucideIcon,
  ChevronRight,
  Layers,
  ClipboardCheck,
  FileCheck,
  Search,
  FileDown,
} from "lucide-react";
export const ROOT = "/apps/dronegestor";
export function AgroDocHero({
  title,
  description,
  large = false,
}: {
  title: ReactNode;
  description: string;
  large?: boolean;
}) {
  return (
    <section className={`agro-hero ${large ? "agro-hero-large" : ""}`}>
      <div>
        <h1>
          <Drone aria-hidden="true" />
          {title}
        </h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
export function AgroDocCard({
  title,
  icon: Icon = Layers,
  children,
  action,
  className = "",
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`agro-card ${className}`}>
      <div className="agro-card-heading">
        <h2>
          <Icon aria-hidden="true" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
export function AgroDocKpiCard({
  title,
  value,
  note,
  icon: Icon = ClipboardCheck,
  href,
}: {
  title: string;
  value: ReactNode;
  note?: string;
  icon?: LucideIcon;
  href?: string;
}) {
  const body = (
    <>
      <span className="agro-kpi-icon">
        <Icon />
      </span>
      <span className="agro-kpi-title">{title}</span>
      <ChevronRight className="agro-kpi-arrow" size={17} />
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </>
  );
  return href ? (
    <Link href={href} className="agro-kpi">
      {body}
    </Link>
  ) : (
    <article className="agro-kpi">{body}</article>
  );
}
export function AgroDocStatus({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  return <span className={`agro-status agro-status-${tone}`}>{children}</span>;
}
export function AgroDocEmpty({
  children = "Nenhum registro encontrado.",
}: {
  children?: ReactNode;
}) {
  return <div className="agro-empty">{children}</div>;
}
export function AgroDocTable({
  head,
  children,
}: {
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="agro-table-scroll">
      <table className="agro-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export function AgroDocFlow({ compact = false }: { compact?: boolean }) {
  const steps = [
    {
      title: "Diagnóstico inicial",
      text: "Verifique sua situação, cadastros e requisitos da operação.",
      icon: ClipboardCheck,
      path: "diagnostico",
    },
    {
      title: "Regularização guiada",
      text: "Siga o passo a passo para regularizar sua operação conforme o MAPA.",
      icon: FileCheck,
      path: "diagnostico",
    },
    {
      title: "Operação em campo",
      text: "Execute e registre as aplicações com drones agrícolas.",
      icon: Drone,
      path: "campo",
    },
    {
      title: "Conferência",
      text: "Valide os dados da operação e a conformidade.",
      icon: Search,
      path: "conferencia",
    },
    {
      title: "Documentação automática",
      text: "Gere relatórios e arquivos exigidos pelo MAPA.",
      icon: FileDown,
      path: "relatorio-mensal",
    },
  ];
  return (
    <div className={`agro-flow ${compact ? "agro-flow-compact" : ""}`}>
      {steps.map(({ title, text, icon: Icon, path }) => (
        <Link key={title} href={`${ROOT}/${path}`}>
          <span>
            <Icon />
          </span>
          <b>{title}</b>
          {!compact && <small>{text}</small>}
        </Link>
      ))}
    </div>
  );
}
export async function agroGet<T>(url: string): Promise<T> {
  const r = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const p = await r.json();
  if (!r.ok) throw new Error(p.error || "Não foi possível consultar os dados.");
  return p as T;
}
export function useAgroData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    if (!url) return;
    agroGet<T>(url)
      .then((p) => {
        if (active) setData(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [url, reload]);
  return { data, error, refresh: () => setReload((v) => v + 1) };
}
export function AgroDocError({ error }: { error: string }) {
  return error ? (
    <p role="alert" className="agro-error">
      {error}
    </p>
  ) : null;
}
export function currentAgroMonth() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}`;
}
