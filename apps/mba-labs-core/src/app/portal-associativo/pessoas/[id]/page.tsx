import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, MessageBanner, PageHeader, formatDate, formatMoney } from "@/components/ui-kit";
import { deletePortalPessoa, inactivatePortalPessoa, reactivatePortalPessoa } from "@/lib/actions/portal-associativo-actions";
import { canPortalAccess, getPortalPessoaDetail, PORTAL_CHARGE_STATUS_LABELS } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

type PortalRow = Record<string, unknown>;

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PortalPessoaDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getPortalPessoaDetail(id);
  if (!canPortalAccess(data.perfil, "pessoas")) {
    redirect("/portal-associativo/painel-associado");
  }
  if (!data.pessoa) notFound();

  const pessoa = data.pessoa as PortalRow;
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";
  const phone = String(pessoa.whatsapp ?? pessoa.telefone ?? "").replace(/\D/g, "");

  return (
    <PortalAssociativoShell activePath="/portal-associativo/pessoas" can={(section) => canPortalAccess(data.perfil, section)} companyName={data.companyName} roleLabel={data.perfilLabel} userName={data.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title={String(pessoa.nome_completo)}
          description="Ficha completa da pessoa, vínculos, cobranças, documentos, transferências e auditoria."
          actions={
            <>
              {canWrite ? <Link className="button-secondary" href={`/portal-associativo/pessoas?edit=${id}`}>Editar</Link> : null}
              {phone ? <Link className="button-secondary" href={`https://wa.me/${phone}`} target="_blank">WhatsApp</Link> : null}
              {canPortalAccess(data.perfil, "financeiro") ? <Link className="button-secondary" href={`/portal-associativo/financeiro?responsavel=${id}`}>Criar cobrança</Link> : null}
              {canPortalAccess(data.perfil, "documentos") ? <Link className="button-secondary" href={`/portal-associativo/documentos?pessoa=${id}`}>Enviar documento</Link> : null}
              <BackButton href="/portal-associativo/pessoas" />
            </>
          }
        />
        <MessageBanner error={data.error ?? undefined} />

        <div className="grid gap-4 lg:grid-cols-3">
          <InfoCard title="Dados cadastrais" rows={[
            ["Tipo", String(pessoa.tipo_pessoa ?? "-")],
            ["CPF/CNPJ", String(pessoa.cpf_cnpj ?? "-")],
            ["RG/IE", String(pessoa.rg_ie ?? "-")],
            ["Nascimento", formatDate(pessoa.data_nascimento)],
            ["Telefone", String(pessoa.telefone ?? "-")],
            ["WhatsApp", String(pessoa.whatsapp ?? "-")],
            ["E-mail", String(pessoa.email ?? "-")],
            ["Cidade/UF", [pessoa.cidade, pessoa.uf].filter(Boolean).join("/") || "-"],
            ["Status", String(pessoa.status_pessoa ?? "-")]
          ]} />
          <section className="panel grid gap-3 p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold">Observações e endereço</h2>
            <p className="text-sm leading-6 text-muted-foreground">{String(pessoa.endereco ?? pessoa.endereco_residencial ?? "Endereço não informado.")}</p>
            <p className="text-sm leading-6">{String(pessoa.observacoes ?? "Sem observações.")}</p>
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                {pessoa.status_pessoa === "ativa" ? (
                  <form action={inactivatePortalPessoa}>
                    <input name="id" type="hidden" value={id} />
                    <input name="return_to" type="hidden" value={`/portal-associativo/pessoas/${id}`} />
                    <button className="button-danger" type="submit">Inativar</button>
                  </form>
                ) : (
                  <form action={reactivatePortalPessoa}>
                    <input name="id" type="hidden" value={id} />
                    <input name="return_to" type="hidden" value={`/portal-associativo/pessoas/${id}`} />
                    <button className="button-primary" type="submit">Reativar</button>
                  </form>
                )}
                <details className="rounded-lg border border-red-200 bg-red-50 p-2">
                  <summary className="cursor-pointer text-sm font-bold text-red-700">Excluir se não houver vínculos</summary>
                  <form action={deletePortalPessoa} className="mt-2 grid gap-2">
                    <input name="id" type="hidden" value={id} />
                    <input name="return_to" type="hidden" value={`/portal-associativo/pessoas/${id}`} />
                    <input className="input" name="confirmacao" placeholder="Digite EXCLUIR" required />
                    <button className="button-danger" type="submit">Confirmar exclusão</button>
                  </form>
                </details>
              </div>
            ) : null}
          </section>
        </div>

        <Panel title="Unidades vinculadas">
          <DataTable columns={[
            { key: "unidade", label: "Unidade" },
            { key: "tipo_vinculo", label: "Vínculo" },
            { key: "status_vinculo", label: "Status" },
            { key: "data_inicio", label: "Início" },
            { key: "data_fim", label: "Fim" }
          ]} rows={data.unidades.map((row: PortalRow) => ({ ...row, data_inicio: formatDate(row.data_inicio), data_fim: formatDate(row.data_fim) }))} />
        </Panel>

        <ChargesPanel title="Cobranças abertas" rows={data.cobrancasAbertas} />
        <ChargesPanel title="Cobranças vencidas" rows={data.cobrancasVencidas} />
        <ChargesPanel title="Cobranças pagas" rows={data.cobrancasPagas} />

        <Panel title="Documentos">
          <DataTable columns={[
            { key: "file_name", label: "Arquivo" },
            { key: "categoria", label: "Categoria" },
            { key: "liberado_associado", label: "Liberado" },
            { key: "criado_em", label: "Criado em" }
          ]} rows={data.documentos.map((row: PortalRow) => ({ ...row, criado_em: formatDate(row.criado_em), liberado_associado: row.liberado_associado ? "Sim" : "Não" }))} />
        </Panel>

        <Panel title="Histórico de transferências">
          <DataTable columns={[
            { key: "unidade", label: "Unidade" },
            { key: "data_transferencia", label: "Data" },
            { key: "responsabilidade_debitos", label: "Débitos" },
            { key: "motivo", label: "Motivo" }
          ]} rows={data.transferencias.map((row: PortalRow) => ({ ...row, data_transferencia: formatDate(row.data_transferencia) }))} />
        </Panel>

        <AuditTable rows={data.auditoria} />
      </section>
    </PortalAssociativoShell>
  );
}

function ChargesPanel({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return (
    <Panel title={title}>
      <DataTable columns={[
        { key: "descricao", label: "Descrição" },
        { key: "unidade", label: "Unidade" },
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

function AuditTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <Panel title="Histórico relacionado">
      <DataTable columns={[
        { key: "acao", label: "Ação" },
        { key: "entidade", label: "Entidade" },
        { key: "criado_em", label: "Criado em" }
      ]} rows={rows.map((row) => ({ ...row, criado_em: formatDate(row.criado_em) }))} />
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
