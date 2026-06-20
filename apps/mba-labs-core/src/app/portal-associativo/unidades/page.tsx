import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  DataTable,
  FormCheckbox,
  FormInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SearchBox,
  SubmitButton,
  formatDate
} from "@/components/ui-kit";
import { inactivatePortalUnidade, savePortalUnidade } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalLookups, listPortalUnidades, PORTAL_UNIDADE_OPTIONS } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalUnidadesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const status = firstParam(params.status) ?? "";
  const editId = firstParam(params.edit);
  const data = await listPortalUnidades(search, status);
  if (!canPortalAccess(data.perfil, "unidades")) {
    redirect("/portal-associativo/painel-associado");
  }

  const lookups = await getPortalLookups("/portal-associativo/unidades");
  const editing = data.rows.find((row) => row.id === editId);
  const personOptions = lookups.pessoas.map((person: Record<string, unknown>) => ({
    value: String(person.id),
    label: String(person.nome_completo)
  }));
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/unidades"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Unidades"
          description="Gerencie lotes, casas, salas, propriedades e outros tipos de unidade com responsaveis e historico."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por codigo, numero, setor ou responsavel" />

        {canWrite ? (
          <form action={savePortalUnidade}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm
              title={editing ? "Editar unidade" : "Nova unidade"}
              actions={
                <>
                  <SubmitButton>{editing ? "Salvar alteracoes" : "Salvar unidade"}</SubmitButton>
                  {editing ? <Link className="button-secondary" href="/portal-associativo/unidades">Cancelar</Link> : null}
                </>
              }
            >
              <FormInput label="Codigo da unidade" name="codigo_unidade" defaultValue={String(editing?.codigo_unidade ?? "")} required />
              <FormInput label="Numero da unidade" name="numero_unidade" defaultValue={String(editing?.numero_unidade ?? "")} required />
              <FormInput label="Quadra/setor" name="quadra_setor" defaultValue={String(editing?.quadra_setor ?? "")} />
              <FormSelect label="Tipo de unidade" name="tipo_unidade" defaultValue={String(editing?.tipo_unidade ?? "propriedade")} options={PORTAL_UNIDADE_OPTIONS} required />
              <FormSelect label="Proprietario" name="proprietario_id" options={personOptions} />
              <FormSelect label="Responsavel financeiro" name="responsavel_financeiro_id" options={personOptions} />
              <FormSelect label="Responsavel de contato" name="responsavel_contato_id" options={personOptions} />
              <FormSelect
                label="Status"
                name="status_unidade"
                defaultValue={String(editing?.status_unidade ?? "ativa")}
                options={[
                  { value: "ativa", label: "Ativa" },
                  { value: "inativa", label: "Inativa" },
                  { value: "bloqueada", label: "Bloqueada" }
                ]}
              />
              <FormInput label="Area m2" name="area_m2" type="number" defaultValue={String(editing?.area_m2 ?? "")} />
              <FormInput label="Coordenadas/Maps" name="coordenadas_maps" defaultValue={String(editing?.coordenadas_maps ?? "")} />
              <FormCheckbox label="Possui construcao" name="possui_construcao" defaultChecked={editing?.possui_construcao === true} />
              <FormTextarea label="Endereco/localizacao" name="endereco_localizacao" defaultValue={String(editing?.endereco_localizacao ?? "")} />
              <FormTextarea label="Observacoes" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[
            { key: "codigo_unidade", label: "Codigo" },
            { key: "numero_unidade", label: "Numero" },
            { key: "tipo_unidade", label: "Tipo" },
            { key: "proprietario", label: "Proprietario" },
            { key: "responsavel_financeiro", label: "Financeiro" },
            { key: "status_unidade", label: "Status" },
            { key: "criado_em", label: "Criada em" }
          ]}
          rows={data.rows.map((row) => ({ ...row, criado_em: formatDate(row.criado_em) }))}
          actions={(row) =>
            canWrite ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Link className="button-secondary" href={`/portal-associativo/unidades?edit=${row.id}`}>
                  Editar
                </Link>
                <Link className="button-secondary" href={`/portal-associativo/financeiro?unidade=${row.id}`}>
                  Cobrancas
                </Link>
                <form action={inactivatePortalUnidade}>
                  <input name="id" type="hidden" value={String(row.id)} />
                  <button className="button-danger" type="submit">Inativar</button>
                </form>
              </div>
            ) : null
          }
        />
      </section>
    </PortalAssociativoShell>
  );
}
