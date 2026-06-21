import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalLookups, listPortalInadimplentes, unitOptionLabel } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalInadimplentesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    q: firstParam(params.q) ?? "",
    unidade: firstParam(params.unidade) ?? "",
    responsavel: firstParam(params.responsavel) ?? "",
    mes: firstParam(params.mes) ?? "",
    status: firstParam(params.status) ?? "",
    valorMin: firstParam(params.valorMin) ?? "",
    valorMax: firstParam(params.valorMax) ?? ""
  };
  const data = await listPortalInadimplentes(filters);
  if (!canPortalAccess(data.perfil, "inadimplentes")) {
    redirect("/portal-associativo");
  }

  const lookups = await getPortalLookups("/portal-associativo/inadimplentes");
  const unitOptions = lookups.unidades.map((unit: Record<string, unknown>) => ({ value: String(unit.id), label: unitOptionLabel(unit) }));
  const personOptions = lookups.pessoas.map((person: Record<string, unknown>) => ({ value: String(person.id), label: String(person.nome_completo) }));

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/inadimplentes"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Inadimplentes"
          description="Acompanhe responsaveis com cobrancas vencidas, gere mensagens de cobranca e exporte relatorios."
          actions={
            <>
              <Link className="button-secondary" href="/api/portal-associativo/export?tipo=inadimplencia">CSV</Link>
              <Link className="button-secondary" href="/api/portal-associativo/export?tipo=inadimplencia&formato=pdf" target="_blank">PDF</Link>
              <BackButton href="/portal-associativo" />
            </>
          }
        />
        <MessageBanner error={data.error ?? undefined} />

        <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_170px_190px_150px_120px_120px_auto]" action="">
          <input className="input" name="q" defaultValue={filters.q} placeholder="Buscar responsavel, WhatsApp ou unidade" />
          <input className="input" name="mes" defaultValue={filters.mes} type="month" />
          <select className="input" name="unidade" defaultValue={filters.unidade}>
            <option value="">Todas as unidades</option>
            {unitOptions.map((option: { value: string; label: string }) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className="input" name="responsavel" defaultValue={filters.responsavel}>
            <option value="">Responsavel</option>
            {personOptions.map((option: { value: string; label: string }) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input className="input" name="valorMin" defaultValue={filters.valorMin} placeholder="Valor min." type="number" step="0.01" />
          <input className="input" name="valorMax" defaultValue={filters.valorMax} placeholder="Valor max." type="number" step="0.01" />
          <button className="button-secondary" type="submit">Filtrar</button>
        </form>

        <DataTable
          columns={[
            { key: "responsavel", label: "Responsavel" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "unidade", label: "Unidade" },
            { key: "quantidade_cobrancas", label: "Vencidas" },
            { key: "valor_total_vencido", label: "Total" },
            { key: "cobranca_mais_antiga", label: "Mais antiga" },
            { key: "dias_atraso", label: "Dias" }
          ]}
          rows={data.rows.map((row) => ({
            ...row,
            valor_total_vencido: formatMoney(row.valor_total_vencido),
            cobranca_mais_antiga: formatDate(row.cobranca_mais_antiga)
          }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              {row.whatsapp ? (
                <Link className="button-primary" href={`https://wa.me/${String(row.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(String(row.mensagem_whatsapp ?? ""))}`} target="_blank">
                  WhatsApp
                </Link>
              ) : null}
              <Link className="button-secondary" href={`mailto:?subject=${encodeURIComponent("Notificacao de cobranca")}&body=${encodeURIComponent(String(row.mensagem_whatsapp ?? ""))}`}>
                Gerar notificacao
              </Link>
              <Link className="button-secondary" href="/api/portal-associativo/export?tipo=inadimplencia&formato=pdf" target="_blank">
                Relatorio
              </Link>
            </div>
          )}
        />
      </section>
    </PortalAssociativoShell>
  );
}
