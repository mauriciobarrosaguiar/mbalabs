import Link from "next/link";
import {
  Banknote,
  Car,
  ClipboardList,
  Gauge,
  HandCoins,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  Sparkles,
  Users,
  Wrench
} from "lucide-react";
import { formatDate, formatMoney } from "@/components/ui-kit";
import { getLavaDashboard } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/lavagestor", label: "Dashboard", icon: LayoutDashboard, active: true },
  { href: "/lavagestor/nova-lavagem", label: "Nova lavagem", icon: Car },
  { href: "/lavagestor/lavagens", label: "Lavagens", icon: ClipboardList },
  { href: "/lavagestor/clientes", label: "Clientes", icon: Users },
  { href: "/lavagestor/veiculos", label: "Veiculos", icon: Car },
  { href: "/lavagestor/funcionarios", label: "Funcionarios", icon: Wrench },
  { href: "/lavagestor/servicos", label: "Servicos", icon: Sparkles },
  { href: "/lavagestor/comissoes", label: "Comissoes", icon: HandCoins },
  { href: "/lavagestor/vales", label: "Vales", icon: Banknote }
];

const futureItems = [
  { label: "Recibos", icon: ReceiptText },
  { label: "Relatorios", icon: Gauge },
  { label: "Configuracoes", icon: Settings }
];

export default async function LavaGestorPortalPage() {
  const dashboard = await getLavaDashboard();
  const user = dashboard.current.usuario;
  const roleLabel = labelRole(dashboard.current.tipo);

  const metrics = [
    { label: "Lavagens hoje", value: dashboard.lavagensHoje },
    { label: "Entrada hoje", value: formatMoney(dashboard.entradaHoje), tone: "success" },
    { label: "Lavagens no mes", value: dashboard.lavagensMes },
    { label: "Entrada no mes", value: formatMoney(dashboard.entradaMes), tone: "success" },
    { label: "Comissoes pendentes", value: formatMoney(dashboard.totalComissoesPendentes), tone: "warning" },
    { label: "Vales em aberto", value: formatMoney(dashboard.totalValesAbertos), tone: "warning" },
    { label: "Clientes", value: dashboard.clientes },
    { label: "Funcionarios ativos", value: dashboard.funcionarios }
  ];

  const quickLinks = [
    ["Nova lavagem", "/lavagestor/nova-lavagem"],
    ["Clientes", "/lavagestor/clientes"],
    ["Veiculos", "/lavagestor/veiculos"],
    ["Funcionarios", "/lavagestor/funcionarios"],
    ["Servicos", "/lavagestor/servicos"],
    ["Lavagens", "/lavagestor/lavagens"],
    ["Comissoes", "/lavagestor/comissoes"],
    ["Vales", "/lavagestor/vales"]
  ];

  return (
    <div className="lavagestor-module min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-border bg-card px-4 py-5 lg:block">
        <Link className="block" href="/lavagestor">
          <div className="text-xl font-bold tracking-tight text-primary">LavaGestor</div>
          <div className="mt-1 text-sm text-muted-foreground">{dashboard.companyName}</div>
        </Link>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                aria-current={item.active ? "page" : undefined}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition hover:bg-muted"
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-border pt-4">
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Em breve</p>
          <div className="mt-2 space-y-1">
            {futureItems.map((item) => {
              const Icon = item.icon;
              return (
                <span
                  aria-disabled="true"
                  className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-muted-foreground"
                  key={item.label}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-5 rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-sm font-semibold">{user.nome}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
          <Link className="mt-3 flex min-h-10 items-center justify-center rounded-lg bg-white px-3 text-sm font-semibold shadow-sm" href="/dashboard">
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
          <div>
            <div className="font-bold text-primary">LavaGestor</div>
            <div className="text-xs text-muted-foreground">{dashboard.companyName}</div>
          </div>
          <form action="/sair" method="post">
            <button className="rounded-lg border border-border bg-white p-2" aria-label="Sair">
              <LogOut className="h-5 w-5" aria-hidden />
            </button>
          </form>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                aria-current={item.active ? "page" : undefined}
                className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-muted px-3 text-sm font-semibold"
                href={item.href}
                key={`${item.href}-mobile`}
              >
                <Icon className="h-4 w-4 text-primary" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="px-4 py-6 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {dashboard.isGlobalView ? "Visao consolidada" : "Painel da empresa"}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard do dono</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Resumo simples para acompanhar o dia, o mes e os valores a pagar.
              </p>
            </div>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground shadow-sm" href="/lavagestor/nova-lavagem">
              Nova lavagem
            </Link>
          </div>

          {dashboard.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
              {dashboard.error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} label={metric.label} tone={metric.tone} value={metric.value} />
            ))}
          </div>

          <Panel title="Acoes rapidas">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {quickLinks.map(([label, href]) => (
                <Link
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border bg-white px-4 py-3 text-base font-semibold shadow-sm transition hover:bg-muted"
                  href={href}
                  key={href}
                >
                  {label}
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Ultimas lavagens">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3">Veiculo</th>
                    <th className="py-2 pr-3">Servico</th>
                    <th className="py-2 pr-3">Funcionario</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dashboard.ultimasLavagens.length === 0 ? (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={7}>
                        Nenhuma lavagem registrada ainda.
                      </td>
                    </tr>
                  ) : (
                    dashboard.ultimasLavagens.map((wash) => (
                      <tr key={String(wash.id)}>
                        <td className="py-3 pr-3">{formatDate(wash.data_lavagem)}</td>
                        <td className="py-3 pr-3">{wash.cliente}</td>
                        <td className="py-3 pr-3">{wash.veiculo}</td>
                        <td className="py-3 pr-3">{wash.servico}</td>
                        <td className="py-3 pr-3">{wash.funcionario}</td>
                        <td className="py-3 pr-3">{String(wash.status ?? "-")}</td>
                        <td className="py-3 pr-3 font-semibold">{formatMoney(wash.valor)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-border bg-card";

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Panel({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function labelRole(role: string) {
  const labels: Record<string, string> = {
    admin_master: "Admin Master",
    super_admin: "Admin Master",
    admin_empresa: "Admin da empresa",
    operador: "Operador",
    usuario: "Usuario"
  };

  return labels[role] ?? role;
}
