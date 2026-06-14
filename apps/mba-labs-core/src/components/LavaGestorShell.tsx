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
    <div className="lavagestor-module min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-border bg-card px-4 py-5 lg:block">
        <Link className="block" href="/lavagestor">
          <div className="text-xl font-bold tracking-tight text-primary">LavaGestor</div>
          <div className="mt-1 text-sm text-muted-foreground">{companyName}</div>
        </Link>

        <nav className="mt-8 space-y-1">
          {lavaNavItems.map((item) => (
            <LavaNavLink activePath={activePath} item={item} key={item.href} />
          ))}
        </nav>

        <div className="absolute inset-x-4 bottom-5 rounded-lg border border-border bg-muted/50 p-3">
          {userName ? <p className="text-sm font-semibold">{userName}</p> : null}
          {roleLabel ? <p className="text-xs text-muted-foreground">{roleLabel}</p> : null}
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
          <Link href="/lavagestor">
            <div className="font-bold text-primary">LavaGestor</div>
            <div className="text-xs text-muted-foreground">{companyName}</div>
          </Link>
          <Link className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold" href="/dashboard">
            MBA Labs
          </Link>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {lavaNavItems.map((item) => (
            <LavaNavLink activePath={activePath} item={item} key={`${item.href}-mobile`} mobile />
          ))}
        </nav>
      </header>

      <main className="px-4 py-6 lg:ml-72 lg:px-8">
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
        className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-muted px-3 text-sm font-semibold aria-[current=page]:bg-[#dff7ec] aria-[current=page]:text-[#0f5132]"
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
