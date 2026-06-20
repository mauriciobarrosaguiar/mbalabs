import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, FormInput, FormSelect, FormTextarea, MessageBanner, PageHeader, ResourceForm, SubmitButton, formatDate } from "@/components/ui-kit";
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
        <PageHeader eyebrow="Portal Associativo" title="Reunioes" description="Cadastre reunioes, status, ata e presencas." actions={<BackButton href="/portal-associativo" />} />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {canWrite ? (
          <form action={savePortalReuniao}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm title={editing ? "Editar reuniao" : "Nova reuniao"} actions={<SubmitButton>Salvar reuniao</SubmitButton>}>
              <FormInput label="Titulo" name="titulo" defaultValue={String(editing?.titulo ?? "")} required />
              <FormInput label="Data e hora" name="data_reuniao" type="datetime-local" defaultValue={toDateTimeLocal(editing?.data_reuniao)} required />
              <FormSelect label="Status" name="status" defaultValue={String(editing?.status ?? "agendada")} options={[{ value: "agendada", label: "Agendada" }, { value: "realizada", label: "Realizada" }, { value: "cancelada", label: "Cancelada" }]} />
              <FormInput label="Ata/documento" name="ata_url" defaultValue={String(editing?.ata_url ?? "")} placeholder="Caminho no Supabase Storage" />
              <FormTextarea label="Descricao" name="descricao" defaultValue={String(editing?.descricao ?? "")} />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[{ key: "data_reuniao", label: "Data" }, { key: "titulo", label: "Titulo" }, { key: "status", label: "Status" }, { key: "ata_url", label: "Ata" }]}
          rows={(data.rows as Array<Record<string, unknown>>).map((row) => ({ ...row, data_reuniao: formatDate(row.data_reuniao) }))}
          actions={(row) => canWrite ? <Link className="button-secondary" href={`/portal-associativo/reunioes?edit=${row.id}`}>Editar</Link> : null}
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
