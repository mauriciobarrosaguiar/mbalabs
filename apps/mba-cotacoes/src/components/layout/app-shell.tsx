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
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ModeBadge } from "@/components/layout/mode-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { CustomerType, UserRole } from "@/lib/types";

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
  { href: "/app/dashboard", label: "Dashboard", icon: Home, group: "principal" },
  { href: "/app/cotacoes-farmacia/nova", label: "Nova cotação farmácia", icon: PlusCircle, group: "Farmácia" },
  { href: "/app/cotacoes-farmacia", label: "Minhas cotações", icon: ListChecks, group: "Farmácia" },
  { href: "/app/pedidos-gerados-farmacia", label: "Pedidos gerados", icon: ReceiptText, group: "Farmácia" },
  { href: "/app/produtos", label: "Produtos", icon: Package, group: "Cadastros" },
  { href: "/app/fornecedores", label: "Fornecedores", icon: Truck, group: "Cadastros" },
  { href: "/app/distribuidoras", label: "Distribuidoras", icon: Store, group: "Cadastros" },
  { href: "/app/historico-compras", label: "Histórico de compras", icon: ReceiptText, group: "Gestão" },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings, group: "Gestão" },
];

const biddingNav: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: Home, group: "principal" },
  { href: "/app/licitacoes/nova", label: "Nova cotação licitação", icon: PlusCircle, group: "Licitação" },
  { href: "/app/licitacoes", label: "Minhas licitações", icon: BarChart3, group: "Licitação" },
  { href: "/app/mapa-comparativo", label: "Mapa comparativo", icon: FileSpreadsheet, group: "Licitação" },
  { href: "/app/analise-unidade", label: "Análise por unidade", icon: ClipboardCheck, group: "Licitação" },
  { href: "/app/pedidos-gerados-licitacao", label: "Pedidos gerados", icon: ReceiptText, group: "Licitação" },
  { href: "/app/historico-precos", label: "Histórico de preços", icon: History, group: "Gestão" },
  { href: "/app/configuracoes", label: "Configurações", icon: Settings, group: "Gestão" },
];

const supplierNav: NavItem[] = [
  { href: "/app/cotacoes-disponiveis", label: "Cotações disponíveis", icon: ListChecks, group: "principal" },
  { href: "/app/cotacoes-respondidas", label: "Cotações respondidas", icon: CheckCircle2, group: "principal" },
  { href: "/app/perfil", label: "Perfil", icon: Settings, group: "principal" },
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
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <Brand mode={mode} />
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          <GroupedNav nav={nav} currentPath={currentPath} />
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="rounded-md bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-900">
              {mode === "admin" ? "Administração" : tenantName ?? "Empresa conectada"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sessão protegida por Supabase Auth e permissões por perfil.
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
              <Button asChild variant="outline" size="sm">
                <a href="/sair">Sair</a>
              </Button>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Brand({ mode }: { mode: "admin" | "app" }) {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-xs font-bold text-white">
        MBA
      </div>
      <div>
        <p className="font-semibold text-slate-950">MBA Cotações</p>
        <p className="text-xs text-muted-foreground">
          {mode === "admin" ? "Painel Administrativo MBA Cotações" : "Painel da empresa"}
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
      <SheetContent side="left" className="flex h-full w-80 flex-col bg-white p-0 text-slate-950">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <Brand mode={mode} />
        <Separator />
        <nav className="flex-1 space-y-4 overflow-y-auto bg-white p-3 pb-8 text-slate-950">
          <GroupedNav nav={nav} currentPath={currentPath} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
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
    </Link>
  );
}

function GroupedNav({
  nav,
  currentPath,
}: {
  nav: NavItem[];
  currentPath: string;
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
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
          ) : null}
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(currentPath, item.href)}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function isActive(currentPath: string, href: string) {
  if (href === "/admin") return currentPath === href;
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

function getAppNav(role?: UserRole, tenantType?: CustomerType) {
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
