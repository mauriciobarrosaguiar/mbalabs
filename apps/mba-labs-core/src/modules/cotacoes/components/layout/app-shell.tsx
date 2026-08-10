"use client";

import Link from "next/link";
import {
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FilePlusCorner,
  FileSpreadsheet,
  History,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
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
  const isCompanyDashboard = mode === "app" && currentPath === "/cotacoes";
  const newQuotationHref = tenantType === "distributor_bidding"
    ? "/cotacoes/licitacoes/nova"
    : "/cotacoes/cotacoes-farmacia/nova";

  return (
    <div className="cotacoes-module min-h-screen bg-[#f7fbf9] text-[#0c211b]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] border-r border-[#dce8e3] bg-[#fbfdfc] lg:flex lg:flex-col">
        <Brand mode={mode} />
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <GroupedNav nav={nav} currentPath={currentPath} />
        </nav>
        <div className="border-t border-[#dce8e3] px-5 py-4">
          <p className="text-xs font-medium text-[#60756d]">
            {mode === "admin" ? "MBA Labs · Admin" : "MBA Labs · v2"}
          </p>
          {tenantName && mode === "admin" ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{tenantName}</p>
          ) : null}
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[268px]">
        <header className="sticky top-0 z-20 border-b border-[#dce8e3] bg-[#fbfdfc]/90 backdrop-blur-md">
          <div className="flex min-h-[68px] items-center gap-3 px-4 py-3 sm:px-8">
            <MobileNav nav={nav} mode={mode} currentPath={currentPath} />
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-medium text-[#71837d]">
                {mode === "app" ? "MBA Labs" : subtitle}
              </p>
              <h1 className="mt-0.5 truncate text-lg font-semibold tracking-[-0.015em] text-[#10251f] sm:text-xl">
                {title}
              </h1>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label="Notificações"
                className="grid size-9 place-items-center rounded-xl border border-[#dbe6e1] bg-white text-[#60756d] shadow-sm transition-colors hover:bg-[#f1f8f5] hover:text-[#0a6f5d]"
              >
                <Bell className="size-4" />
              </button>
              {mode === "admin" ? <ModeBadge /> : null}
              <form action="/sair" method="post">
                <Button variant="outline" size="lg" type="submit" className="h-9 gap-2 border-[#dbe6e1] bg-white px-3 text-[#274239] shadow-sm">
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </form>
            </div>
          </div>
        </header>

        <main
          className="min-h-[calc(100vh-68px)] px-4 py-6 sm:px-8 sm:py-8"
          style={{
            backgroundImage:
              "radial-gradient(circle at 8% 0%, rgba(198, 241, 226, 0.56), transparent 32rem), radial-gradient(circle at 88% 4%, rgba(215, 241, 244, 0.60), transparent 34rem), linear-gradient(180deg, #f7fcfa 0%, #f8fbfa 100%)",
          }}
        >
          <div className="mx-auto w-full max-w-[1180px] space-y-6">
            {isCompanyDashboard ? (
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl space-y-1.5">
                  <h2 className="text-2xl font-semibold tracking-[-0.025em] text-[#08251d] sm:text-[1.75rem]">
                    Visão geral das cotações
                  </h2>
                  <p className="text-sm leading-6 text-[#657a72]">
                    Acompanhe em tempo real o andamento das cotações, respostas de fornecedores e pedidos gerados.
                  </p>
                </div>
                <Button asChild size="lg" className="h-9 gap-2 bg-[#007f69] px-4 shadow-[0_4px_12px_rgba(0,127,105,0.18)] hover:bg-[#006f5c]">
                  <Link href={newQuotationHref}>
                    <FilePlusCorner className="size-4" />
                    Nova cotação
                  </Link>
                </Button>
              </div>
            ) : null}
            {children}
          </div>
        </main>
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
        "flex h-[72px] items-center gap-3 border-b border-[#dce8e3] px-5",
        variant === "mobile" && "h-[68px] px-4",
      )}
    >
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#008970] text-xs font-bold tracking-wide text-white shadow-sm">
        MBA
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-base font-semibold text-[#0b261e]">MBA Cotações</p>
        <p className="mt-0.5 truncate text-xs text-[#6a7d76]">
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
        <Button variant="outline" size="icon" className="border-[#dbe6e1] bg-white lg:hidden" aria-label="Abrir menu">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        aria-describedby={undefined}
        className="cotacoes-mobile-menu flex h-full max-h-dvh w-[min(86vw,20rem)] max-w-[86vw] flex-col gap-0 overflow-hidden border-[#dce8e3] !bg-[#fbfdfc] p-0 !text-[#10251f]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <Brand mode={mode} variant="mobile" />
        <Separator className="bg-[#dce8e3]" />
        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pt-4 pb-8 [-webkit-overflow-scrolling:touch]">
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
        "group flex min-h-10 items-center justify-between rounded-xl px-3 text-sm font-medium transition-colors",
        active && "bg-[#d8f4e9] text-[#075b4b] hover:bg-[#d8f4e9] hover:text-[#075b4b]",
        !active && "text-[#496159] hover:bg-[#eef6f2] hover:text-[#17352b]",
        mobile && "min-h-11",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className={cn("size-4 shrink-0", active ? "text-[#08755f]" : "text-[#5e736b]")} />
        <span className="truncate">{item.label}</span>
      </span>
      <span className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-[#008970]" : "bg-transparent")} />
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
            <p className="px-3 pb-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6d8179]">
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
