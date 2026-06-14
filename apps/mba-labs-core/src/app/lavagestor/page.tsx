import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { formatDate, formatMoney } from "@/components/ui-kit";
import { getLavaDashboard } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function LavaGestorPortalPage() {
  const dashboard = await getLavaDashboard();
  const user = dashboard.current.usuario;
  const roleLabel = labelRole(dashboard.current.tipo);

  const metrics = [
    { label: "Lavagens hoje", value: dashboard.lavagensHoje },
    { label: "Entrada hoje", value: formatMoney(dashboard.entradaHoje), tone: "success" },
    { label: "Lavagens no mês", value: dashboard.lavagensMes },
    { label: "Entrada no mês", value: formatMoney(dashboard.entradaMes), tone: "success" },
    { label: "Veículos na fila", value: dashboard.veiculosNaFila },
    { label: "Veículos em lavagem", value: dashboard.veiculosEmLavagem },
    { label: "Finalizados aguardando retirada", value: dashboard.finalizadosAguardandoRetirada },
    { label: "Pagamentos em aberto", value: dashboard.pagamentosEmAberto, tone: "warning" },
    { label: "Comissões pendentes", value: formatMoney(dashboard.totalComissoesPendentes), tone: "warning" },
    { label: "Vales em aberto", value: formatMoney(dashboard.totalValesAbertos), tone: "warning" }
  ];

  const quickLinks = [
    ["Nova lavagem", "/lavagestor/nova-lavagem"],
    ["Fila de lavagem", "/lavagestor/fila"],
    ["Clientes", "/lavagestor/clientes"],
    ["Relatórios", "/lavagestor/relatorios"]
  ];

  return (
    <LavaGestorShell
      activePath="/lavagestor"
      companyName={dashboard.companyName}
      userName={user.nome}
      roleLabel={roleLabel}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {dashboard.isGlobalView ? "Visão consolidada" : "Painel da empresa"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard LavaGestor</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Resumo simples para acompanhar lavagens, fila, pagamentos, comissões e vales.
            </p>
          </div>
          <Link className="button-primary min-h-12" href="/lavagestor/nova-lavagem">
            Nova lavagem
          </Link>
        </div>

        {dashboard.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
            {dashboard.error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => (
            <MetricCard key={metric.label} label={metric.label} tone={metric.tone} value={metric.value} />
          ))}
        </div>

        <Panel title="Ações rápidas">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map(([label, href]) => (
              <Link
                className="inline-flex min-h-14 items-center justify-center rounded-lg border border-border bg-white px-4 py-3 text-base font-semibold shadow-sm transition hover:bg-muted"
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Últimas lavagens">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Veículo</th>
                  <th className="py-2 pr-3">Serviço</th>
                  <th className="py-2 pr-3">Funcionário</th>
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
                      <td className="py-3 pr-3">{wash.status_label}</td>
                      <td className="py-3 pr-3 font-semibold">{formatMoney(wash.valor)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </LavaGestorShell>
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
    usuario: "Usuário"
  };

  return labels[role] ?? role;
}
