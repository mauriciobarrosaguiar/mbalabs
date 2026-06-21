import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import { BackButton, DataTable, FormCheckbox, FormDateInput, FormInput, FormSelect, FormTextarea, MessageBanner, PageHeader, ResourceForm, SubmitButton, formatDate } from "@/components/ui-kit";
import { savePortalAviso } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalLookups, listPortalAvisos, PORTAL_PERFIL_OPTIONS, unitOptionLabel } from "@/lib/portal-associativo-data";

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
  const lookups = await getPortalLookups("/portal-associativo/avisos");
  const unitOptions = lookups.unidades.map((unit: Record<string, unknown>) => ({ value: String(unit.id), label: unitOptionLabel(unit) }));
  const editing = (data.rows as Array<Record<string, unknown>>).find((row) => row.id === editId);
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";

  return (
    <PortalAssociativoShell activePath="/portal-associativo/avisos" can={(section) => canPortalAccess(data.perfil, section)} companyName={data.companyName} roleLabel={data.perfilLabel} userName={data.current.usuario.nome}>
      <section className="grid gap-6">
        <PageHeader eyebrow="Portal Associativo" title="Avisos" description="Publique comunicados por prioridade, periodo, perfil, status de cobranca ou unidade." actions={<BackButton href="/portal-associativo" />} />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        {canWrite ? (
          <form action={savePortalAviso}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm
              title={editing ? "Editar aviso" : "Novo aviso"}
              actions={
                <>
                  <SubmitButton>Salvar aviso</SubmitButton>
                  {editing ? <Link className="button-secondary" href="/portal-associativo/avisos">Cancelar</Link> : null}
                </>
              }
            >
              <FormInput label="Titulo" name="titulo" defaultValue={String(editing?.titulo ?? "")} required />
              <FormSelect
                label="Prioridade"
                name="prioridade"
                defaultValue={String(editing?.prioridade ?? "media")}
                options={[{ value: "baixa", label: "Baixa" }, { value: "media", label: "Media" }, { value: "alta", label: "Alta" }, { value: "urgente", label: "Urgente" }]}
              />
              <FormSelect
                label="Publico"
                name="publico"
                defaultValue={String(editing?.publico ?? "todos")}
                options={[
                  { value: "todos", label: "Todos" },
                  { value: "perfil", label: "Por perfil" },
                  { value: "status_cobranca", label: "Por status de cobranca" },
                  { value: "unidade", label: "Por unidade" }
                ]}
              />
              <FormInput label="Perfis (separados por virgula)" name="perfis" defaultValue={Array.isArray(editing?.perfis) ? (editing?.perfis as string[]).join(",") : ""} placeholder={PORTAL_PERFIL_OPTIONS.map((item) => item.value).join(", ")} />
              <FormSelect label="Status de cobranca" name="status_cobranca" defaultValue={String(editing?.status_cobranca ?? "")} options={[{ value: "aberta", label: "Aberta" }, { value: "vencida", label: "Vencida" }, { value: "paga", label: "Paga" }]} />
              <FormSelect label="Unidade" name="unidade_id" defaultValue={String(editing?.unidade_id ?? "")} options={unitOptions} />
              <FormInput label="Link do portal" name="link_portal" defaultValue={String(editing?.link_portal ?? "/portal-associativo/painel-associado")} />
              <FormDateInput label="Visivel de" name="visivel_de" defaultValue={String(editing?.visivel_de ?? "")} />
              <FormDateInput label="Visivel ate" name="visivel_ate" defaultValue={String(editing?.visivel_ate ?? "")} />
              <FormSelect label="Status" name="status" defaultValue={String(editing?.status ?? "ativo")} options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }]} />
              <FormCheckbox label="Mostrar no painel do associado" name="mostrar_painel" defaultChecked={editing?.mostrar_painel !== false} />
              <FormTextarea label="Mensagem" name="mensagem" defaultValue={String(editing?.mensagem ?? "")} />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[
            { key: "titulo", label: "Titulo" },
            { key: "prioridade", label: "Prioridade" },
            { key: "publico", label: "Publico" },
            { key: "status", label: "Status" },
            { key: "visivel_de", label: "De" },
            { key: "visivel_ate", label: "Ate" }
          ]}
          rows={(data.rows as Array<Record<string, unknown>>).map((row) => ({ ...row, visivel_de: formatDate(row.visivel_de), visivel_ate: formatDate(row.visivel_ate) }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`https://wa.me/?text=${encodeURIComponent(buildWhatsappMessage(data.companyName, row))}`} target="_blank">WhatsApp</Link>
              {canWrite ? <Link className="button-secondary" href={`/portal-associativo/avisos?edit=${row.id}`}>Editar</Link> : null}
            </div>
          )}
        />
      </section>
    </PortalAssociativoShell>
  );
}

function buildWhatsappMessage(entity: string, row: Record<string, unknown>) {
  return [`${row.titulo ?? "Aviso"} - ${entity}`, String(row.mensagem ?? ""), row.link_portal ? `Portal: ${row.link_portal}` : ""].filter(Boolean).join("\n\n");
}
