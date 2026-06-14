import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, PageHeader, StatCard, formatMoney } from "@/components/ui-kit";
import { getLavaDashboard } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const dashboard = await getLavaDashboard();

  return (
    <LavaGestorShell activePath="/lavagestor/relatorios" companyName={dashboard.companyName}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Relatórios"
          description="Resumo operacional para acompanhar receita, lavagens, pagamentos, comissões e vales."
          actions={
            <>
              <BackButton href="/lavagestor" />
              <Link className="button-primary" href="/lavagestor/fila">
                Ver fila
              </Link>
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Lavagens hoje" value={dashboard.lavagensHoje} />
          <StatCard label="Entrada hoje" value={formatMoney(dashboard.entradaHoje)} />
          <StatCard label="Lavagens no mês" value={dashboard.lavagensMes} />
          <StatCard label="Entrada no mês" value={formatMoney(dashboard.entradaMes)} />
          <StatCard label="Pagamentos em aberto" value={dashboard.pagamentosEmAberto} />
          <StatCard label="Comissões pendentes" value={formatMoney(dashboard.totalComissoesPendentes)} />
          <StatCard label="Vales em aberto" value={formatMoney(dashboard.totalValesAbertos)} />
          <StatCard label="Aguardando retirada" value={dashboard.finalizadosAguardandoRetirada} />
        </div>
      </section>
    </LavaGestorShell>
  );
}
