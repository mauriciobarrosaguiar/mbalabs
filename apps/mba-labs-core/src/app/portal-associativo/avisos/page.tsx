import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, FormCheckbox, FormDateInput, FormInput, FormSelect, FormTextarea, MessageBanner, PageHeader, ResourceForm, SubmitButton, formatDate } from "@/components/ui-kit";
import { savePortalAviso } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, listPortalAvisos } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalAvisosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const editId = firstParam(params.edit);
  const data = await listPortalAvisos();
  if (!canPortalAccess(data.perfil, "avisos")) {
    redirect("/portal-associativo/painel-associado");
  }
  const editing = (data.rows as Array<Record<string, unknown>>).find((row) => row.id === editId);
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";

  return (
    <PortalAssociativoShell activePath="/portal-associativo/avisos" can={(section) => canPortalAccess(data.perfil, section)} companyName={data.companyName} roleLabel={data.perfilLabel} userName={data.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader eyebrow="Portal Associativo" title="Avisos" description="Publique comunicados por prioridade e periodo de visibilidade no painel do associado." actions={<BackButton href="/portal-associativo" />} />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {canWrite ? (
          <form action={savePortalAviso}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm title={editing ? "Editar aviso" : "Novo aviso"} actions={<SubmitButton>Salvar aviso</SubmitButton>}>
              <FormInput label="Titulo" name="titulo" defaultValue={String(editing?.titulo ?? "")} required />
              <FormSelect
                label="Prioridade"
                name="prioridade"
                defaultValue={String(editing?.prioridade ?? "media")}
                options={[{ value: "baixa", label: "Baixa" }, { value: "media", label: "Media" }, { value: "alta", label: "Alta" }, { value: "urgente", label: "Urgente" }]}
              />
              <FormDateInput label="Visivel de" name="visivel_de" defaultValue={String(editing?.visivel_de ?? "")} />
              <FormDateInput label="Visivel ate" name="visivel_ate" defaultValue={String(editing?.visivel_ate ?? "")} />
              <FormSelect label="Status" name="status" defaultValue={String(editing?.status ?? "ativo")} options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }]} />
              <FormCheckbox label="Mostrar no painel do associado" name="mostrar_painel" defaultChecked={editing?.mostrar_painel !== false} />
              <FormTextarea label="Mensagem" name="mensagem" defaultValue={String(editing?.mensagem ?? "")} />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[{ key: "titulo", label: "Titulo" }, { key: "prioridade", label: "Prioridade" }, { key: "status", label: "Status" }, { key: "visivel_de", label: "De" }, { key: "visivel_ate", label: "Ate" }]}
          rows={(data.rows as Array<Record<string, unknown>>).map((row) => ({ ...row, visivel_de: formatDate(row.visivel_de), visivel_ate: formatDate(row.visivel_ate) }))}
          actions={(row) => canWrite ? <Link className="button-secondary" href={`/portal-associativo/avisos?edit=${row.id}`}>Editar</Link> : null}
        />
      </section>
    </PortalAssociativoShell>
  );
}
