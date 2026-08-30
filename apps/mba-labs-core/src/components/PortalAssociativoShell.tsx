import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  ArrowLeft,
  Banknote,
  Bell,
  ChevronDown,
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
  MoreHorizontal,
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
  group: "principal" | "mais";
  bottom?: boolean;
};

const navItems: PortalNavItem[] = [
  { href: "/portal-associativo", label: "Início", section: "dashboard", icon: LayoutDashboard, group: "principal", bottom: true },
  { href: "/portal-associativo/pessoas", label: "Associados", section: "pessoas", icon: Users, group: "principal", bottom: true },
  { href: "/portal-associativo/unidades", label: "Unidades", section: "unidades", icon: Home, group: "principal" },
  { href: "/portal-associativo/financeiro", label: "Financeiro", section: "financeiro", icon: Banknote, group: "principal", bottom: true },
  { href: "/portal-associativo/transferencias", label: "Transferir", section: "transferencias", icon: Repeat, group: "principal" },
  { href: "/portal-associativo/avisos", label: "Avisos", section: "avisos", icon: Bell, group: "principal" },
  { href: "/portal-associativo/configuracoes", label: "Configurações", section: "configuracoes", icon: Settings, group: "principal" },
  { href: "/portal-associativo/painel-associado", label: "Meu painel", section: "painel", icon: ShieldCheck, group: "principal" },

  { href: "/portal-associativo/implantacao", label: "Começar aqui", section: "implantacao", icon: ClipboardCheck, group: "mais" },
  { href: "/portal-associativo/loteamentos", label: "Grupos/Loteamentos", section: "loteamentos", icon: MapIcon, group: "mais" },
  { href: "/portal-associativo/inadimplentes", label: "Atrasados", section: "inadimplentes", icon: FileText, group: "mais" },
  { href: "/portal-associativo/documentos", label: "Documentos", section: "documentos", icon: FolderOpen, group: "mais" },
  { href: "/portal-associativo/importacao", label: "Importar planilha", section: "importacao", icon: Upload, group: "mais" },
  { href: "/portal-associativo/relatorios", label: "Relatórios", section: "relatorios", icon: FileText, group: "mais" },
  { href: "/portal-associativo/reunioes", label: "Reuniões", section: "reunioes", icon: ClipboardList, group: "mais" },
  { href: "/portal-associativo/projetos", label: "Projetos", section: "projetos", icon: FolderKanban, group: "mais" }
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
  const mainItems = visibleItems.filter((item) => item.group === "principal");
  const moreItems = visibleItems.filter((item) => item.group === "mais");

  return (
    <div className={`${styles.root} portal-associativo-module min-h-screen`}>
      <header className={`${styles.mobileTop} sticky top-0 z-30 flex items-center justify-between px-5 py-4 lg:hidden`}>
        <details className={styles.mobileMenu}>
          <summary className={styles.menuTrigger} aria-label="Abrir menu">
            <Menu className={`${styles.menuOpen} h-6 w-6`} aria-hidden />
            <X className={`${styles.menuClose} h-6 w-6`} aria-hidden />
            <span className="sr-only">Abrir menu</span>
          </summary>
          <div className={styles.mobileScrim} aria-hidden />
          <aside className={styles.mobilePanel}>
            <SidebarContent activePath={activePath} companyName={companyName} mainItems={mainItems} moreItems={moreItems} roleLabel={roleLabel} userName={userName} />
          </aside>
        </details>

        <Link className={styles.notificationButton} href="/portal-associativo/avisos" title="Avisos">
          <Bell className="h-5 w-5" aria-hidden />
          <span className={styles.notificationDot} aria-hidden />
          <span className="sr-only">Abrir avisos</span>
        </Link>
      </header>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className={`${styles.sidebar} hidden lg:flex`}>
          <SidebarContent activePath={activePath} companyName={companyName} mainItems={mainItems} moreItems={moreItems} roleLabel={roleLabel} userName={userName} />
        </aside>

        <main className="min-w-0 px-5 py-6 pb-24 sm:px-7 lg:px-8 xl:px-10">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      <BottomMobileNav activePath={activePath} items={visibleItems} />
    </div>
  );
}

function SidebarContent({
  activePath,
  companyName,
  mainItems,
  moreItems,
  roleLabel,
  userName
}: {
  activePath: string;
  companyName: string;
  mainItems: PortalNavItem[];
  moreItems: PortalNavItem[];
  roleLabel?: string;
  userName?: string;
}) {
  const initials = getInitials(userName || companyName);
  const moreActive = moreItems.some((item) => isActivePath(item, activePath));

  return (
    <div className="flex min-h-full w-full flex-col">
      <Link className={styles.sidebarBrand} href="/portal-associativo">
        <span className={styles.brandMark}>
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base font-black leading-tight">Portal Associativo</span>
          <span className="block truncate text-xs font-semibold opacity-65" title={companyName}>{companyName}</span>
        </span>
      </Link>

      <div className={styles.userCard}>
        <span className={styles.userAvatar}>{initials}</span>
        <span className="min-w-0">
          {userName ? <span className="block truncate text-sm font-black" title={userName}>{userName}</span> : null}
          {roleLabel ? <span className="block truncate text-xs font-semibold opacity-65" title={roleLabel}>{roleLabel}</span> : null}
        </span>
      </div>

      <div className={styles.navSectionLabel}>Principal</div>
      <nav className="grid gap-1" aria-label="Menu principal do Portal Associativo">
        {mainItems.map((item) => (
          <PortalNavLink activePath={activePath} item={item} key={item.href} />
        ))}
      </nav>

      {moreItems.length ? (
        <details className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-1" open={moreActive}>
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl px-3 text-sm font-black text-white/85 transition hover:bg-white/10">
            <MoreHorizontal className="h-4 w-4" aria-hidden />
            Mais opções
            <ChevronDown className="ml-auto h-4 w-4" aria-hidden />
          </summary>
          <nav className="mt-1 grid gap-1" aria-label="Menu avançado do Portal Associativo">
            {moreItems.map((item) => (
              <PortalNavLink activePath={activePath} compact item={item} key={item.href} />
            ))}
          </nav>
        </details>
      ) : null}

      <div className="mt-auto grid gap-2 pt-5">
        <Link className={styles.sidebarAction} href="/dashboard">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao MBA Labs
        </Link>
        <form action="/sair" method="post">
          <button className={`${styles.sidebarAction} ${styles.sidebarActionGhost} w-full`} type="submit">
            <LogOut className="h-4 w-4" aria-hidden />
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
  compact = false
}: {
  item: PortalNavItem;
  activePath: string;
  compact?: boolean;
}) {
  const Icon = item.icon;
  const active = isActivePath(item, activePath);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`${styles.navLink} group flex items-center gap-2 rounded-[18px] px-3 font-semibold transition ${compact ? "min-h-9 text-sm" : "min-h-11 text-sm"}`}
      href={item.href}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate leading-tight">{item.label}</span>
      {active ? <ChevronRight className="h-4 w-4 shrink-0" aria-hidden /> : null}
    </Link>
  );
}

function BottomMobileNav({ activePath, items }: { activePath: string; items: PortalNavItem[] }) {
  const preferred = [
    "/portal-associativo",
    "/portal-associativo/financeiro",
    "/portal-associativo/pessoas",
    "/portal-associativo/configuracoes"
  ];
  const bottomItems = preferred
    .map((href) => items.find((item) => item.href === href))
    .filter(Boolean) as PortalNavItem[];
  const visibleBottom = bottomItems.length ? bottomItems : items.filter((item) => item.bottom).slice(0, 4);
  if (!visibleBottom.length) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur lg:hidden" aria-label="Atalhos principais">
      {visibleBottom.slice(0, 4).map((item) => {
        const Icon = item.icon;
        const active = isActivePath(item, activePath);
        return (
          <Link key={item.href} href={item.href} className={`grid min-w-0 place-items-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-black ${active ? "bg-primary/10 text-primary" : "text-slate-600"}`}>
            <Icon className="h-4 w-4" aria-hidden />
            <span className="max-w-full truncate">{item.href.endsWith("configuracoes") ? "Mais" : item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function isActivePath(item: PortalNavItem, activePath: string) {
  return item.href === "/portal-associativo" ? activePath === item.href : activePath.startsWith(item.href);
}

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("") || "PA";
}
