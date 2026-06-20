import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, FormMoneyInput, FormInput, FormSelect, FormTextarea, MessageBanner, PageHeader, ResourceForm, SubmitButton, formatMoney } from "@/components/ui-kit";
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
        <PageHeader eyebrow="Portal Associativo" title="Projetos" description="Acompanhe projetos planejados, em andamento e concluidos, com valores previstos e arrecadados." actions={<BackButton href="/portal-associativo" />} />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {canWrite ? (
          <form action={savePortalProjeto}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm title={editing ? "Editar projeto" : "Novo projeto"} actions={<SubmitButton>Salvar projeto</SubmitButton>}>
              <FormInput label="Nome" name="nome" defaultValue={String(editing?.nome ?? "")} required />
              <FormSelect label="Status" name="status" defaultValue={String(editing?.status ?? "planejado")} options={[{ value: "planejado", label: "Planejado" }, { value: "andamento", label: "Em andamento" }, { value: "concluido", label: "Concluido" }]} />
              <FormMoneyInput label="Valor previsto" name="valor_previsto" defaultValue={String(editing?.valor_previsto ?? "")} />
              <FormMoneyInput label="Valor arrecadado" name="valor_arrecadado" defaultValue={String(editing?.valor_arrecadado ?? "")} />
              <FormTextarea label="Descricao" name="descricao" defaultValue={String(editing?.descricao ?? "")} />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[{ key: "nome", label: "Nome" }, { key: "status", label: "Status" }, { key: "valor_previsto", label: "Previsto" }, { key: "valor_arrecadado", label: "Arrecadado" }, { key: "progresso", label: "Progresso" }]}
          rows={(data.rows as Array<Record<string, unknown>>).map((row) => ({
            ...row,
            valor_previsto: formatMoney(row.valor_previsto),
            valor_arrecadado: formatMoney(row.valor_arrecadado),
            progresso: `${Math.round((Number(row.valor_arrecadado ?? 0) / Math.max(Number(row.valor_previsto ?? 0), 1)) * 100)}%`
          }))}
          actions={(row) => canWrite ? <Link className="button-secondary" href={`/portal-associativo/projetos?edit=${row.id}`}>Editar</Link> : null}
        />
      </section>
    </PortalAssociativoShell>
  );
}
