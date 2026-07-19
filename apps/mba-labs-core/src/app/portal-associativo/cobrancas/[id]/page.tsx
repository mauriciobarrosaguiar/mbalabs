import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { baixarPortalCobranca, cancelPortalCobranca, reopenPortalCobranca } from "@/lib/actions/portal-associativo-actions";
import { canPortalAccess, getPortalCobrancaDetail, PORTAL_CHARGE_STATUS_LABELS } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

type PortalRow = Record<string, unknown>;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PortalCobrancaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getPortalCobrancaDetail(id);
  if (!canPortalAccess(data.perfil, "financeiro")) {
    redirect("/portal-associativo/painel-associado");
  }
  if (!data.cobranca) notFound();

  const row = data.cobranca as PortalRow;
  const canWrite = data.perfil === "administrador" || data.perfil === "tesoureiro";
  const phone = String(row.whatsapp ?? "").replace(/\D/g, "");

  return (
    <PortalAssociativoShell activePath="/portal-associativo/financeiro" can={(section) => canPortalAccess(data.perfil, section)} companyName={data.companyName} roleLabel={data.perfilLabel} userName={data.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title={String(row.descricao ?? "Cobrança")}
          description="Dados completos da cobrança, responsável, unidade, documentos, recibo e auditoria."
          actions={
            <>
              {phone ? <Link className="button-secondary" href={`https://wa.me/${phone}?text=${encodeURIComponent(String(row.mensagem_whatsapp ?? ""))}`} target="_blank">WhatsApp</Link> : null}
              {canWrite ? <Link className="button-secondary" href={`/portal-associativo/financeiro?edit=${id}`}>Editar</Link> : null}
              {row.status === "paga" ? <Link className="button-secondary" href={`/api/portal-associativo/recibos/${id}`} target="_blank">Recibo PDF</Link> : null}
              <BackButton href="/portal-associativo/financeiro" />
            </>
          }
        />
        <MessageBanner error={data.error ?? undefined} />

        <div className="grid gap-4 lg:grid-cols-3">
          <InfoCard title="Cobrança" rows={[
            ["Status", String(PORTAL_CHARGE_STATUS_LABELS[String(row.status_calculado)] ?? row.status_calculado ?? row.status ?? "-")],
            ["Tipo", String(row.tipo_cobranca ?? "-")],
            ["Mês/ano", [row.mes_referencia, row.ano_referencia].filter(Boolean).join("/") || "-"],
            ["Vencimento", formatDate(row.data_vencimento)],
            ["Valor original", formatMoney(row.valor_original)],
            ["Juros", formatMoney(row.valor_juros)],
            ["Multa", formatMoney(row.valor_multa)],
            ["Desconto", formatMoney(row.valor_desconto)],
            ["Total", formatMoney(row.valor_total)],
            ["Valor pago", formatMoney(row.valor_pago ?? row.valor_total)],
            ["Pagamento", formatDate(row.data_pagamento)],
            ["Forma", String(row.forma_pagamento ?? "-")]
          ]} />
          <InfoCard title="Responsável e unidade" rows={[
            ["Responsável", String(row.responsavel ?? "-")],
            ["WhatsApp", String(row.whatsapp ?? "-")],
            ["E-mail", String(row.email ?? "-")],
            ["Loteamento", String(row.loteamento ?? "-")],
            ["Unidade", String(row.unidade ?? "-")],
            ["ID", id]
          ]} />
          <section className="panel grid gap-3 p-4">
            <h2 className="text-lg font-semibold">Observações e PIX</h2>
            <p className="text-sm leading-6 text-muted-foreground">{String(row.observacoes ?? "Sem observações.")}</p>
            {row.pix_copia_cola ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <span className="block text-xs font-bold uppercase text-muted-foreground">PIX copia e cola</span>
                <code className="mt-1 block select-all break-words text-xs">{String(row.pix_copia_cola)}</code>
              </div>
            ) : null}
            {row.comprovante_url ? <Link className="button-secondary w-fit" href={String(row.comprovante_url)} target="_blank">Comprovante</Link> : null}
            {row.motivo_cancelamento ? <MessageBanner error={`Cancelada: ${row.motivo_cancelamento}`} /> : null}
          </section>
        </div>

        {canWrite ? (
          <section className="panel grid gap-4 p-4">
            <h2 className="text-lg font-semibold">Ações financeiras</h2>
            <div className="grid gap-3 lg:grid-cols-3">
              {row.status !== "paga" && row.status !== "cancelada" ? (
                <form action={baixarPortalCobranca} className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
                  <input name="id" type="hidden" value={id} />
                  <input name="return_to" type="hidden" value={`/portal-associativo/cobrancas/${id}`} />
                  <input className="input" name="forma_pagamento" placeholder="Forma de pagamento" defaultValue="manual" />
                  <input className="input" name="valor_pago" placeholder="Valor pago" type="number" step="0.01" defaultValue={String(row.valor_total ?? "")} />
                  <input className="input" name="comprovante_url" placeholder="Comprovante URL (opcional)" />
                  <button className="button-primary" type="submit">Baixar cobrança</button>
                </form>
              ) : null}
              {row.status !== "cancelada" ? (
                <form action={cancelPortalCobranca} className="grid gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <input name="id" type="hidden" value={id} />
                  <input name="return_to" type="hidden" value={`/portal-associativo/cobrancas/${id}`} />
                  <input className="input" name="motivo_cancelamento" placeholder="Motivo do cancelamento" required />
                  {row.status === "paga" ? <input className="input" name="confirmar_cancelamento_pago" placeholder="Digite CANCELAR PAGA" required /> : null}
                  <button className="button-danger" type="submit">Cancelar cobrança</button>
                </form>
              ) : (
                <form action={reopenPortalCobranca} className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3">
                  <input name="id" type="hidden" value={id} />
                  <input name="return_to" type="hidden" value={`/portal-associativo/cobrancas/${id}`} />
                  <button className="button-primary" type="submit">Reabrir cobrança</button>
                </form>
              )}
            </div>
          </section>
        ) : null}

        <Panel title="Documentos e comprovantes">
          <DataTable columns={[
            { key: "file_name", label: "Arquivo" },
            { key: "categoria", label: "Categoria" },
            { key: "liberado_associado", label: "Liberado" },
            { key: "criado_em", label: "Criado em" }
          ]} rows={data.documentos.map((doc: PortalRow) => ({ ...doc, criado_em: formatDate(doc.criado_em), liberado_associado: doc.liberado_associado ? "Sim" : "Não" }))} actions={(doc) => <Link className="button-secondary" href={`/api/portal-associativo/documentos/${doc.id}/open`} target="_blank">Abrir</Link>} />
        </Panel>

        <Panel title="Auditoria">
          <DataTable columns={[
            { key: "acao", label: "Ação" },
            { key: "entidade", label: "Entidade" },
            { key: "criado_em", label: "Criado em" }
          ]} rows={data.auditoria.map((audit: PortalRow) => ({ ...audit, criado_em: formatDate(audit.criado_em) }))} />
        </Panel>
      </section>
    </PortalAssociativoShell>
  );
}

function InfoCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="panel p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="mt-4 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-bold uppercase text-muted-foreground">{label}</dt>
            <dd className="break-words text-sm font-semibold">{value || "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel min-w-0 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
