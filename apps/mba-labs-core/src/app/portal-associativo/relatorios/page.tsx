import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, MessageBanner, PageHeader, StatCard, formatMoney } from "@/components/ui-kit";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalRelatorios } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalRelatoriosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const data = await getPortalRelatorios();
  if (!canPortalAccess(data.perfil, "relatorios")) {
    redirect("/portal-associativo/painel-associado");
  }

  const stats = [
    { label: "Total de cobrancas", value: data.resumo.totalCobrancas },
    { label: "Pago", value: formatMoney(data.resumo.totalPago) },
    { label: "Em aberto", value: formatMoney(data.resumo.totalAberto) },
    { label: "Vencido", value: formatMoney(data.resumo.totalVencido) },
    { label: "Unidades", value: data.resumo.totalUnidades }
  ];

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/relatorios"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Relatorios"
          description="Acompanhe inadimplencia, cobrancas pagas, vencidas e totais por unidade ou responsavel."
          actions={
            <>
              <Link className="button-secondary" href="/api/portal-associativo/export?tipo=cobrancas">CSV cobrancas</Link>
              <Link className="button-secondary" href="/api/portal-associativo/export?tipo=inadimplencia">CSV inadimplencia</Link>
              <BackButton href="/portal-associativo" />
            </>
          }
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Panel title="Inadimplencia">
            <MiniTable rows={data.inadimplencia} />
          </Panel>
          <Panel title="Por unidade">
            <MiniTable rows={data.porUnidade} />
          </Panel>
          <Panel title="Por responsavel">
            <MiniTable rows={data.porResponsavel} />
          </Panel>
        </div>

        <DataTable
          columns={[
            { key: "descricao", label: "Descricao" },
            { key: "unidade", label: "Unidade" },
            { key: "responsavel", label: "Responsavel" },
            { key: "status", label: "Status" },
            { key: "valor_total", label: "Valor" }
          ]}
          rows={data.rows.map((row) => ({ ...row, valor_total: formatMoney(row.valor_total) }))}
        />
      </section>
    </PortalAssociativoShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MiniTable({ rows }: { rows: Array<{ label: string; total: number }> }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>;
  }
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-3 text-sm" key={row.label}>
          <span className="min-w-0 truncate" title={row.label}>{row.label}</span>
          <strong>{formatMoney(row.total)}</strong>
        </div>
      ))}
    </div>
  );
}
