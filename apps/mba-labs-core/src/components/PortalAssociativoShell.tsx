import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowLeft,
  Banknote,
  Bell,
  ClipboardList,
  FileText,
  FolderKanban,
  Home,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  MoreHorizontal,
  Repeat,
  Settings,
  ShieldCheck,
  Users
} from "lucide-react";

type PortalNavItem = {
  href: string;
  label: string;
  section: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: PortalNavItem[] = [
  { href: "/portal-associativo", label: "Dashboard", section: "dashboard", icon: LayoutDashboard },
  { href: "/portal-associativo/loteamentos", label: "Loteamentos", section: "loteamentos", icon: MapIcon },
  { href: "/portal-associativo/pessoas", label: "Associados", section: "pessoas", icon: Users },
  { href: "/portal-associativo/unidades", label: "Chácaras/Lotes", section: "unidades", icon: Home },
  { href: "/portal-associativo/transferencias", label: "Transferências", section: "transferencias", icon: Repeat },
  { href: "/portal-associativo/financeiro", label: "Mensalidades", section: "financeiro", icon: Banknote },
  { href: "/portal-associativo/relatorios", label: "Relatórios", section: "relatorios", icon: FileText },
  { href: "/portal-associativo/reunioes", label: "Reuniões", section: "reunioes", icon: ClipboardList },
  { href: "/portal-associativo/avisos", label: "Avisos", section: "avisos", icon: Bell },
  { href: "/portal-associativo/projetos", label: "Projetos", section: "projetos", icon: FolderKanban },
  { href: "/portal-associativo/painel-associado", label: "Painel", section: "painel", icon: ShieldCheck },
  { href: "/portal-associativo/configuracoes", label: "Configurações", section: "configuracoes", icon: Settings }
];

export function PortalAssociativoShell({
  children,
  activePath,
  companyName,
  userName,
  roleLabel,
  can
}: {
  children: ReactNode;
  activePath: string;
  companyName: string;
  userName?: string;
  roleLabel?: string;
  can: (section: string) => boolean;
}) {
  const visibleItems = navItems.filter((item) => can(item.section));

  return (
    <div className="portal-associativo-module min-h-screen bg-background text-foreground">
      <header className="portal-shell-top sticky top-0 z-20 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="relative mx-auto flex max-w-7xl items-center gap-4">
          <Link className="min-w-0 shrink-0" href="/portal-associativo">
            <div className="text-lg font-bold tracking-tight text-primary sm:text-xl">Portal Associativo</div>
            <div className="max-w-[12rem] truncate text-xs text-muted-foreground sm:max-w-[16rem]" title={companyName}>
              {companyName}
            </div>
          </Link>

          <nav className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-2 lg:flex" aria-label="Menu principal do Portal Associativo">
            {visibleItems.map((item) => (
              <PortalNavLink activePath={activePath} item={item} key={item.href} />
            ))}
          </nav>

          <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
            <div className="max-w-[12rem] text-right">
              {userName ? <p className="truncate text-sm font-semibold" title={userName}>{userName}</p> : null}
              {roleLabel ? <p className="truncate text-xs text-muted-foreground" title={roleLabel}>{roleLabel}</p> : null}
            </div>
            <Link className="portal-icon-button" href="/dashboard" title="Voltar ao MBA Labs">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              <span className="sr-only">Voltar ao MBA Labs</span>
            </Link>
            <form action="/sair" method="post">
              <button className="portal-icon-button" title="Sair" type="submit">
                <LogOut className="h-4 w-4" aria-hidden />
                <span className="sr-only">Sair</span>
              </button>
            </form>
          </div>

          <details className="portal-mobile-menu ml-auto lg:hidden">
            <summary className="portal-menu-trigger" aria-label="Abrir menu">
              <MoreHorizontal className="h-5 w-5" aria-hidden />
              <span className="sr-only">Abrir menu</span>
            </summary>
            <div className="portal-mobile-panel">
              <div className="border-b border-border px-3 py-3">
                {userName ? <p className="truncate text-sm font-semibold" title={userName}>{userName}</p> : null}
                {roleLabel ? <p className="truncate text-xs text-muted-foreground" title={roleLabel}>{roleLabel}</p> : null}
              </div>
              <nav className="grid gap-1 p-2" aria-label="Menu mobile do Portal Associativo">
                {visibleItems.map((item) => (
                  <PortalNavLink activePath={activePath} item={item} key={`${item.href}-mobile`} mobile />
                ))}
              </nav>
              <div className="grid gap-2 border-t border-border p-3">
                <Link className="button-secondary flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold" href="/dashboard">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Voltar ao MBA Labs
                </Link>
                <form action="/sair" method="post">
                  <button className="button-secondary flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold" type="submit">
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sair
                  </button>
                </form>
              </div>
            </div>
          </details>
        </div>
      </header>

      <main className="px-4 py-6 pb-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

function PortalNavLink({
  item,
  activePath,
  mobile = false
}: {
  item: PortalNavItem;
  activePath: string;
  mobile?: boolean;
}) {
  const Icon = item.icon;
  const active = item.href === "/portal-associativo" ? activePath === item.href : activePath.startsWith(item.href);

  if (mobile) {
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className="portal-mobile-nav-link flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition"
        href={item.href}
      >
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className="portal-nav-link inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition"
      href={item.href}
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      {item.label}
    </Link>
  );
}
