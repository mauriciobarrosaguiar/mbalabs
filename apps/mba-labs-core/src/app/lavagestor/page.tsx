import { AppNav } from "@/components/AppNav";
import { ModuleDashboard, PageHeader, StatCard } from "@/components/ui-kit";
import { getLavaDashboard } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function LavaGestorPortalPage() {
  const stats = await getLavaDashboard();

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <PageHeader
          eyebrow="LavaGestor"
          title="Gestão de lavagens"
          description="Controle clientes, veículos, serviços, lavagens, comissões e vales dentro do portal MBA Labs."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Clientes" value={stats.clientes} />
          <StatCard label="Veículos" value={stats.veiculos} />
          <StatCard label="Funcionários ativos" value={stats.funcionarios} />
          <StatCard label="Comissões pendentes" value={stats.comissoes} />
        </div>

        <ModuleDashboard
          items={[
            {
              title: "Nova Lavagem",
              description: "Registre uma lavagem e calcule a comissão automaticamente.",
              href: "/lavagestor/nova-lavagem",
              badge: "ação rápida"
            },
            {
              title: "Clientes",
              description: "Cadastre clientes com telefone, email, documento e observações.",
              href: "/lavagestor/clientes",
              badge: String(stats.clientes)
            },
            {
              title: "Veículos",
              description: "Vincule veículos aos clientes para agilizar novas lavagens.",
              href: "/lavagestor/veiculos",
              badge: String(stats.veiculos)
            },
            {
              title: "Funcionários",
              description: "Cadastre lavadores e percentuais de comissão.",
              href: "/lavagestor/funcionarios",
              badge: String(stats.funcionarios)
            },
            {
              title: "Serviços",
              description: "Configure preços e regras de comissão por serviço.",
              href: "/lavagestor/servicos",
              badge: String(stats.servicos)
            },
            {
              title: "Lavagens",
              description: "Veja o histórico e filtre por data, funcionário e status.",
              href: "/lavagestor/lavagens",
              badge: String(stats.lavagens)
            },
            {
              title: "Comissões",
              description: "Acompanhe valores pendentes e pagos por funcionário.",
              href: "/lavagestor/comissoes",
              badge: String(stats.comissoes)
            },
            {
              title: "Vales",
              description: "Registre adiantamentos e marque descontos.",
              href: "/lavagestor/vales",
              badge: String(stats.vales)
            }
          ]}
        />
      </section>
    </main>
  );
}
