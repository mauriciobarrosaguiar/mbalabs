import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, FormCheckbox, FormDateInput, FormInput, FormMoneyInput, FormSelect, FormTextarea, MessageBanner, PageHeader, ResourceForm, SubmitButton, formatDate, formatMoney } from "@/components/ui-kit";
import { savePortalProjeto } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, listPortalProjetos } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalProjetosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const editId = firstParam(params.edit);
  const data = await listPortalProjetos();
  if (!canPortalAccess(data.perfil, "projetos")) {
    redirect("/portal-associativo/painel-associado");
  }
  const editing = (data.rows as Array<Record<string, unknown>>).find((row) => row.id === editId);
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente";

  return (
    <PortalAssociativoShell activePath="/portal-associativo/projetos" can={(section) => canPortalAccess(data.perfil, section)} companyName={data.companyName} roleLabel={data.perfilLabel} userName={data.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader eyebrow="Portal Associativo" title="Projetos" description="Acompanhe projetos com valor previsto, arrecadado, percentual e documentos públicos." actions={<BackButton href="/portal-associativo" />} />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {canWrite ? (
          <form action={savePortalProjeto}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm
              title={editing ? "Editar projeto" : "Novo projeto"}
              actions={
                <>
                  <SubmitButton>Salvar projeto</SubmitButton>
                  {editing ? <Link className="button-secondary" href="/portal-associativo/projetos">Cancelar</Link> : null}
                </>
              }
            >
              <FormInput label="Nome do projeto" name="nome" defaultValue={String(editing?.nome ?? "")} required />
              <FormSelect label="Status" name="status" defaultValue={String(editing?.status ?? "planejado")} options={[{ value: "planejado", label: "Planejado" }, { value: "em_andamento", label: "Em andamento" }, { value: "concluido", label: "Concluído" }, { value: "cancelado", label: "Cancelado" }]} />
              <FormMoneyInput label="Valor previsto" name="valor_previsto" defaultValue={String(editing?.valor_previsto ?? "")} />
              <FormMoneyInput label="Valor arrecadado" name="valor_arrecadado" defaultValue={String(editing?.valor_arrecadado ?? "")} />
              <FormDateInput label="Data início" name="data_inicio" defaultValue={String(editing?.data_inicio ?? "")} />
              <FormDateInput label="Data fim" name="data_fim" defaultValue={String(editing?.data_fim ?? "")} />
              <FormInput label="Relatório URL" name="relatorio_url" defaultValue={String(editing?.relatorio_url ?? "")} />
              <FormCheckbox label="Liberar para associado" name="liberado_associado" defaultChecked={editing?.liberado_associado === true} />
              <FormTextarea label="Descrição" name="descricao" defaultValue={String(editing?.descricao ?? "")} />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[
            { key: "nome", label: "Nome" },
            { key: "status", label: "Status" },
            { key: "valor_previsto", label: "Previsto" },
            { key: "valor_arrecadado", label: "Arrecadado" },
            { key: "progresso", label: "Progresso" },
            { key: "periodo", label: "Período" },
            { key: "liberado", label: "Associado" }
          ]}
          rows={(data.rows as Array<Record<string, unknown>>).map((row) => {
            const previsto = Number(row.valor_previsto ?? 0);
            const arrecadado = Number(row.valor_arrecadado ?? 0);
            return {
              ...row,
              valor_previsto: formatMoney(previsto),
              valor_arrecadado: formatMoney(arrecadado),
              progresso: `${Math.round((arrecadado / Math.max(previsto, 1)) * 100)}%`,
              periodo: [formatDate(row.data_inicio), formatDate(row.data_fim)].join(" até "),
              liberado: row.liberado_associado === true ? "Liberado" : "Interno"
            };
          })}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              {row.relatorio_url ? <Link className="button-secondary" href={String(row.relatorio_url)} target="_blank">Relatório</Link> : null}
              {canWrite ? <Link className="button-secondary" href={`/portal-associativo/projetos?edit=${row.id}`}>Editar</Link> : null}
            </div>
          )}
        />
      </section>
    </PortalAssociativoShell>
  );
}
