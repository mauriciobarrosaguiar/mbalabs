import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Car,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Settings,
  Sparkles,
  Users,
  Wrench
} from "lucide-react";

type LavaNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const lavaNavItems: LavaNavItem[] = [
  { href: "/lavagestor", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lavagestor/busca", label: "Busca rapida", icon: Search },
  { href: "/lavagestor/nova-lavagem", label: "Nova lavagem", icon: Car },
  { href: "/lavagestor/fila", label: "Fila", icon: ClipboardList },
  { href: "/lavagestor/lavagens", label: "Lavagens", icon: ClipboardList },
  { href: "/lavagestor/clientes", label: "Clientes", icon: Users },
  { href: "/lavagestor/veiculos", label: "Veículos", icon: Car },
  { href: "/lavagestor/funcionarios", label: "Funcionários", icon: Wrench },
  { href: "/lavagestor/servicos", label: "Serviços", icon: Sparkles },
  { href: "/lavagestor/comissoes", label: "Comissões", icon: HandCoins },
  { href: "/lavagestor/vales", label: "Vales", icon: Banknote },
  { href: "/lavagestor/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/lavagestor/financeiro", label: "Financeiro", icon: Banknote },
  { href: "/lavagestor/pos-venda", label: "Pos-venda", icon: MessageCircle },
  { href: "/lavagestor/relatorios", label: "Relatórios", icon: FileText },
  { href: "/lavagestor/configuracoes", label: "Configurações", icon: Settings }
];

export function LavaGestorShell({
  children,
  activePath,
  companyName = "Empresa conectada",
  userName,
  roleLabel
}: {
  children: React.ReactNode;
  activePath: string;
  companyName?: string;
  userName?: string;
  roleLabel?: string;
}) {
  return (
    <div className="lavagestor-module min-h-screen overflow-x-hidden bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden h-screen w-72 flex-col border-r border-border bg-card px-4 py-5 lg:flex">
        <Link className="block shrink-0" href="/lavagestor">
          <div className="text-xl font-bold tracking-tight text-primary">LavaGestor</div>
          <div className="mt-1 truncate text-sm text-muted-foreground" title={companyName}>{companyName}</div>
        </Link>

        <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pb-4 pr-1">
          {lavaNavItems.map((item) => (
            <LavaNavLink activePath={activePath} item={item} key={item.href} />
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

      <header className="sticky top-0 z-30 border-b border-border bg-card/95 px-4 py-2 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link className="min-w-0" href="/lavagestor">
            <div className="truncate font-bold text-primary">LavaGestor</div>
            <div className="truncate text-xs text-muted-foreground" title={companyName}>{companyName}</div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Link className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold" href="/dashboard">
              MBA Labs
            </Link>
            <details className="group relative">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-white shadow-sm [&::-webkit-details-marker]:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" aria-hidden />
              </summary>
              <div className="absolute right-0 top-12 z-40 grid w-64 gap-1 rounded-xl border border-border bg-white p-2 shadow-xl">
                {lavaNavItems.map((item) => (
                  <LavaNavLink activePath={activePath} item={item} key={`${item.href}-dropdown`} mobile />
                ))}
                <div className="my-1 border-t border-border" />
                <Link className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold hover:bg-muted" href="/dashboard">
                  <ArrowLeft className="h-4 w-4 text-primary" aria-hidden />
                  MBA Labs
                </Link>
                <form action="/sair" method="post">
                  <button className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-muted" type="submit">
                    <LogOut className="h-4 w-4 text-primary" aria-hidden />
                    Sair
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main className="px-4 py-5 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

function LavaNavLink({
  item,
  activePath,
  mobile = false
}: {
  item: LavaNavItem;
  activePath: string;
  mobile?: boolean;
}) {
  const Icon = item.icon;
  const active = item.href === "/lavagestor" ? activePath === item.href : activePath.startsWith(item.href);

  if (mobile) {
    return (
      <Link
        aria-current={active ? "page" : undefined}
        className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition hover:bg-muted aria-[current=page]:bg-[#dff7ec] aria-[current=page]:text-[#0f5132]"
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
      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition hover:bg-muted aria-[current=page]:bg-[#dff7ec] aria-[current=page]:text-[#0f5132]"
      href={item.href}
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      {item.label}
    </Link>
  );
}
