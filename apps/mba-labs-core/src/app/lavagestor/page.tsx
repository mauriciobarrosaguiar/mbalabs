import Link from "next/link";
import { redirect } from "next/navigation";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { MessageBanner, formatDate, formatMoney } from "@/components/ui-kit";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { getLavaDashboard } from "@/lib/lavagestor-data";
import { getLavaDefaultRoute, requireLavaGestorAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

type MetricTone = "default" | "success" | "warning";

type Metric = {
  label: string;
  value: string | number;
  tone?: MetricTone;
  href: string;
};

export default async function LavaGestorPortalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const access = await requireLavaGestorAccess("/lavagestor");
  const defaultRoute = getLavaDefaultRoute(access.perfil);

  if (defaultRoute !== "/lavagestor") {
    redirect(defaultRoute);
  }

  const [dashboard, { config }] = await Promise.all([getLavaDashboard(), getLavaConfiguracoesEmpresa()]);
  const user = dashboard.current.usuario;
  const roleLabel = labelRole(dashboard.current.tipo);
  const companyName = config.nome_exibicao || dashboard.companyName;

  const metrics: Metric[] = [
    { label: "Lavagens hoje", value: dashboard.lavagensHoje, href: "/lavagestor/lavagens" },
    { label: "Entrada hoje", value: formatMoney(dashboard.entradaHoje), tone: "success", href: "/lavagestor/financeiro" },
    { label: "Em lavagem", value: dashboard.veiculosEmLavagem, href: "/lavagestor/fila" },
    { label: "Aguardando retirada", value: dashboard.finalizadosAguardandoRetirada, href: "/lavagestor/fila" },
    { label: "A receber", value: formatMoney(dashboard.aReceber), tone: "warning", href: "/lavagestor/pagamentos" },
    { label: "Fiado", value: formatMoney(dashboard.fiado), tone: "warning", href: "/lavagestor/pagamentos" },
    { label: "Ticket médio", value: formatMoney(dashboard.ticketMedio), tone: "success", href: "/lavagestor/relatorios" },
    { label: "Clientes no mês", value: dashboard.clientesAtendidosMes, href: "/lavagestor/clientes" },
    { label: "Retorno de clientes", value: dashboard.retornoClientes, href: "/lavagestor/pos-venda" },
    { label: "Agendamentos hoje", value: dashboard.agendamentosHoje, href: "/lavagestor/agendamentos?periodo=hoje" },
    { label: "Estoque baixo", value: dashboard.estoqueBaixo, tone: "warning", href: "/lavagestor/estoque" },
    { label: "Cobranças pendentes", value: dashboard.cobrancasPendentes, tone: "warning", href: "/lavagestor/pagamentos-integrados" },
    { label: "Automação pendente", value: dashboard.automacaoPendente, tone: "warning", href: "/lavagestor/automacoes" },
    { label: "Comissões pendentes", value: formatMoney(dashboard.totalComissoesPendentes), tone: "warning", href: "/lavagestor/comissoes" }
  ];

  return (
    <LavaGestorShell activePath="/lavagestor" companyName={companyName} userName={user.nome} roleLabel={roleLabel}>
      <Link className="fixed right-4 top-[4.25rem] z-20 rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-primary shadow-md lg:hidden" href="/lavagestor/fila">Fila</Link>
      <div className="space-y-5">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">{dashboard.isGlobalView ? "Consolidado" : "Painel"}</p>
            <h1 className="mt-1 pr-20 text-[2rem] font-black leading-none tracking-tight sm:pr-0 sm:text-3xl">Dashboard LavaGestor</h1>
          </div>
          <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
            <form className="grid gap-2 sm:grid-cols-[1fr_auto]" action="/lavagestor/busca">
              <input className="input min-h-11 text-base" name="q" placeholder="Buscar placa, cliente ou telefone" />
              <button className="button-secondary" type="submit">Buscar</button>
            </form>
            <Link className="button-primary min-h-11 justify-center rounded-xl text-base font-black" href="/lavagestor/nova-lavagem">Nova lavagem</Link>
          </div>
        </div>

        <MessageBanner error={firstParam(params.error)} />
        {dashboard.error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{dashboard.error}</div> : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => <MetricCard key={metric.label} href={metric.href} label={metric.label} tone={metric.tone} value={metric.value} />)}
        </div>

        <Panel title="IAMob recomenda">
          {dashboard.recomendacoesPremium.length === 0 ? (
            <p className="rounded-lg bg-muted p-4 text-sm font-semibold text-muted-foreground">Sem recomendações críticas agora.</p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {dashboard.recomendacoesPremium.map((item: any) => (
                <Link className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm font-black text-emerald-950 shadow-sm" href={item.href} key={item.label}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {dashboard.alertas.length ? (
          <Panel title="Alertas">
            <div className="grid gap-2 md:grid-cols-2">
              {dashboard.alertas.map((alerta: any) => (
                <Link className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-black text-amber-950 shadow-sm" href={alerta.href} key={alerta.label}>
                  {alerta.label}
                </Link>
              ))}
            </div>
          </Panel>
        ) : null}

        <Panel title="Últimas lavagens">
          {dashboard.ultimasLavagens.length === 0 ? (
            <p className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">Nenhuma lavagem registrada ainda.</p>
          ) : (
            <>
              <div className="grid gap-3 lg:hidden">
                {dashboard.ultimasLavagens.map((wash) => (
                  <article className="rounded-xl border border-border bg-white p-3 shadow-sm" key={String(wash.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black">{wash.cliente}</h3>
                        <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">{wash.veiculo}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#dff7ec] px-2 py-1 text-[10px] font-black text-[#0f5132]">{wash.status_label}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <MobileInfo label="Data" value={formatDate(wash.data_lavagem)} />
                      <MobileInfo label="Valor" value={formatMoney(wash.valor)} strong />
                      <MobileInfo label="Serviço" value={String(wash.servico ?? "-")} />
                      <MobileInfo label="Funcionário" value={String(wash.funcionario ?? "-")} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link className="button-secondary justify-center" href={`/lavagestor/tickets/${wash.id}`}>Ticket</Link>
                      <Link className="button-secondary justify-center" href={`/lavagestor/checklists/${wash.id}`}>Checklist</Link>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto lg:block">
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
                      <th className="py-2 pr-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dashboard.ultimasLavagens.map((wash) => (
                      <tr key={String(wash.id)}>
                        <td className="py-3 pr-3">{formatDate(wash.data_lavagem)}</td>
                        <td className="py-3 pr-3">{wash.cliente}</td>
                        <td className="py-3 pr-3">{wash.veiculo}</td>
                        <td className="py-3 pr-3">{wash.servico}</td>
                        <td className="py-3 pr-3">{wash.funcionario}</td>
                        <td className="py-3 pr-3">{wash.status_label}</td>
                        <td className="py-3 pr-3 font-semibold">{formatMoney(wash.valor)}</td>
                        <td className="py-3 pr-3"><Link className="button-secondary" href={`/lavagestor/tickets/${wash.id}`}>Ticket</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>
    </LavaGestorShell>
  );
}

function MetricCard({ href, label, value, tone = "default" }: { href: string; label: string; value: string | number; tone?: MetricTone }) {
  const toneClass = tone === "success" ? "border-emerald-200 bg-emerald-50" : tone === "warning" ? "border-amber-200 bg-amber-50" : "border-border bg-card";
  return (
    <Link className={`block min-h-[86px] rounded-xl border p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:min-h-[110px] sm:p-4 ${toneClass}`} href={href}>
      <p className="text-xs font-bold text-muted-foreground sm:text-sm">{label}</p>
      <p className="mt-2 break-words text-[1.45rem] font-black leading-tight tracking-tight sm:text-2xl">{value}</p>
    </Link>
  );
}

function MobileInfo({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-muted px-2.5 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate ${strong ? "font-black" : "font-semibold"}`}>{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4"><h2 className="text-base font-black sm:text-lg">{title}</h2><div className="mt-3">{children}</div></section>;
}

function labelRole(role: string) {
  const labels: Record<string, string> = { admin_master: "Admin Master", super_admin: "Admin Master", admin_empresa: "Admin da empresa", operador: "Operador", usuario: "Usuário" };
  return labels[role] ?? role;
}
