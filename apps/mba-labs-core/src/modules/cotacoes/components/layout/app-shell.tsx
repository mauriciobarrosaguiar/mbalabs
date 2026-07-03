"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  History,
  Home,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageCircle,
  Package,
  PlusCircle,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  Users,
} from "lucide-react";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Separator } from "@/modules/cotacoes/components/ui/separator";
import { ModeBadge } from "@/modules/cotacoes/components/layout/mode-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/modules/cotacoes/components/ui/sheet";
import { cn } from "@/modules/cotacoes/lib/utils";
import type { CustomerType, UserRole } from "@/modules/cotacoes/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
};

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/empresas", label: "Empresas", icon: Building2 },
  { href: "/admin/farmacias", label: "Farmácias", icon: Store },
  { href: "/admin/licitacoes", label: "Licitações", icon: BarChart3 },
  { href: "/admin/distribuidoras", label: "Distribuidoras", icon: Truck },
  { href: "/admin/vendedores", label: "Vendedores", icon: Users },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/planos", label: "Planos", icon: ClipboardCheck },
  { href: "/admin/mensalidades", label: "Mensalidades", icon: ReceiptText },
  { href: "/admin/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/admin/configuracoes/pagamentos", label: "Config. pagamentos", icon: CreditCard },
  { href: "/admin/configuracoes/whatsapp", label: "WhatsApp MBA", icon: MessageCircle },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
  { href: "/admin/logs", label: "Logs", icon: ShieldCheck },
];

const pharmacyNav: NavItem[] = [
  { href: "/cotacoes", label: "Dashboard", icon: Home, group: "principal" },
  { href: "/cotacoes/cotacoes-farmacia/nova", label: "Nova cotação farmácia", icon: PlusCircle, group: "Farmácia" },
  { href: "/cotacoes/cotacoes-farmacia", label: "Minhas cotações", icon: ListChecks, group: "Farmácia" },
  { href: "/cotacoes/pedidos-gerados-farmacia", label: "Pedidos gerados", icon: ReceiptText, group: "Farmácia" },
  { href: "/cotacoes/produtos", label: "Produtos", icon: Package, group: "Cadastros" },
  { href: "/cotacoes/fornecedores", label: "Fornecedores", icon: Truck, group: "Cadastros" },
  { href: "/cotacoes/distribuidoras", label: "Distribuidoras", icon: Store, group: "Cadastros" },
  { href: "/cotacoes/historico-compras", label: "Histórico de compras", icon: ReceiptText, group: "Gestão" },
  { href: "/cotacoes/configuracoes", label: "Configurações", icon: Settings, group: "Gestão" },
];

const biddingNav: NavItem[] = [
  { href: "/cotacoes", label: "Dashboard", icon: Home, group: "principal" },
  { href: "/cotacoes/licitacoes/nova", label: "Nova cotação licitação", icon: PlusCircle, group: "Licitação" },
  { href: "/cotacoes/licitacoes", label: "Minhas licitações", icon: BarChart3, group: "Licitação" },
  { href: "/cotacoes/mapa-comparativo", label: "Mapa comparativo", icon: FileSpreadsheet, group: "Licitação" },
  { href: "/cotacoes/analise-unidade", label: "Análise por unidade", icon: ClipboardCheck, group: "Licitação" },
  { href: "/cotacoes/pedidos-gerados-licitacao", label: "Pedidos gerados", icon: ReceiptText, group: "Licitação" },
  { href: "/cotacoes/historico-precos", label: "Histórico de preços", icon: History, group: "Gestão" },
  { href: "/cotacoes/configuracoes", label: "Configurações", icon: Settings, group: "Gestão" },
];

const supplierNav: NavItem[] = [
  { href: "/cotacoes/cotacoes-disponiveis", label: "Cotações disponíveis", icon: ListChecks, group: "principal" },
  { href: "/cotacoes/cotacoes-respondidas", label: "Cotações respondidas", icon: CheckCircle2, group: "principal" },
  { href: "/cotacoes/perfil", label: "Perfil", icon: Settings, group: "principal" },
];

export function AppShell({
  children,
  mode,
  currentPath,
  title,
  subtitle,
  profileRole,
  tenantType,
  tenantName,
}: {
  children: React.ReactNode;
  mode: "admin" | "app";
  currentPath: string;
  title: string;
  subtitle: string;
  profileRole?: UserRole;
  tenantType?: CustomerType;
  tenantName?: string;
}) {
  const nav = mode === "admin" ? adminNav : getAppNav(profileRole, tenantType);

  return (
    <div className="cotacoes-module min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <Brand mode={mode} />
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          <GroupedNav nav={nav} currentPath={currentPath} />
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-900">
              {mode === "admin" ? "Administração" : tenantName ?? "Empresa"}
            </p>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <MobileNav nav={nav} mode={mode} currentPath={currentPath} />
              <div>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
                <h1 className="text-xl font-semibold tracking-normal text-slate-950">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700" aria-label="Notificações">
                <Bell className="h-4 w-4" />
                <span>0</span>
              </div>
              <ModeBadge />
              <form action="/sair" method="post">
                <Button variant="outline" size="sm" type="submit">
                  Sair
                </Button>
              </form>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Brand({
  mode,
  variant = "default",
}: {
  mode: "admin" | "app";
  variant?: "default" | "mobile";
}) {
  return (
    <div
      className={cn(
        "flex h-16 items-center gap-3 border-b px-4",
        "border-slate-200",
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-xs font-bold text-white">
        MBA
      </div>
      <div>
        <p className={cn("font-semibold", variant === "mobile" ? "text-slate-950" : "text-slate-950")}>
          MBA Cotações
        </p>
        <p
          className={cn(
            "text-xs",
            variant === "mobile" ? "text-slate-600" : "text-muted-foreground",
          )}
        >
          {mode === "admin" ? "Painel Administrativo" : "Painel da empresa"}
        </p>
      </div>
    </div>
  );
}

function MobileNav({
  nav,
  mode,
  currentPath,
}: {
  nav: NavItem[];
  mode: "admin" | "app";
  currentPath: string;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        className="cotacoes-mobile-menu flex h-full max-h-dvh w-[min(86vw,20rem)] max-w-[86vw] flex-col gap-0 overflow-hidden border-slate-200 !bg-white p-0 !text-slate-950"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <Brand mode={mode} variant="mobile" />
        <Separator className="bg-slate-200" />
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 pt-4 pb-8 [-webkit-overflow-scrolling:touch]">
          <GroupedNav nav={nav} currentPath={currentPath} variant="mobile" />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function NavLink({
  item,
  active,
  variant = "default",
}: {
  item: NavItem;
  active: boolean;
  variant?: "default" | "mobile";
}) {
  const Icon = item.icon;
  const mobile = variant === "mobile";

  return (
    <Link
      aria-current={active ? "page" : undefined}
      href={item.href}
      className={cn(
        "flex min-h-10 items-center justify-between rounded-md px-3 text-sm font-medium transition",
        mobile && active && "bg-teal-50 text-teal-800 hover:bg-teal-50 hover:text-teal-800",
        mobile && !active && "text-slate-900 hover:bg-slate-100 hover:text-slate-950",
        !mobile && active && "bg-teal-50 text-teal-800 hover:bg-teal-50 hover:text-teal-800",
        !mobile && !active && "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </span>
    </Link>
  );
}

function GroupedNav({
  nav,
  currentPath,
  variant = "default",
}: {
  nav: NavItem[];
  currentPath: string;
  variant?: "default" | "mobile";
}) {
  const groups = new Map<string, NavItem[]>();
  for (const item of nav) {
    const group = item.group ?? "principal";
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }

  return (
    <>
      {Array.from(groups.entries()).map(([group, items]) => (
        <div key={group} className="space-y-1">
          {group !== "principal" ? (
            <p
              className={cn(
                "px-3 pb-1 text-xs font-semibold uppercase tracking-wide",
                variant === "mobile" ? "text-slate-500" : "text-muted-foreground",
              )}
            >
              {group}
            </p>
          ) : null}
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(currentPath, item.href)}
              variant={variant}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function isActive(currentPath: string, href: string) {
  if (href === "/admin" || href === "/cotacoes") return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function getAppNav(role?: UserRole, tenantType?: CustomerType) {
  if (role === "SUPER_ADMIN") {
    return [
      ...mergeNav(pharmacyNav, biddingNav),
      { href: "/cotacoes/configuracoes/whatsapp", label: "WhatsApp MBA", icon: MessageCircle, group: "Gestão" },
    ];
  }
  if (role === "VENDEDOR_EXTERNO") return supplierNav;
  if (tenantType === "pharmacy") return pharmacyNav;
  if (tenantType === "distributor_bidding") return biddingNav;
  if (tenantType === "both") return mergeNav(pharmacyNav, biddingNav);
  return pharmacyNav;
}

function mergeNav(...groups: NavItem[][]) {
  const items = new Map<string, NavItem>();
  for (const group of groups) {
    for (const item of group) items.set(item.href, item);
  }
  return Array.from(items.values());
}
