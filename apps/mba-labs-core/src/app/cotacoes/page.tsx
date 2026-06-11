import { AppNav } from "@/components/AppNav";
import { ModuleDashboard, PageHeader, StatCard } from "@/components/ui-kit";
import { getCotacoesDashboard } from "@/lib/cotacoes-data";

export const dynamic = "force-dynamic";

export default async function CotacoesPortalPage() {
  const stats = await getCotacoesDashboard();

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <PageHeader
          eyebrow="MBA Cotações"
          title="Central de cotações"
          description="Cadastre produtos e vendedores, abra cotações e acompanhe pedidos gerados para a sua empresa."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Produtos ativos" value={stats.produtos} />
          <StatCard label="Vendedores ativos" value={stats.vendedores} />
          <StatCard label="Abertas" value={stats.abertas} />
          <StatCard label="Finalizadas" value={stats.finalizadas} />
          <StatCard label="Pedidos" value={stats.pedidos} />
        </div>

        <ModuleDashboard
          items={[
            {
              title: "Nova Cotação",
              description: "Crie uma nova solicitação com produtos, quantidades e observações.",
              href: "/cotacoes/nova",
              badge: "ação rápida"
            },
            {
              title: "Produtos",
              description: "Cadastre medicamentos, EAN, laboratório e apresentação.",
              href: "/cotacoes/produtos"
            },
            {
              title: "Vendedores",
              description: "Mantenha os contatos que responderão suas cotações.",
              href: "/cotacoes/vendedores"
            },
            {
              title: "Cotações Abertas",
              description: "Veja o que ainda está em negociação.",
              href: "/cotacoes/abertas",
              badge: String(stats.abertas)
            },
            {
              title: "Cotações Finalizadas",
              description: "Consulte o histórico já encerrado.",
              href: "/cotacoes/finalizadas",
              badge: String(stats.finalizadas)
            },
            {
              title: "Pedidos Gerados",
              description: "Acompanhe pedidos vindos das melhores respostas.",
              href: "/cotacoes/pedidos",
              badge: String(stats.pedidos)
            }
          ]}
        />
      </section>
    </main>
  );
}
