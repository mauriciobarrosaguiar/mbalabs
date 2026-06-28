import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { formatDate, formatMoney } from "@/components/ui-kit";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";
import { getLavaDashboard } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

type MetricTone = "default" | "success" | "warning";

type Metric = {
  label: string;
  value: string | number;
  tone?: MetricTone;
};

export default async function LavaGestorPortalPage() {
  const [dashboard, { config }] = await Promise.all([getLavaDashboard(), getLavaConfiguracoesEmpresa()]);
  const user = dashboard.current.usuario;
  const roleLabel = labelRole(dashboard.current.tipo);
  const companyName = config.nome_exibicao || dashboard.companyName;

  const metrics: Metric[] = [
    { label: "Hoje", value: dashboard.lavagensHoje },
    { label: "Entrada hoje", value: formatMoney(dashboard.entradaHoje), tone: "success" },
    { label: "Mês", value: dashboard.lavagensMes },
    { label: "Entrada mês", value: formatMoney(dashboard.entradaMes), tone: "success" },
    { label: "Na fila", value: dashboard.veiculosNaFila },
    { label: "Lavando", value: dashboard.veiculosEmLavagem },
    { label: "Finalizados", value: dashboard.finalizadosAguardandoRetirada },
    { label: "Aberto", value: dashboard.pagamentosEmAberto, tone: "warning" },
    { label: "Comissões", value: formatMoney(dashboard.totalComissoesPendentes), tone: "warning" },
    { label: "Vales", value: formatMoney(dashboard.totalValesAbertos), tone: "warning" }
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
          <Link className="button-primary min-h-11 w-full justify-center rounded-xl text-base font-black" href="/lavagestor/nova-lavagem">Nova lavagem</Link>
        </div>

        {dashboard.error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{dashboard.error}</div> : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => <MetricCard key={metric.label} label={metric.label} tone={metric.tone} value={metric.value} />)}
        </div>

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

function MetricCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: MetricTone }) {
  const toneClass = tone === "success" ? "border-emerald-200 bg-emerald-50" : tone === "warning" ? "border-amber-200 bg-amber-50" : "border-border bg-card";
  return (
    <div className={`min-h-[86px] rounded-xl border p-3 shadow-sm sm:min-h-[110px] sm:p-4 ${toneClass}`}>
      <p className="truncate text-xs font-bold text-muted-foreground sm:text-sm">{label}</p>
      <p className="mt-2 break-words text-[1.45rem] font-black leading-tight tracking-tight sm:text-2xl">{value}</p>
    </div>
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
