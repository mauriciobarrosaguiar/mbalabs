import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Bot,
  Boxes,
  CalendarDays,
  Car,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  ReceiptText,
  ScanLine,
  Search,
  Settings,
  Sparkles,
  Users,
  WalletCards,
  Workflow,
  Wrench
} from "lucide-react";
import {
  getEffectiveLavaPermissions,
  requireLavaGestorAccess,
  type LavaPerfil,
  type LavaPermission
} from "@/lib/lavagestor-permissions";

type LavaNavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: LavaPermission;
  anyOf?: LavaPermission[];
};

const lavaNavItems: LavaNavItem[] = [
  { href: "/lavagestor", label: "Dashboard", icon: LayoutDashboard, permission: "financeiro.ver_caixa" },
  { href: "/lavagestor/busca", label: "Busca rápida", icon: Search, permission: "busca.ver" },
  { href: "/lavagestor/nova-lavagem", label: "Nova lavagem", icon: Car, permission: "lavagem.criar" },
  { href: "/lavagestor/fila", label: "Fila", icon: ClipboardList, permission: "fila.ver" },
  { href: "/lavagestor/lavagens", label: "Lavagens", icon: ClipboardList, permission: "lavagem.ver" },
  { href: "/lavagestor/agendamentos", label: "Agendamentos", icon: CalendarDays, permission: "agendamento.ver" },
  { href: "/lavagestor/placa", label: "Ler placa", icon: ScanLine, permission: "placa.ler" },
  { href: "/lavagestor/clientes", label: "Clientes", icon: Users, anyOf: ["cliente.criar", "cliente.editar"] },
  { href: "/lavagestor/veiculos", label: "Veículos", icon: Car, anyOf: ["veiculo.criar", "veiculo.editar"] },
  { href: "/lavagestor/funcionarios", label: "Funcionários", icon: Wrench, permission: "funcionario.gerenciar" },
  { href: "/lavagestor/servicos", label: "Serviços", icon: Sparkles, permission: "servico.gerenciar" },
  { href: "/lavagestor/estoque", label: "Estoque", icon: Package, permission: "estoque.ver" },
  { href: "/lavagestor/comissoes", label: "Comissões", icon: HandCoins, anyOf: ["comissao.ver_propria", "comissao.ver_todas"] },
  { href: "/lavagestor/vales", label: "Vales", icon: Banknote, permission: "financeiro.ver_caixa" },
  { href: "/lavagestor/pagamentos", label: "Pagamentos", icon: CreditCard, permission: "pagamento.ver_todos" },
  { href: "/lavagestor/financeiro", label: "Caixa", icon: Banknote, permission: "financeiro.ver_caixa" },
  { href: "/lavagestor/pagamentos-integrados", label: "Pagamentos integrados", icon: WalletCards, permission: "financeiro.ver_caixa" },
  { href: "/lavagestor/notas-fiscais", label: "Notas fiscais", icon: ReceiptText, permission: "financeiro.ver_caixa" },
  { href: "/lavagestor/whatsapp", label: "WhatsApp", icon: MessageCircle, permission: "whatsapp.configurar" },
  { href: "/lavagestor/setup-facil", label: "Configuracao Facil", icon: Sparkles, permission: "configuracao.editar" },
  { href: "/lavagestor/pos-venda", label: "Pós-venda", icon: MessageCircle, permission: "whatsapp.enviar_manual" },
  { href: "/lavagestor/automacoes", label: "Automações", icon: Workflow, permission: "configuracao.editar" },
  { href: "/lavagestor/iamob", label: "IAMob", icon: Bot, permission: "relatorio.ver_basico" },
  { href: "/lavagestor/relatorios", label: "Relatórios", icon: FileText, permission: "relatorio.ver_basico" },
  { href: "/lavagestor/usuarios", label: "Usuários", icon: Users, permission: "usuarios.gerenciar" },
  { href: "/lavagestor/configuracoes", label: "Configurações", icon: Settings, permission: "configuracao.editar" }
];

const lavaNavGroupsConfig: Array<{ label: string; hrefs: string[] }> = [
  { label: "Operação", hrefs: ["/lavagestor", "/lavagestor/busca", "/lavagestor/nova-lavagem", "/lavagestor/fila", "/lavagestor/lavagens", "/lavagestor/agendamentos", "/lavagestor/placa"] },
  { label: "Cadastros", hrefs: ["/lavagestor/clientes", "/lavagestor/veiculos", "/lavagestor/funcionarios", "/lavagestor/servicos", "/lavagestor/estoque"] },
  { label: "Financeiro", hrefs: ["/lavagestor/pagamentos", "/lavagestor/financeiro", "/lavagestor/comissoes", "/lavagestor/vales", "/lavagestor/pagamentos-integrados", "/lavagestor/notas-fiscais"] },
  { label: "Crescimento", hrefs: ["/lavagestor/whatsapp", "/lavagestor/pos-venda", "/lavagestor/automacoes", "/lavagestor/iamob"] },
  { label: "Sistema", hrefs: ["/lavagestor/relatorios", "/lavagestor/usuarios", "/lavagestor/setup-facil", "/lavagestor/configuracoes"] }
];

export async function LavaGestorShell({
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
  const { current, perfil } = await requireLavaGestorAccess(activePath);
  const effectivePermissions = new Set(getEffectiveLavaPermissions(perfil));
  const visibleNavGroups = getVisibleNavGroups(effectivePermissions);
  const canSeeFila = effectivePermissions.has("fila.ver");
  const displayUserName = userName || current.usuario.nome;
  const displayRoleLabel = roleLabel && !["funcionario", "usuario"].includes(roleLabel.toLowerCase())
    ? roleLabel
    : labelLavaPerfil(perfil);

  return (
    <div className="lavagestor-module min-h-screen overflow-x-hidden bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden h-screen w-72 flex-col border-r border-border bg-card px-4 py-5 lg:flex">
        <Link className="block shrink-0" href={canSeeFila ? "/lavagestor/fila" : "/lavagestor"}>
          <div className="text-xl font-bold tracking-tight text-primary">LavaGestor</div>
          <div className="mt-1 truncate text-sm text-muted-foreground" title={companyName}>{companyName}</div>
        </Link>

        <nav className="mt-8 min-h-0 flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
          {visibleNavGroups.map((group) => (
            <div className="grid gap-1" key={group.label}>
              <p className="px-3 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
              {group.items.map((item) => (
                <LavaNavLink activePath={activePath} item={item} key={item.href} />
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto shrink-0 overflow-hidden rounded-lg border border-border bg-muted/50 p-3">
          {displayUserName ? <p className="truncate text-sm font-semibold" title={displayUserName}>{displayUserName}</p> : null}
          {displayRoleLabel ? <p className="truncate text-xs text-muted-foreground" title={displayRoleLabel}>{displayRoleLabel}</p> : null}
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
          <Link className="min-w-0" href={canSeeFila ? "/lavagestor/fila" : "/lavagestor"}>
            <div className="truncate font-bold text-primary">LavaGestor</div>
            <div className="truncate text-xs text-muted-foreground" title={companyName}>{companyName}</div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            {canSeeFila ? (
              <Link className="rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold" href="/lavagestor/fila">
                Fila
              </Link>
            ) : null}
            <details className="group relative">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-white shadow-sm [&::-webkit-details-marker]:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" aria-hidden />
              </summary>
              <div className="absolute right-0 top-12 z-40 grid max-h-[calc(100vh-5rem)] w-72 gap-1 overflow-y-auto rounded-xl border border-border bg-white p-2 shadow-xl">
                {visibleNavGroups.map((group, index) => (
                  <details className="rounded-lg border border-border/70 bg-white" key={group.label} open={index === 0 || group.items.some((item) => isActivePath(activePath, item.href))}>
                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground [&::-webkit-details-marker]:hidden">
                      {group.label}
                      <Boxes className="h-4 w-4 text-primary" aria-hidden />
                    </summary>
                    <div className="grid gap-1 border-t border-border/70 p-1">
                      {group.items.map((item) => (
                        <LavaNavLink activePath={activePath} item={item} key={`${item.href}-dropdown`} mobile />
                      ))}
                    </div>
                  </details>
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

function getVisibleNavGroups(effectivePermissions: Set<LavaPermission>) {
  const canSee = (item: LavaNavItem) => {
    if (item.permission && effectivePermissions.has(item.permission)) return true;
    if (item.anyOf?.some((permission) => effectivePermissions.has(permission))) return true;
    return !item.permission && !item.anyOf;
  };

  return lavaNavGroupsConfig
    .map((group) => ({
      label: group.label,
      items: group.hrefs
        .map((href) => lavaNavItems.find((item) => item.href === href))
        .filter((item): item is LavaNavItem => Boolean(item))
        .filter(canSee)
    }))
    .filter((group) => group.items.length > 0);
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
  const active = isActivePath(activePath, item.href);

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

function isActivePath(activePath: string, href: string) {
  return href === "/lavagestor" ? activePath === href : activePath.startsWith(href);
}

function labelLavaPerfil(perfil: LavaPerfil) {
  const labels: Record<LavaPerfil, string> = {
    admin_master: "Admin Master",
    admin_empresa: "Admin da empresa",
    dono: "Dono",
    gerente: "Gerente",
    operador: "Operador",
    caixa: "Caixa",
    lavador: "Lavador",
    visualizador: "Visualizador",
    usuario: "Usuário"
  };

  return labels[perfil] ?? perfil;
}
