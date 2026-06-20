import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  DataTable,
  FormCheckbox,
  FormDateInput,
  FormInput,
  FormMoneyInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton,
  formatDate,
  formatMoney
} from "@/components/ui-kit";
import {
  baixarPortalCobranca,
  cancelPortalCobranca,
  gerarPortalMensalidadesLote,
  savePortalCobranca
} from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import {
  canPortalAccess,
  getPortalLookups,
  listPortalCobrancas,
  loteamentoOptionLabel,
  PORTAL_CHARGE_STATUS_LABELS,
  unitOptionLabel
} from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalFinanceiroPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = {
    status: firstParam(params.status) ?? "",
    q: firstParam(params.q) ?? "",
    mes: firstParam(params.mes) ?? "",
    loteamento: firstParam(params.loteamento) ?? "",
    unidade: firstParam(params.unidade) ?? "",
    responsavel: firstParam(params.responsavel) ?? ""
  };
  const data = await listPortalCobrancas(filters);
  if (!canPortalAccess(data.perfil, "financeiro")) {
    redirect("/portal-associativo/painel-associado");
  }

  const lookups = await getPortalLookups("/portal-associativo/financeiro");
  const canWrite = data.perfil === "administrador" || data.perfil === "tesoureiro";
  const loteamentoOptions: Array<{ value: string; label: string }> = lookups.loteamentos.map((item: Record<string, unknown>) => ({ value: String(item.id), label: loteamentoOptionLabel(item) }));
  const unitOptions = lookups.unidades.map((unit: Record<string, unknown>) => ({ value: String(unit.id), label: unitOptionLabel(unit) }));
  const personOptions = lookups.pessoas.map((person: Record<string, unknown>) => ({ value: String(person.id), label: String(person.nome_completo) }));

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/financeiro"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Mensalidades"
          description="Gere mensalidades por loteamento, controle pagamentos, acompanhe inadimplência e envie cobranças aos responsáveis."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_170px_220px_170px_auto]" action="">
          <input className="input" name="q" defaultValue={filters.q} placeholder="Buscar por descrição, chácara/lote ou responsável" />
          <input className="input" name="mes" defaultValue={filters.mes} type="month" />
          <select className="input" name="loteamento" defaultValue={filters.loteamento}>
            <option value="">Todos os loteamentos</option>
            {loteamentoOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select className="input" name="status" defaultValue={filters.status}>
            <option value="">Todos os status</option>
            {Object.entries(PORTAL_CHARGE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="button-secondary" type="submit">Filtrar</button>
        </form>

        {canWrite ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <form action={savePortalCobranca}>
              <ResourceForm title="Mensalidade individual" actions={<SubmitButton>Salvar mensalidade</SubmitButton>}>
                <FormSelect label="Chácara/Lote" name="unidade_id" options={unitOptions} required />
                <FormSelect label="Responsável" name="pessoa_responsavel_id" options={personOptions} />
                <FormInput label="Descrição" name="descricao" defaultValue="Mensalidade" required />
                <FormSelect
                  label="Tipo"
                  name="tipo_cobranca"
                  defaultValue="mensalidade"
                  options={[
                    { value: "mensalidade", label: "Mensalidade" },
                    { value: "taxa", label: "Taxa" },
                    { value: "projeto", label: "Projeto" },
                    { value: "outro", label: "Outro" }
                  ]}
                />
                <FormDateInput label="Vencimento" name="data_vencimento" required />
                <FormMoneyInput label="Valor" name="valor_original" required />
                <FormMoneyInput label="Juros" name="valor_juros" />
                <FormMoneyInput label="Multa" name="valor_multa" />
                <FormMoneyInput label="Desconto" name="valor_desconto" />
                <FormSelect
                  label="Status"
                  name="status"
                  defaultValue="aberta"
                  options={Object.entries(PORTAL_CHARGE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                />
                <FormInput label="PIX copia e cola" name="pix_copia_cola" />
                <FormTextarea label="Observações" name="observacoes" />
              </ResourceForm>
            </form>

            <form action={gerarPortalMensalidadesLote}>
              <ResourceForm title="Mensalidades em lote" actions={<SubmitButton>Gerar mensalidades</SubmitButton>}>
                <FormSelect label="Loteamento" name="loteamento_id" options={loteamentoOptions} />
                <FormInput label="Mês inicial" name="mes_inicial" type="month" required />
                <FormMoneyInput label="Valor padrão de apoio" name="valor_original" defaultValue={lookups.configuracoes.valor_mensalidade_padrao} />
                <FormInput label="Dia de vencimento" name="vencimento_dia" type="number" defaultValue={lookups.configuracoes.vencimento_padrao} required />
                <FormInput label="Descrição" name="descricao" defaultValue={String(lookups.configuracoes.descricao_mensalidade_padrao ?? "Mensalidade")} />
                <FormCheckbox label="Gerar até dezembro" name="ate_dezembro" defaultChecked />
              </ResourceForm>
            </form>
          </div>
        ) : null}

        <DataTable
          columns={[
            { key: "descricao", label: "Descrição" },
            { key: "loteamento", label: "Loteamento" },
            { key: "unidade", label: "Chácara/Lote" },
            { key: "responsavel", label: "Responsável" },
            { key: "data_vencimento", label: "Vencimento" },
            { key: "valor_total", label: "Valor" },
            { key: "status_calculado", label: "Status" }
          ]}
          rows={data.rows.map((row) => ({
            ...row,
            data_vencimento: formatDate(row.data_vencimento),
            valor_total: formatMoney(row.valor_total),
            status_calculado: PORTAL_CHARGE_STATUS_LABELS[String(row.status_calculado)] ?? row.status_calculado
          }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              {row.whatsapp ? (
                <Link className="button-secondary" href={`https://wa.me/${String(row.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(String(row.mensagem_whatsapp ?? ""))}`} target="_blank">
                  WhatsApp
                </Link>
              ) : null}
              {canWrite && row.status !== "paga" && row.status !== "cancelada" ? (
                <>
                  <form action={baixarPortalCobranca}>
                    <input name="id" type="hidden" value={String(row.id)} />
                    <input name="return_to" type="hidden" value="/portal-associativo/financeiro" />
                    <input name="forma_pagamento" type="hidden" value="manual" />
                    <button className="button-primary" type="submit">Baixar</button>
                  </form>
                  <form action={cancelPortalCobranca}>
                    <input name="id" type="hidden" value={String(row.id)} />
                    <input name="return_to" type="hidden" value="/portal-associativo/financeiro" />
                    <button className="button-danger" type="submit">Cancelar</button>
                  </form>
                </>
              ) : null}
            </div>
          )}
        />
      </section>
    </PortalAssociativoShell>
  );
}
