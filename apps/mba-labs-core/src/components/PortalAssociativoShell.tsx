import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowLeft,
  Banknote,
  Bell,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderOpen,
  FolderKanban,
  Home,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Repeat,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X
} from "lucide-react";
import styles from "@/app/portal-associativo/portal-shell.module.css";

type PortalNavItem = {
  href: string;
  label: string;
  section: string;
  icon: ComponentType<{ className?: string }>;
};

const navItems: PortalNavItem[] = [
  { href: "/portal-associativo", label: "Dashboard", section: "dashboard", icon: LayoutDashboard },
  { href: "/portal-associativo/implantacao", label: "Implantação", section: "implantacao", icon: ClipboardCheck },
  { href: "/portal-associativo/loteamentos", label: "Loteamentos", section: "loteamentos", icon: MapIcon },
  { href: "/portal-associativo/pessoas", label: "Associados", section: "pessoas", icon: Users },
  { href: "/portal-associativo/unidades", label: "Chácaras/Lotes", section: "unidades", icon: Home },
  { href: "/portal-associativo/transferencias", label: "Transferências", section: "transferencias", icon: Repeat },
  { href: "/portal-associativo/financeiro", label: "Mensalidades", section: "financeiro", icon: Banknote },
  { href: "/portal-associativo/inadimplentes", label: "Inadimplentes", section: "inadimplentes", icon: FileText },
  { href: "/portal-associativo/documentos", label: "Documentos", section: "documentos", icon: FolderOpen },
  { href: "/portal-associativo/importacao", label: "Importação", section: "importacao", icon: Upload },
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
    <div className={`${styles.root} portal-associativo-module min-h-screen`}>
      <header className={`${styles.mobileTop} sticky top-0 z-30 flex items-center justify-between px-6 py-5 lg:hidden`}>
        <details className={styles.mobileMenu}>
          <summary className={styles.menuTrigger} aria-label="Abrir menu">
            <Menu className={`${styles.menuOpen} h-6 w-6`} aria-hidden />
            <X className={`${styles.menuClose} h-6 w-6`} aria-hidden />
            <span className="sr-only">Abrir menu</span>
          </summary>
          <div className={styles.mobileScrim} aria-hidden />
          <aside className={styles.mobilePanel}>
            <SidebarContent activePath={activePath} companyName={companyName} items={visibleItems} roleLabel={roleLabel} userName={userName} />
          </aside>
        </details>

        <Link className={styles.notificationButton} href="/portal-associativo/avisos" title="Avisos">
          <Bell className="h-5 w-5" aria-hidden />
          <span className={styles.notificationDot} aria-hidden />
          <span className="sr-only">Abrir avisos</span>
        </Link>
      </header>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className={`${styles.sidebar} hidden lg:flex`}>
          <SidebarContent activePath={activePath} companyName={companyName} items={visibleItems} roleLabel={roleLabel} userName={userName} />
        </aside>

        <main className="min-w-0 px-6 py-8 pb-12 sm:px-8 lg:px-10 xl:px-12">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  activePath,
  companyName,
  items,
  roleLabel,
  userName
}: {
  activePath: string;
  companyName: string;
  items: PortalNavItem[];
  roleLabel?: string;
  userName?: string;
}) {
  const initials = getInitials(userName || companyName);

  return (
    <div className="flex min-h-full w-full flex-col">
      <Link className={styles.sidebarBrand} href="/portal-associativo">
        <span className={styles.brandMark}>
          <Sparkles className="h-6 w-6" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-lg font-black leading-tight">Portal Associativo</span>
          <span className="block truncate text-sm font-semibold opacity-65" title={companyName}>{companyName}</span>
        </span>
      </Link>

      <div className={styles.userCard}>
        <span className={styles.userAvatar}>{initials}</span>
        <span className="min-w-0">
          {userName ? <span className="block truncate text-base font-black" title={userName}>{userName}</span> : null}
          {roleLabel ? <span className="block truncate text-sm font-semibold opacity-65" title={roleLabel}>{roleLabel}</span> : null}
        </span>
      </div>

      <div className={styles.navSectionLabel}>Navegação</div>
      <nav className="grid gap-1.5" aria-label="Menu do Portal Associativo">
        {items.map((item) => (
          <PortalNavLink activePath={activePath} item={item} key={item.href} />
        ))}
      </nav>

      <div className="mt-auto grid gap-3 pt-6">
        <Link className={styles.sidebarAction} href="/dashboard">
          <ArrowLeft className="h-5 w-5" aria-hidden />
          Voltar ao MBA Labs
        </Link>
        <form action="/sair" method="post">
          <button className={`${styles.sidebarAction} ${styles.sidebarActionGhost} w-full`} type="submit">
            <LogOut className="h-5 w-5" aria-hidden />
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}

function PortalNavLink({
  item,
  activePath,
}: {
  item: PortalNavItem;
  activePath: string;
}) {
  const Icon = item.icon;
  const active = item.href === "/portal-associativo" ? activePath === item.href : activePath.startsWith(item.href);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`${styles.navLink} group flex min-h-12 items-center gap-3 rounded-[24px] px-4 text-base font-semibold transition`}
      href={item.href}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {active ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : null}
    </Link>
  );
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "PA";
}
