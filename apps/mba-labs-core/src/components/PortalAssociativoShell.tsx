import Link from "next/link";
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
  Repeat,
  Settings,
  ShieldCheck,
  Users
} from "lucide-react";

type PortalNavItem = {
  href: string;
  label: string;
  section: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: PortalNavItem[] = [
  { href: "/portal-associativo", label: "Dashboard", section: "dashboard", icon: LayoutDashboard },
  { href: "/portal-associativo/pessoas", label: "Pessoas", section: "pessoas", icon: Users },
  { href: "/portal-associativo/unidades", label: "Unidades", section: "unidades", icon: Home },
  { href: "/portal-associativo/transferencias", label: "Transferencias", section: "transferencias", icon: Repeat },
  { href: "/portal-associativo/financeiro", label: "Financeiro", section: "financeiro", icon: Banknote },
  { href: "/portal-associativo/relatorios", label: "Relatorios", section: "relatorios", icon: FileText },
  { href: "/portal-associativo/reunioes", label: "Reunioes", section: "reunioes", icon: ClipboardList },
  { href: "/portal-associativo/avisos", label: "Avisos", section: "avisos", icon: Bell },
  { href: "/portal-associativo/projetos", label: "Projetos", section: "projetos", icon: FolderKanban },
  { href: "/portal-associativo/painel-associado", label: "Painel", section: "painel", icon: ShieldCheck },
  { href: "/portal-associativo/configuracoes", label: "Configuracoes", section: "configuracoes", icon: Settings }
];

export function PortalAssociativoShell({
  children,
  activePath,
  companyName,
  userName,
  roleLabel,
  can
}: {
  children: React.ReactNode;
  activePath: string;
  companyName: string;
  userName?: string;
  roleLabel?: string;
  can: (section: string) => boolean;
}) {
  const visibleItems = navItems.filter((item) => can(item.section));

  return (
    <div className="portal-associativo-module min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden h-screen w-72 flex-col border-r border-border bg-card px-4 py-5 lg:flex">
        <Link className="block shrink-0" href="/portal-associativo">
          <div className="text-xl font-bold tracking-tight text-primary">Portal Associativo</div>
          <div className="mt-1 truncate text-sm text-muted-foreground" title={companyName}>{companyName}</div>
        </Link>

        <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pb-4 pr-1">
          {visibleItems.map((item) => (
            <PortalNavLink activePath={activePath} item={item} key={item.href} />
          ))}
        </nav>

        <div className="mt-auto shrink-0 overflow-hidden rounded-lg border border-border bg-muted/50 p-3">
          {userName ? <p className="truncate text-sm font-semibold" title={userName}>{userName}</p> : null}
          {roleLabel ? <p className="truncate text-xs text-muted-foreground" title={roleLabel}>{roleLabel}</p> : null}
          <Link className="mt-3 flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold shadow-sm" href="/dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Voltar ao MBA Labs
          </Link>
          <form action="/sair" className="mt-2" method="post">
            <button className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold shadow-sm">
              <LogOut className="h-4 w-4" aria-hidden />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/portal-associativo">
            <div className="font-bold text-primary">Portal Associativo</div>
            <div className="max-w-[14rem] truncate text-xs text-muted-foreground">{companyName}</div>
          </Link>
          <Link className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold" href="/dashboard">
            MBA Labs
          </Link>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {visibleItems.map((item) => (
            <PortalNavLink activePath={activePath} item={item} key={`${item.href}-mobile`} mobile />
          ))}
        </nav>
      </header>

      <main className="px-4 py-6 lg:ml-72 lg:px-8">
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
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-muted px-3 text-sm font-semibold aria-[current=page]:bg-[#e8f1ff] aria-[current=page]:text-[#1d4ed8]"
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
      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition hover:bg-muted aria-[current=page]:bg-[#e8f1ff] aria-[current=page]:text-[#1d4ed8]"
      href={item.href}
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      {item.label}
    </Link>
  );
}
