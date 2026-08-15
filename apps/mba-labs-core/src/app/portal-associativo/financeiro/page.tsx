import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  DataTable,
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
  approvePortalComprovante,
  baixarPortalCobranca,
  cancelPortalCobranca,
  gerarPortalMensalidadesLote,
  reopenPortalCobranca,
  rejectPortalComprovante,
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

type Row = Record<string, unknown>;

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
  const displayedRows = normalizeDisplayedRows(data.rows as Row[], filters.status);
  const editing = displayedRows.find((row) => String(row.id) === String(editId ?? "")) ?? (data.rows as Row[]).find((row) => String(row.id) === String(editId ?? ""));
  const previewParams = {
    loteamentoId: firstParam(params.preview_loteamento_id) ?? "",
    mesInicial: firstParam(params.preview_mes_inicial) ?? "",
    valorOriginal: firstParam(params.preview_valor_original) ?? "",
    vencimentoDia: firstParam(params.preview_vencimento_dia) ?? "",
    descricao: firstParam(params.preview_descricao) ?? "",
    modo: firstParam(params.preview_modo) ?? "mensal",
    ano: firstParam(params.preview_ano) ?? String(new Date().getFullYear()),
    ateDezembro: ["ate_dezembro", "anual"].includes(firstParam(params.preview_modo) ?? "")
  };
  if (previewParams.modo === "anual") previewParams.mesInicial = `${previewParams.ano}-01`;
  const preview = previewParams.mesInicial ? await getPortalMensalidadesPreview(previewParams) : null;
  const loteamentoOptions: Array<{ value: string; label: string }> = lookups.loteamentos.map((item: Row) => ({
    value: String(item.id),
    label: loteamentoOptionLabel(item)
  }));
  const unitOptions = lookups.unidades.map((unit: Row) => ({ value: String(unit.id), label: unitOptionLabel(unit) }));

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/financeiro"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-5">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Cobranças"
          description="Mensalidades, pagamentos e comprovantes."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? preview?.error ?? undefined} />

        <div className="grid gap-2 sm:grid-cols-4">
          <Link className="button-primary min-h-12 justify-center text-center" href="#mensalidades-lote">Gerar mensalidade</Link>
          <Link className="button-secondary min-h-12 justify-center text-center" href="#cobranca-avulsa">Nova cobrança</Link>
          <Link className="button-secondary min-h-12 justify-center text-center" href="/portal-associativo/financeiro?status=aguardando_aprovacao">Comprovantes</Link>
          <Link className="button-secondary min-h-12 justify-center text-center" href="/portal-associativo/inadimplentes">Atrasados</Link>
        </div>

        <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_170px_220px_170px_auto]" action="">
          <input className="input" name="q" defaultValue={filters.q} placeholder="Buscar..." />
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
          <div className="grid gap-4">
            <details className="panel p-4" open={Boolean(editing)} id="cobranca-avulsa">
              <summary className="cursor-pointer text-lg font-black">Criar cobrança individual</summary>
              <form action={savePortalCobranca} className="mt-4">
                <input name="id" type="hidden" value={String(editing?.id ?? "")} />
                <input name="return_to" type="hidden" value="/portal-associativo/financeiro" />
                <ResourceForm
                  title={editing ? "Editar cobrança" : "Cobrança individual"}
                  actions={
                    <>
                      <SubmitButton>{editing ? "Salvar alterações" : "Salvar cobrança"}</SubmitButton>
                      {editing ? <Link className="button-secondary" href="/portal-associativo/financeiro">Cancelar edição</Link> : null}
                    </>
                  }
                >
                  <FormSelect label="Unidade" name="unidade_id" defaultValue={String(editing?.unidade_id ?? filters.unidade)} options={unitOptions} required />
                  <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">O responsável pelo pagamento vem da unidade.</p>
                  <FormInput label="Descrição" name="descricao" defaultValue={String(editing?.descricao ?? "Mensalidade")} required />
                  <FormSelect
                    label="Tipo"
                    name="tipo_cobranca"
                    defaultValue={String(editing?.tipo_cobranca ?? "mensalidade")}
                    options={[
                      { value: "mensalidade", label: "Mensalidade" },
                      { value: "taxa", label: "Taxa" },
                      { value: "projeto", label: "Projeto" },
                      { value: "multa", label: "Multa" },
                      { value: "acordo", label: "Acordo" },
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
                    defaultValue={String(isPaidLike(editing ?? {}) ? "paga" : editing?.status ?? "aberta")}
                    options={Object.entries(PORTAL_CHARGE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                  />
                  <FormInput label="PIX copia e cola" name="pix_copia_cola" defaultValue={String(editing?.pix_copia_cola ?? "")} />
                  <FormTextarea label="Observações" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
                </ResourceForm>
              </form>
            </details>

            <details className="panel p-4" id="mensalidades-lote">
              <summary className="cursor-pointer text-lg font-black">Gerar cobranças em lote/anual</summary>
              <form action="" className="mt-4" method="get">
                <ResourceForm title="Mensalidades em lote" actions={<SubmitButton>Ver prévia</SubmitButton>}>
                  <FormSelect label="Loteamento" name="preview_loteamento_id" defaultValue={previewParams.loteamentoId} options={loteamentoOptions} />
                  <FormSelect label="Período" name="preview_modo" defaultValue={previewParams.modo} options={[{ value: "mensal", label: "Mensal" }, { value: "ate_dezembro", label: "Até dezembro" }, { value: "anual", label: "Anual" }]} />
                  <FormInput label="Mês inicial" name="preview_mes_inicial" type="month" defaultValue={previewParams.mesInicial} />
                  <FormInput label="Ano" name="preview_ano" type="number" defaultValue={previewParams.ano} />
                  <FormMoneyInput label="Valor" name="preview_valor_original" defaultValue={previewParams.valorOriginal || String(lookups.configuracoes.valor_mensalidade_padrao ?? "")} />
                  <FormInput label="Dia de vencimento" name="preview_vencimento_dia" type="number" defaultValue={previewParams.vencimentoDia || String(lookups.configuracoes.vencimento_padrao ?? 10)} required />
                  <FormInput label="Descrição" name="preview_descricao" defaultValue={previewParams.descricao || String(lookups.configuracoes.descricao_mensalidade_padrao ?? "Mensalidade")} />
                </ResourceForm>
              </form>
            </details>
          </div>
        ) : null}

        {canWrite && preview?.preview ? <PreviewSection preview={preview.preview as Row} previewParams={previewParams} /> : null}

        <div className="grid gap-3 md:hidden">
          {displayedRows.length ? displayedRows.map((row) => (
            <ChargeCard key={String(row.id)} row={row} canWrite={canWrite} />
          )) : <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Nenhuma cobrança encontrada.</p>}
        </div>

        <div className="hidden md:block">
          <DataTable
            columns={[
              { key: "descricao", label: "Descrição" },
              { key: "unidade", label: "Unidade" },
              { key: "responsavel", label: "Responsável" },
              { key: "data_vencimento", label: "Vencimento" },
              { key: "valor_total", label: "Valor" },
              { key: "status_visual", label: "Status" }
            ]}
            rows={displayedRows.map((row) => ({
              ...row,
              valor_total_raw: row.valor_total,
              data_vencimento: formatDate(row.data_vencimento),
              valor_total: formatMoney(row.valor_total),
              status_visual: statusLabel(row)
            }))}
            actions={(row) => <ChargeActions row={row} canWrite={canWrite} />}
          />
        </div>
      </section>
    </PortalAssociativoShell>
  );
}

function PreviewSection({ preview, previewParams }: { preview: Row; previewParams: Row }) {
  return (
    <section className="panel grid gap-4 p-5">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Prévia</p>
          <h2 className="text-xl font-black">Confira antes de gerar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {String(preview.quantidade_cobrancas)} nova(s), total {formatMoney(preview.valor_total)}. {String(preview.quantidade_ignoradas_pagas)} já pagas e {String(preview.quantidade_ignoradas_existentes)} já existentes serão ignoradas.
          </p>
        </div>
        <form action={gerarPortalMensalidadesLote} className="flex flex-wrap gap-2">
          <input name="confirmar_previa" type="hidden" value="true" />
          <input name="loteamento_id" type="hidden" value={String(previewParams.loteamentoId ?? "")} />
          <input name="mes_inicial" type="hidden" value={String(previewParams.mesInicial ?? "")} />
          <input name="valor_original" type="hidden" value={String(previewParams.valorOriginal ?? "")} />
          <input name="vencimento_dia" type="hidden" value={String(previewParams.vencimentoDia ?? "")} />
          <input name="descricao" type="hidden" value={String(previewParams.descricao ?? "")} />
          <input name="ate_dezembro" type="hidden" value={previewParams.ateDezembro ? "true" : ""} />
          <details className="rounded-xl border border-amber-300 bg-amber-50 p-3">
            <summary className="cursor-pointer text-sm font-black text-amber-900">Revisar e confirmar</summary>
            <p className="my-2 text-sm text-amber-900">Esta ação criará apenas as cobranças novas.</p>
            <button className="button-primary" type="submit">Confirmar geração</button>
          </details>
        </form>
      </div>
    </section>
  );
}

function ChargeCard({ row, canWrite }: { row: Row; canWrite: boolean }) {
  return (
    <article className="grid gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong className="text-lg">{String(row.descricao)}</strong>
          <p className="text-sm text-muted-foreground">{String(row.unidade)} · {String(row.responsavel || "Sem responsável")}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-xs font-bold">{statusLabel(row)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span><b>Valor</b><br />{formatMoney(row.valor_total)}</span>
        <span><b>Vencimento</b><br />{formatDate(row.data_vencimento)}</span>
      </div>
      <ChargeActions row={row} canWrite={canWrite} compact />
    </article>
  );
}

function ChargeActions({ row, canWrite, compact = false }: { row: Row; canWrite: boolean; compact?: boolean }) {
  const proof = latestProof(row);
  const paid = isPaidLike(row);
  const canceled = String(row.status) === "cancelada";
  const wrapperClass = compact ? "grid grid-cols-2 gap-2" : "flex flex-wrap justify-end gap-2";
  return (
    <div className={wrapperClass}>
      {row.whatsapp ? <Link className="button-secondary justify-center" href={`https://wa.me/${String(row.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(String(row.mensagem_whatsapp ?? ""))}`} target="_blank">WhatsApp</Link> : null}
      <Link className="button-primary justify-center" href={`/portal-associativo/cobrancas/${row.id}`}>Ver</Link>
      {paid ? <Link className="button-secondary justify-center" href={`/api/portal-associativo/recibos/${row.id}`} target="_blank">Recibo</Link> : null}
      {canWrite ? <Link className="button-secondary justify-center" href={`/portal-associativo/financeiro?edit=${row.id}`}>Editar</Link> : null}
      {String(row.status) === "aguardando_aprovacao" ? <ProofReview row={row} proof={proof} canWrite={canWrite} /> : null}
      {canWrite && !paid && !canceled ? <ManualPayment row={row} proof={proof} /> : null}
      {canWrite && !canceled ? <CancelPayment row={row} paid={paid} /> : null}
      {canWrite && canceled ? <ReopenPayment row={row} /> : null}
    </div>
  );
}

function ProofReview({ row, proof, canWrite }: { row: Row; proof: Row | undefined; canWrite: boolean }) {
  return (
    <details className="w-full rounded-lg border border-amber-200 bg-amber-50 p-2 lg:w-auto">
      <summary className="cursor-pointer text-sm font-bold">Analisar comprovante</summary>
      <div className="mt-2 grid gap-2 text-sm">
        <span>Valor informado: {formatMoney(proof?.valor_informado)}</span>
        <span>Data informada: {formatDate(proof?.data_pagamento_informada)}</span>
        <span>Enviado em: {formatDate(proof?.enviado_em)}</span>
        {proof?.arquivo_id ? <Link className="button-secondary" href={`/api/portal-associativo/documentos/${proof?.arquivo_id}/open`} target="_blank">Ver comprovante</Link> : null}
        {canWrite ? <>
          <form action={approvePortalComprovante} className="grid gap-2">
            <input name="cobranca_id" type="hidden" value={String(row.id)} />
            <input name="return_to" type="hidden" value="/portal-associativo/financeiro?status=aguardando_aprovacao" />
            <input className="input" name="data_pagamento" type="date" defaultValue={String(proof?.data_pagamento_informada ?? "")} />
            <button className="button-primary" type="submit">Aprovar pagamento</button>
          </form>
          <form action={rejectPortalComprovante} className="grid gap-2">
            <input name="cobranca_id" type="hidden" value={String(row.id)} />
            <input name="return_to" type="hidden" value="/portal-associativo/financeiro?status=aguardando_aprovacao" />
            <input className="input" name="motivo_recusa" placeholder="Motivo obrigatório" required />
            <button className="button-danger" type="submit">Recusar</button>
          </form>
        </> : null}
      </div>
    </details>
  );
}

function ManualPayment({ row, proof }: { row: Row; proof: Row | undefined }) {
  return (
    <details className="w-full rounded-lg border border-border bg-muted/40 p-2 lg:w-auto">
      <summary className="cursor-pointer text-sm font-bold">Baixar</summary>
      <form action={baixarPortalCobranca} className="mt-2 grid gap-2">
        <input name="id" type="hidden" value={String(row.id)} />
        <input name="return_to" type="hidden" value="/portal-associativo/financeiro" />
        {proof?.arquivo_id ? <Link className="button-secondary" href={`/api/portal-associativo/documentos/${proof?.arquivo_id}/open`} target="_blank">Ver comprovante</Link> : null}
        <input className="input" name="forma_pagamento" placeholder="Forma de pagamento" defaultValue={proof ? "pix_manual" : "manual"} />
        <input className="input" name="valor_pago" placeholder="Valor pago" type="number" step="0.01" defaultValue={String(row.valor_total_raw ?? row.valor_total ?? "")} />
        <button className="button-primary" type="submit">Confirmar baixa</button>
      </form>
    </details>
  );
}

function CancelPayment({ row, paid }: { row: Row; paid: boolean }) {
  return (
    <details className="w-full rounded-lg border border-red-200 bg-red-50 p-2 lg:w-auto">
      <summary className="cursor-pointer text-sm font-bold text-red-700">Cancelar</summary>
      <form action={cancelPortalCobranca} className="mt-2 grid gap-2">
        <input name="id" type="hidden" value={String(row.id)} />
        <input name="return_to" type="hidden" value="/portal-associativo/financeiro" />
        <input className="input" name="motivo_cancelamento" placeholder="Motivo" required />
        {paid ? <input className="input" name="confirmar_cancelamento_pago" placeholder="Digite CANCELAR PAGA" required /> : null}
        <button className="button-danger" type="submit">Confirmar</button>
      </form>
    </details>
  );
}

function ReopenPayment({ row }: { row: Row }) {
  return (
    <form action={reopenPortalCobranca}>
      <input name="id" type="hidden" value={String(row.id)} />
      <input name="return_to" type="hidden" value="/portal-associativo/financeiro" />
      <button className="button-primary" type="submit">Reabrir</button>
    </form>
  );
}

function normalizeDisplayedRows(rows: Row[], statusFilter: string) {
  return rows.filter((row) => {
    const paid = isPaidLike(row);
    if (statusFilter === "vencida" && paid) return false;
    if (["aberta", "aguardando_pagamento", "aguardando_aprovacao", "negociada", "recusada"].includes(statusFilter) && paid) return false;
    return true;
  });
}

function statusLabel(row: Row) {
  if (isPaidLike(row)) return "Paga";
  const status = String(row.status_calculado ?? row.status ?? "aberta");
  return PORTAL_CHARGE_STATUS_LABELS[status] ?? status;
}

function isPaidLike(row: Row) {
  if (String(row.status) === "paga") return true;
  if (row.data_pagamento) return true;
  const valorPago = Number(row.valor_pago ?? 0);
  return Number.isFinite(valorPago) && valorPago > 0;
}

function latestProof(row: Row) {
  const proofs = Array.isArray(row.assoc_comprovantes_pagamento) ? row.assoc_comprovantes_pagamento as Row[] : [];
  return [...proofs].sort((a, b) => String(b.enviado_em ?? "").localeCompare(String(a.enviado_em ?? "")))[0];
}
