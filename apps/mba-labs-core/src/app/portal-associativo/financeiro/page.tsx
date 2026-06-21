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
  getPortalMensalidadesPreview,
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
  const editId = firstParam(params.edit);
  const editing = data.rows.find((row) => String(row.id) === String(editId ?? ""));
  const previewParams = {
    loteamentoId: firstParam(params.preview_loteamento_id) ?? "",
    mesInicial: firstParam(params.preview_mes_inicial) ?? "",
    valorOriginal: firstParam(params.preview_valor_original) ?? "",
    vencimentoDia: firstParam(params.preview_vencimento_dia) ?? "",
    descricao: firstParam(params.preview_descricao) ?? "",
    ateDezembro: firstParam(params.preview_ate_dezembro) === "true"
  };
  const preview = previewParams.mesInicial ? await getPortalMensalidadesPreview(previewParams) : null;
  const loteamentoOptions: Array<{ value: string; label: string }> = lookups.loteamentos.map((item: Record<string, unknown>) => ({
    value: String(item.id),
    label: loteamentoOptionLabel(item)
  }));
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
          description="Crie, edite, baixe, cancele e acompanhe cobrancas com PIX manual, recibo em PDF e previa para geracao em lote."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? preview?.error ?? undefined} />

        <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_170px_220px_170px_auto]" action="">
          <input className="input" name="q" defaultValue={filters.q} placeholder="Buscar por descricao, unidade ou responsavel" />
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
              <input name="id" type="hidden" value={String(editing?.id ?? "")} />
              <ResourceForm
                title={editing ? "Editar cobranca" : "Cobranca individual"}
                actions={
                  <>
                    <SubmitButton>{editing ? "Salvar alteracoes" : "Salvar cobranca"}</SubmitButton>
                    {editing ? <Link className="button-secondary" href="/portal-associativo/financeiro">Cancelar edicao</Link> : null}
                  </>
                }
              >
                <FormSelect label="Unidade" name="unidade_id" defaultValue={String(editing?.unidade_id ?? "")} options={unitOptions} required />
                <FormSelect label="Responsavel financeiro" name="pessoa_responsavel_id" defaultValue={String(editing?.pessoa_responsavel_id ?? "")} options={personOptions} />
                <FormInput label="Descricao" name="descricao" defaultValue={String(editing?.descricao ?? "Mensalidade")} required />
                <FormSelect
                  label="Tipo"
                  name="tipo_cobranca"
                  defaultValue={String(editing?.tipo_cobranca ?? "mensalidade")}
                  options={[
                    { value: "mensalidade", label: "Mensalidade" },
                    { value: "taxa", label: "Taxa" },
                    { value: "projeto", label: "Projeto" },
                    { value: "outro", label: "Outro" }
                  ]}
                />
                <FormDateInput label="Vencimento" name="data_vencimento" defaultValue={String(editing?.data_vencimento ?? "")} required />
                <FormMoneyInput label="Valor original" name="valor_original" defaultValue={String(editing?.valor_original ?? "")} required />
                <FormMoneyInput label="Juros" name="valor_juros" defaultValue={String(editing?.valor_juros ?? "")} />
                <FormMoneyInput label="Multa" name="valor_multa" defaultValue={String(editing?.valor_multa ?? "")} />
                <FormMoneyInput label="Desconto" name="valor_desconto" defaultValue={String(editing?.valor_desconto ?? "")} />
                <FormSelect
                  label="Status"
                  name="status"
                  defaultValue={String(editing?.status ?? "aberta")}
                  options={Object.entries(PORTAL_CHARGE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                />
                <FormInput label="PIX copia e cola" name="pix_copia_cola" defaultValue={String(editing?.pix_copia_cola ?? "")} />
                <FormTextarea label="Observacoes" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
              </ResourceForm>
            </form>

            <form action="" method="get">
              <ResourceForm title="Mensalidades em lote" actions={<SubmitButton>Ver previa</SubmitButton>}>
                <FormSelect label="Loteamento" name="preview_loteamento_id" defaultValue={previewParams.loteamentoId} options={loteamentoOptions} />
                <FormInput label="Mes inicial" name="preview_mes_inicial" type="month" defaultValue={previewParams.mesInicial} required />
                <FormMoneyInput label="Valor padrao de apoio" name="preview_valor_original" defaultValue={previewParams.valorOriginal || String(lookups.configuracoes.valor_mensalidade_padrao ?? "")} />
                <FormInput label="Dia de vencimento" name="preview_vencimento_dia" type="number" defaultValue={previewParams.vencimentoDia || String(lookups.configuracoes.vencimento_padrao ?? 10)} required />
                <FormInput label="Descricao" name="preview_descricao" defaultValue={previewParams.descricao || String(lookups.configuracoes.descricao_mensalidade_padrao ?? "Mensalidade")} />
                <FormCheckbox label="Gerar ate dezembro" name="preview_ate_dezembro" defaultChecked={previewParams.ateDezembro || !previewParams.mesInicial} />
              </ResourceForm>
            </form>
          </div>
        ) : null}

        {canWrite && preview?.preview ? (
          <section className="panel grid gap-4 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Previa de mensalidades</p>
                <h2 className="text-xl font-black">Confira antes de gerar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {String(preview.preview.quantidade_cobrancas)} nova(s), {String(preview.preview.quantidade_ignoradas)} ignorada(s) por duplicidade, total {formatMoney(preview.preview.valor_total)}.
                </p>
              </div>
              <form action={gerarPortalMensalidadesLote} className="flex flex-wrap gap-2">
                <input name="confirmar_previa" type="hidden" value="true" />
                <input name="loteamento_id" type="hidden" value={previewParams.loteamentoId} />
                <input name="mes_inicial" type="hidden" value={previewParams.mesInicial} />
                <input name="valor_original" type="hidden" value={previewParams.valorOriginal} />
                <input name="vencimento_dia" type="hidden" value={previewParams.vencimentoDia} />
                <input name="descricao" type="hidden" value={previewParams.descricao} />
                <input name="ate_dezembro" type="hidden" value={previewParams.ateDezembro ? "true" : ""} />
                <button className="button-primary" type="submit">Confirmar geracao</button>
              </form>
            </div>
            <DataTable
              columns={[
                { key: "unidade", label: "Unidade" },
                { key: "loteamento", label: "Loteamento" },
                { key: "mes_ano", label: "Mes" },
                { key: "vencimento", label: "Vencimento" },
                { key: "valor", label: "Valor" }
              ]}
              rows={(preview.preview.unidades_afetadas as Array<Record<string, unknown>>).map((row) => ({
                ...row,
                mes_ano: `${row.mes}/${row.ano}`,
                valor: formatMoney(row.valor)
              }))}
              emptyMessage="Nenhuma cobranca nova sera criada."
            />
          </section>
        ) : null}

        <DataTable
          columns={[
            { key: "descricao", label: "Descricao" },
            { key: "loteamento", label: "Loteamento" },
            { key: "unidade", label: "Unidade" },
            { key: "responsavel", label: "Responsavel" },
            { key: "data_vencimento", label: "Vencimento" },
            { key: "valor_total", label: "Valor" },
            { key: "status_calculado", label: "Status" }
          ]}
          rows={data.rows.map((row) => ({
            ...row,
            valor_total_raw: row.valor_total,
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
              {row.status === "paga" ? (
                <Link className="button-secondary" href={`/api/portal-associativo/recibos/${row.id}`} target="_blank">
                  Recibo PDF
                </Link>
              ) : null}
              {canWrite ? (
                <Link className="button-secondary" href={`/portal-associativo/financeiro?edit=${row.id}`}>
                  Editar
                </Link>
              ) : null}
              {canWrite && row.status !== "paga" && row.status !== "cancelada" ? (
                <details className="w-full rounded-lg border border-border bg-muted/40 p-2 lg:w-auto">
                  <summary className="cursor-pointer text-sm font-bold">Baixar</summary>
                  <form action={baixarPortalCobranca} className="mt-2 grid gap-2">
                    <input name="id" type="hidden" value={String(row.id)} />
                    <input name="return_to" type="hidden" value="/portal-associativo/financeiro" />
                    <input className="input" name="forma_pagamento" placeholder="Forma de pagamento" defaultValue="manual" />
                    <input className="input" name="valor_pago" placeholder="Valor pago" type="number" step="0.01" defaultValue={String(row.valor_total_raw ?? "")} />
                    <input className="input" name="comprovante_url" placeholder="Comprovante URL (opcional)" />
                    <button className="button-primary" type="submit">Confirmar baixa</button>
                  </form>
                </details>
              ) : null}
              {canWrite && row.status !== "cancelada" ? (
                <details className="w-full rounded-lg border border-red-200 bg-red-50 p-2 lg:w-auto">
                  <summary className="cursor-pointer text-sm font-bold text-red-700">Cancelar</summary>
                  <form action={cancelPortalCobranca} className="mt-2 grid gap-2">
                    <input name="id" type="hidden" value={String(row.id)} />
                    <input name="return_to" type="hidden" value="/portal-associativo/financeiro" />
                    <input className="input" name="motivo_cancelamento" placeholder="Motivo do cancelamento" required />
                    {row.status === "paga" ? <input className="input" name="confirmar_cancelamento_pago" placeholder="Digite CANCELAR PAGA" required /> : null}
                    <button className="button-danger" type="submit">Confirmar cancelamento</button>
                  </form>
                </details>
              ) : null}
            </div>
          )}
        />
      </section>
    </PortalAssociativoShell>
  );
}
