import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { cn } from "@/modules/cotacoes/lib/utils";

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  group?: string;
}

export function Sidebar({
  items,
  currentPath,
  footer,
}: {
  items: SidebarNavItem[];
  currentPath: string;
  footer?: React.ReactNode;
}) {
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      {groupItems(items).map(([group, groupItems]) => (
        <div key={group} className="space-y-1">
          {group !== "principal" ? (
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
          ) : null}
          {groupItems.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(currentPath, item.href)}
            />
          ))}
        </div>
      ))}
      {footer}
    </nav>
  );
}

export function SidebarLink({
  item,
  active,
}: {
  item: SidebarNavItem;
  active: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      href={item.href}
      className={cn(
        "flex min-h-10 items-center justify-between rounded-md px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950",
        active && "bg-teal-50 text-teal-800",
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </span>
      {item.badge ? <Badge variant="secondary">{item.badge}</Badge> : null}
    </Link>
  );
}

function isActive(currentPath: string, href: string) {
  if (href === "/admin") return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function groupItems(items: SidebarNavItem[]) {
  const groups = new Map<string, SidebarNavItem[]>();
  for (const item of items) {
    const group = item.group ?? "principal";
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  return Array.from(groups.entries());
}
