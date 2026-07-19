import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowDownRight, ArrowUpRight, BadgeDollarSign, TriangleAlert, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { canPortalAccess, getPortalDashboard, getPortalOnboarding } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

type FeaturedMetric = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  note: string;
  tone: "positive" | "warning" | "negative";
  trend: string;
  value: string | number;
};

export default async function PortalAssociativoPage() {
  const dashboard = await getPortalDashboard();
  if (!canPortalAccess(dashboard.perfil, "dashboard")) {
    redirect("/portal-associativo/painel-associado");
  }
  const onboarding = await getPortalOnboarding();

  const metrics = [
    { label: "Loteamentos", value: dashboard.metrics.totalLoteamentos },
    { label: "Total de unidades", value: dashboard.metrics.totalUnidades },
    { label: "Unidades ativas", value: dashboard.metrics.unidadesAtivas },
    { label: "Associados ativos", value: dashboard.metrics.associadosAtivos },
    { label: "Pessoas sem unidade", value: dashboard.metrics.pessoasSemUnidade },
    { label: "Unidades sem responsável financeiro", value: dashboard.metrics.unidadesSemResponsavelFinanceiro },
    { label: "Cobranças abertas", value: dashboard.metrics.cobrancasAbertas },
    { label: "Cobranças vencidas", value: dashboard.metrics.cobrancasVencidas },
    { label: "Recebido no mês", value: formatMoney(dashboard.metrics.recebidoMes) },
    { label: "Total em aberto", value: formatMoney(dashboard.metrics.totalEmAberto) },
    { label: "Total vencido", value: formatMoney(dashboard.metrics.totalVencido) },
    { label: "Cobranças aguardando pagamento", value: dashboard.metrics.cobrancasAguardandoPagamento },
    { label: "Avisos ativos", value: dashboard.metrics.avisosAtivos },
    { label: "Reuniões agendadas", value: dashboard.metrics.reunioesAgendadas }
  ];
  const delinquencyBase = Number(dashboard.metrics.totalEmAberto) + Number(dashboard.metrics.recebidoMes);
  const delinquencyRate = delinquencyBase > 0 ? `${((Number(dashboard.metrics.totalVencido) / delinquencyBase) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "0%";
  const featuredMetrics: FeaturedMetric[] = [
    {
      label: "Associados ativos",
      value: dashboard.metrics.associadosAtivos.toLocaleString("pt-BR"),
      trend: dashboard.metrics.pessoasSemUnidade ? `${dashboard.metrics.pessoasSemUnidade} sem unidade` : "Base organizada",
      note: `${dashboard.metrics.unidadesAtivas.toLocaleString("pt-BR")} unidades ativas`,
      tone: dashboard.metrics.pessoasSemUnidade ? "warning" : "positive",
      icon: UsersRound
    },
    {
      label: "Arrecadação do mês",
      value: formatMoney(dashboard.metrics.recebidoMes),
      trend: `${formatMoney(dashboard.metrics.totalEmAberto)} em aberto`,
      note: `${dashboard.metrics.cobrancasAguardandoPagamento.toLocaleString("pt-BR")} aguardando`,
      tone: "positive",
      icon: BadgeDollarSign
    },
    {
      label: "Inadimplência",
      value: delinquencyRate,
      trend: `${dashboard.metrics.cobrancasVencidas.toLocaleString("pt-BR")} vencidas`,
      note: formatMoney(dashboard.metrics.totalVencido),
      tone: dashboard.metrics.cobrancasVencidas ? "negative" : "positive",
      icon: TriangleAlert
    }
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
          description="Visão operacional de loteamentos, unidades, associados, mensalidades, inadimplência e auditoria - tudo em um só lugar."
        />
        <MessageBanner error={dashboard.error ?? undefined} />

        <div className="grid gap-6 md:grid-cols-3">
          {featuredMetrics.map((metric) => (
            <FeaturedMetricCard key={metric.label} {...metric} />
          ))}
        </div>

        {onboarding.shouldShow && dashboard.perfil !== "portaria" ? (
          <section className="panel grid gap-4 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Implantação guiada</p>
                <h2 className="text-2xl font-black">Prepare o Portal para usar com associados</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Complete os passos principais para configurar entidade, pessoas, unidades, mensalidades e acesso.
                </p>
              </div>
              <strong className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                {onboarding.completed}/{onboarding.total} passos
              </strong>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {onboarding.steps.map((step) => (
                <article className="grid gap-3 rounded-lg border border-border bg-muted/40 p-4" key={step.id}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-black">{step.title}</h3>
                    <span className={step.done ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700"}>
                      {step.done ? "Pronto" : "Pendente"}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                  <Link className={step.done ? "button-secondary w-fit" : "button-primary w-fit"} href={step.href === "/portal-associativo/configuracoes" ? "/portal-associativo/implantacao" : step.href}>
                    {step.action}
                  </Link>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <CompactMetricCard key={metric.label} label={metric.label} value={metric.value} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Inadimplência por loteamento">
            <MiniRanking rows={dashboard.inadimplenciaPorLoteamento} />
          </Panel>
          <Panel title="Inadimplência por unidade">
            <MiniRanking rows={dashboard.inadimplenciaPorUnidade} />
          </Panel>
          <Panel title="Inadimplência por responsável">
            <MiniRanking rows={dashboard.inadimplenciaPorResponsavel} />
          </Panel>
        </div>

        <Panel title="Alertas do sistema">
          {dashboard.alertas.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.alertas.map((alerta) => (
                <Link className="rounded-lg border border-border bg-muted/40 p-4 transition hover:border-primary/60" href={alerta.href} key={alerta.title}>
                  <strong className="block text-sm">{alerta.title}</strong>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground">{alerta.detail}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum alerta crítico encontrado.</p>
          )}
        </Panel>

        <Panel title="Últimas cobranças">
          <DataTable
            columns={[
              { key: "descricao", label: "Descrição" },
              { key: "loteamento", label: "Loteamento" },
              { key: "unidade", label: "Unidade" },
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

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Últimos pagamentos">
            <DataTable
              columns={[
                { key: "descricao", label: "Descrição" },
                { key: "unidade", label: "Unidade" },
                { key: "responsavel", label: "Responsável" },
                { key: "data_pagamento", label: "Pagamento" },
                { key: "valor_total", label: "Valor" }
              ]}
              rows={dashboard.ultimosPagamentos.map((row) => ({
                ...row,
                unidade: unitLabel(row.assoc_unidades),
                responsavel: relationName(row.assoc_pessoas),
                data_pagamento: formatDate(row.data_pagamento),
                valor_total: formatMoney(row.valor_total)
              }))}
            />
          </Panel>

          <Panel title="Últimos cadastros">
            <DataTable
              columns={[
                { key: "tipo", label: "Tipo" },
                { key: "nome", label: "Nome" },
                { key: "criado_em", label: "Criado em" }
              ]}
              rows={dashboard.ultimosCadastros.map((row) => ({ ...row, criado_em: formatDate(row.criado_em) }))}
            />
          </Panel>
        </div>

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

function FeaturedMetricCard({
  icon: Icon,
  label,
  note,
  tone,
  trend,
  value
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  note: string;
  tone: "positive" | "warning" | "negative";
  trend: string;
  value: string | number;
}) {
  const toneClass =
    tone === "negative"
      ? "bg-rose-50 text-rose-900"
      : tone === "warning"
        ? "bg-amber-50 text-amber-900"
        : "bg-emerald-50 text-emerald-950";
  const TrendIcon = tone === "negative" ? ArrowDownRight : ArrowUpRight;

  return (
    <article className="relative min-h-48 overflow-hidden rounded-[30px] border border-[#dfe6f0] bg-white p-7 shadow-[0_18px_42px_rgba(8,17,31,0.08)]">
      <div className="absolute -right-9 -top-10 h-32 w-32 rounded-full bg-[#f2f5fb]" aria-hidden />
      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-[#687385]">{label}</p>
            <strong className="mt-4 block text-4xl font-black tracking-tight text-[#08111f]">{value}</strong>
          </div>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef4ff] text-[#2f68c8]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 font-black ${toneClass}`}>
            <TrendIcon className="h-4 w-4" aria-hidden />
            {trend}
          </span>
          <span className="text-right font-semibold text-[#687385]">{note}</span>
        </div>
      </div>
    </article>
  );
}

function CompactMetricCard({ label, value }: { label: string | number; value: string | number }) {
  return (
    <article className="rounded-2xl border border-[#dfe6f0] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(8,17,31,0.045)]">
      <div className="text-xl font-black tracking-tight text-[#08111f]">{value}</div>
      <div className="mt-1 text-xs font-black uppercase tracking-wide text-[#687385]">{label}</div>
    </article>
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
