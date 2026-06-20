import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { DataTable, MessageBanner, PageHeader, StatCard, formatDate, formatMoney } from "@/components/ui-kit";
import { canPortalAccess, getPortalDashboard } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalAssociativoPage() {
  const dashboard = await getPortalDashboard();
  if (!canPortalAccess(dashboard.perfil, "dashboard")) {
    redirect("/portal-associativo/painel-associado");
  }

  const metrics = [
    { label: "Loteamentos", value: dashboard.metrics.totalLoteamentos },
    { label: "Chácaras/lotes", value: dashboard.metrics.totalUnidades },
    { label: "Chácaras/lotes ativos", value: dashboard.metrics.unidadesAtivas },
    { label: "Associados ativos", value: dashboard.metrics.associadosAtivos },
    { label: "Recebido no mês", value: formatMoney(dashboard.metrics.recebidoMes) },
    { label: "Total em aberto", value: formatMoney(dashboard.metrics.totalEmAberto) },
    { label: "Total vencido", value: formatMoney(dashboard.metrics.totalVencido) },
    { label: "Aguardando pagamento", value: dashboard.metrics.cobrancasAguardandoPagamento }
  ];

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo"
      can={(section) => canPortalAccess(dashboard.perfil, section)}
      companyName={dashboard.companyName}
      roleLabel={dashboard.perfilLabel}
      userName={dashboard.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Dashboard"
          description="Visão operacional de loteamentos, chácaras/lotes, associados, mensalidades, inadimplência e auditoria."
        />
        <MessageBanner error={dashboard.error ?? undefined} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <StatCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Inadimplência por loteamento">
            <MiniRanking rows={dashboard.inadimplenciaPorLoteamento} />
          </Panel>
          <Panel title="Inadimplência por chácara/lote">
            <MiniRanking rows={dashboard.inadimplenciaPorUnidade} />
          </Panel>
          <Panel title="Inadimplência por responsável">
            <MiniRanking rows={dashboard.inadimplenciaPorResponsavel} />
          </Panel>
        </div>

        <Panel title="Últimas mensalidades">
          <DataTable
            columns={[
              { key: "descricao", label: "Descrição" },
              { key: "loteamento", label: "Loteamento" },
              { key: "unidade", label: "Chácara/Lote" },
              { key: "responsavel", label: "Responsável" },
              { key: "data_vencimento", label: "Vencimento" },
              { key: "valor_total", label: "Valor" },
              { key: "status", label: "Status" }
            ]}
            rows={dashboard.ultimasCobrancas.map((row) => ({
              ...row,
              loteamento: relationName(row.assoc_loteamentos),
              unidade: unitLabel(row.assoc_unidades),
              responsavel: relationName(row.assoc_pessoas),
              data_vencimento: formatDate(row.data_vencimento),
              valor_total: formatMoney(row.valor_total)
            }))}
          />
        </Panel>

        <Panel title="Últimos registros de auditoria">
          <DataTable
            columns={[
              { key: "acao", label: "Ação" },
              { key: "entidade", label: "Entidade" },
              { key: "criado_em", label: "Criado em" }
            ]}
            rows={dashboard.ultimosLogs.map((row) => ({ ...row, criado_em: formatDate(row.criado_em) }))}
          />
        </Panel>
      </section>
    </PortalAssociativoShell>
  );
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}

function relationName(value: unknown) {
  const relation = relationObject(value);
  return String(relation?.nome_completo ?? relation?.nome ?? "");
}

function unitLabel(value: unknown) {
  const unit = relationObject(value);
  return [unit?.codigo_unidade, unit?.numero_unidade].filter(Boolean).join(" - ") || "-";
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MiniRanking({ rows }: { rows: Array<{ label: string; total: number }> }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum valor vencido encontrado.</p>;
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3 text-sm" key={row.label}>
          <span className="min-w-0 truncate font-semibold" title={row.label}>{row.label}</span>
          <strong>{formatMoney(row.total)}</strong>
        </div>
      ))}
    </div>
  );
}
