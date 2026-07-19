import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { deletePortalUnidade, inactivatePortalUnidade, reactivatePortalUnidade } from "@/lib/actions/portal-associativo-actions";
import { canPortalAccess, getPortalUnidadeDetail, PORTAL_CHARGE_STATUS_LABELS } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

type PortalRow = Record<string, unknown>;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PortalUnidadeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getPortalUnidadeDetail(id);
  if (!canPortalAccess(data.perfil, "unidades")) {
    redirect("/portal-associativo/painel-associado");
  }
  if (!data.unidade) notFound();

  const unidade = data.unidade as PortalRow;
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";
  const financeiro = data.vinculos.find((row: PortalRow) => row.tipo_vinculo === "responsavel_financeiro" && row.status_vinculo === "ativo" && !row.data_fim);
  const phone = String(financeiro?.whatsapp ?? "").replace(/\D/g, "");

  return (
    <PortalAssociativoShell activePath="/portal-associativo/unidades" can={(section) => canPortalAccess(data.perfil, section)} companyName={data.companyName} roleLabel={data.perfilLabel} userName={data.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title={[unidade.codigo_unidade, unidade.numero_unidade].filter(Boolean).join(" - ") || "Unidade"}
          description="Ficha completa da unidade, responsáveis, cobranças, documentos, transferências e auditoria."
          actions={
            <>
              {canWrite ? <Link className="button-secondary" href={`/portal-associativo/unidades?edit=${id}`}>Editar</Link> : null}
              {canPortalAccess(data.perfil, "financeiro") ? <Link className="button-secondary" href={`/portal-associativo/financeiro?unidade=${id}`}>Criar cobrança</Link> : null}
              {canWrite ? <Link className="button-secondary" href={`/portal-associativo/transferencias?unidade=${id}`}>Transferir</Link> : null}
              {canPortalAccess(data.perfil, "documentos") ? <Link className="button-secondary" href={`/portal-associativo/documentos?unidade=${id}`}>Enviar documento</Link> : null}
              {phone ? <Link className="button-secondary" href={`https://wa.me/${phone}`} target="_blank">WhatsApp responsável</Link> : null}
              <BackButton href="/portal-associativo/unidades" />
            </>
          }
        />
        <MessageBanner error={data.error ?? undefined} />

        <div className="grid gap-4 lg:grid-cols-3">
          <InfoCard title="Dados da unidade" rows={[
            ["Loteamento", String(unidade.loteamento ?? "-")],
            ["Código", String(unidade.codigo_unidade ?? "-")],
            ["Número", String(unidade.numero_unidade ?? "-")],
            ["Quadra/setor", String(unidade.quadra_setor ?? "-")],
            ["Tipo", String(unidade.tipo_unidade ?? "-")],
            ["Status", String(unidade.status_unidade ?? "-")],
            ["Área m²", String(unidade.area_m2 ?? "-")],
            ["Construção", unidade.possui_construcao ? "Sim" : "Não"],
            ["Mensalidade", unidade.isento_mensalidade ? "Isento" : unidade.valor_mensalidade ? formatMoney(unidade.valor_mensalidade) : "-"]
          ]} />
          <section className="panel grid gap-3 p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold">Localização e observações</h2>
            <p className="text-sm leading-6 text-muted-foreground">{String(unidade.endereco_localizacao ?? "Localização não informada.")}</p>
            <p className="text-sm leading-6">{String(unidade.observacoes ?? "Sem observações.")}</p>
            {!data.vinculos.some((row: PortalRow) => row.tipo_vinculo === "proprietario" && row.status_vinculo === "ativo" && !row.data_fim) ? <MessageBanner error="Esta unidade não possui proprietário ativo." /> : null}
            {!financeiro ? <MessageBanner error="Esta unidade não possui responsável financeiro ativo." /> : null}
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                {unidade.status_unidade === "ativa" ? (
                  <form action={inactivatePortalUnidade}>
                    <input name="id" type="hidden" value={id} />
                    <input name="return_to" type="hidden" value={`/portal-associativo/unidades/${id}`} />
                    <button className="button-danger" type="submit">Inativar</button>
                  </form>
                ) : (
                  <form action={reactivatePortalUnidade}>
                    <input name="id" type="hidden" value={id} />
                    <input name="return_to" type="hidden" value={`/portal-associativo/unidades/${id}`} />
                    <button className="button-primary" type="submit">Reativar</button>
                  </form>
                )}
                <details className="rounded-lg border border-red-200 bg-red-50 p-2">
                  <summary className="cursor-pointer text-sm font-bold text-red-700">Excluir se não houver vínculos</summary>
                  <form action={deletePortalUnidade} className="mt-2 grid gap-2">
                    <input name="id" type="hidden" value={id} />
                    <input name="return_to" type="hidden" value={`/portal-associativo/unidades/${id}`} />
                    <input className="input" name="confirmacao" placeholder="Digite EXCLUIR" required />
                    <button className="button-danger" type="submit">Confirmar exclusão</button>
                  </form>
                </details>
              </div>
            ) : null}
          </section>
        </div>

        <Panel title="Responsáveis e histórico de vínculos">
          <DataTable columns={[
            { key: "pessoa", label: "Pessoa" },
            { key: "tipo_vinculo", label: "Vínculo" },
            { key: "status_vinculo", label: "Status" },
            { key: "data_inicio", label: "Início" },
            { key: "data_fim", label: "Fim" },
            { key: "motivo_encerramento", label: "Motivo" }
          ]} rows={data.vinculos.map((row: PortalRow) => ({ ...row, data_inicio: formatDate(row.data_inicio), data_fim: formatDate(row.data_fim) }))} />
        </Panel>

        <ChargesPanel title="Cobranças abertas" rows={data.cobrancasAbertas} />
        <ChargesPanel title="Cobranças vencidas" rows={data.cobrancasVencidas} />
        <ChargesPanel title="Cobranças pagas" rows={data.cobrancasPagas} />

        <Panel title="Documentos e fotos">
          <DataTable columns={[
            { key: "file_name", label: "Arquivo" },
            { key: "categoria", label: "Categoria" },
            { key: "liberado_associado", label: "Liberado" },
            { key: "criado_em", label: "Criado em" }
          ]} rows={data.documentos.map((row: PortalRow) => ({ ...row, criado_em: formatDate(row.criado_em), liberado_associado: row.liberado_associado ? "Sim" : "Não" }))} actions={(row) => <Link className="button-secondary" href={`/api/portal-associativo/documentos/${row.id}/open`} target="_blank">Abrir</Link>} />
        </Panel>

        <Panel title="Transferências">
          <DataTable columns={[
            { key: "data_transferencia", label: "Data" },
            { key: "pessoa_anterior", label: "Anterior" },
            { key: "nova_pessoa", label: "Nova pessoa" },
            { key: "responsabilidade_debitos", label: "Débitos" },
            { key: "motivo", label: "Motivo" }
          ]} rows={data.transferencias.map((row: PortalRow) => ({ ...row, data_transferencia: formatDate(row.data_transferencia) }))} />
        </Panel>

        <Panel title="Auditoria relacionada">
          <DataTable columns={[
            { key: "acao", label: "Ação" },
            { key: "entidade", label: "Entidade" },
            { key: "criado_em", label: "Criado em" }
          ]} rows={data.auditoria.map((row: PortalRow) => ({ ...row, criado_em: formatDate(row.criado_em) }))} />
        </Panel>
      </section>
    </PortalAssociativoShell>
  );
}

function ChargesPanel({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return (
    <Panel title={title}>
      <DataTable columns={[
        { key: "descricao", label: "Descrição" },
        { key: "responsavel", label: "Responsável" },
        { key: "data_vencimento", label: "Vencimento" },
        { key: "valor_total", label: "Valor" },
        { key: "status", label: "Status" }
      ]} rows={rows.map((row) => ({
        ...row,
        data_vencimento: formatDate(row.data_vencimento),
        valor_total: formatMoney(row.valor_total),
        status: PORTAL_CHARGE_STATUS_LABELS[String(row.status)] ?? row.status
      }))} actions={(row) => <Link className="button-secondary" href={`/portal-associativo/cobrancas/${row.id}`}>Ver detalhes</Link>} />
    </Panel>
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
