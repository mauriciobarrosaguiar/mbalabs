import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, FormCheckbox, FormInput, FormSelect, FormTextarea, MessageBanner, PageHeader, ResourceForm, SubmitButton, formatDate } from "@/components/ui-kit";
import { savePortalReuniao } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, listPortalReunioes } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalReunioesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const editId = firstParam(params.edit);
  const data = await listPortalReunioes();
  if (!canPortalAccess(data.perfil, "reunioes")) {
    redirect("/portal-associativo/painel-associado");
  }
  const editing = (data.rows as Array<Record<string, unknown>>).find((row) => row.id === editId);
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";

  return (
    <PortalAssociativoShell activePath="/portal-associativo/reunioes" can={(section) => canPortalAccess(data.perfil, section)} companyName={data.companyName} roleLabel={data.perfilLabel} userName={data.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader eyebrow="Portal Associativo" title="Reuniões e atas" description="Cadastre reuniões, pauta, ata, decisões, presença simples e libere a ata aos associados." actions={<BackButton href="/portal-associativo" />} />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {canWrite ? (
          <form action={savePortalReuniao}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm
              title={editing ? "Editar reunião" : "Nova reunião"}
              actions={
                <>
                  <SubmitButton>Salvar reunião</SubmitButton>
                  {editing ? <Link className="button-secondary" href="/portal-associativo/reunioes">Cancelar</Link> : null}
                </>
              }
            >
              <FormInput label="Título" name="titulo" defaultValue={String(editing?.titulo ?? "")} required />
              <FormInput label="Data e hora" name="data_reuniao" type="datetime-local" defaultValue={toDateTimeLocal(editing?.data_reuniao)} required />
              <FormInput label="Local" name="local" defaultValue={String(editing?.local ?? "")} />
              <FormSelect label="Status" name="status" defaultValue={String(editing?.status ?? "agendada")} options={[{ value: "agendada", label: "Agendada" }, { value: "realizada", label: "Realizada" }, { value: "cancelada", label: "Cancelada" }]} />
              <FormInput label="Ata/anexo URL" name="ata_url" defaultValue={String(editing?.ata_url ?? "")} placeholder="Link ou caminho no armazenamento" />
              <FormCheckbox label="Liberar ata para associados" name="liberado_associado" defaultChecked={editing?.liberado_associado === true} />
              <FormTextarea label="Pauta" name="pauta" defaultValue={String(editing?.pauta ?? "")} />
              <FormTextarea label="Descrição" name="descricao" defaultValue={String(editing?.descricao ?? "")} />
              <FormTextarea label="Texto da ata" name="ata" defaultValue={String(editing?.ata ?? "")} />
              <FormTextarea label="Decisões" name="decisoes" defaultValue={String(editing?.decisoes ?? "")} />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[
            { key: "data_reuniao", label: "Data" },
            { key: "titulo", label: "Título" },
            { key: "local", label: "Local" },
            { key: "status", label: "Status" },
            { key: "liberado", label: "Associado" }
          ]}
          rows={(data.rows as Array<Record<string, unknown>>).map((row) => ({
            ...row,
            data_reuniao: formatDate(row.data_reuniao),
            liberado: row.liberado_associado === true ? "Liberado" : "Interno"
          }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/api/portal-associativo/reunioes/${row.id}/ata`} target="_blank">Ata PDF</Link>
              {canWrite ? <Link className="button-secondary" href={`/portal-associativo/reunioes?edit=${row.id}`}>Editar</Link> : null}
            </div>
          )}
        />
      </section>
    </PortalAssociativoShell>
  );
}

function toDateTimeLocal(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}
