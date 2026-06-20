import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  DataTable,
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
import { inactivatePortalPessoa, savePortalPessoa } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalLookups, listPortalPessoas, PORTAL_PERFIL_OPTIONS } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalPessoasPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const status = firstParam(params.status) ?? "";
  const perfil = firstParam(params.perfil) ?? "";
  const editId = firstParam(params.edit);
  const data = await listPortalPessoas(search, { status, perfil });
  if (!canPortalAccess(data.perfil, "pessoas")) {
    redirect("/portal-associativo/painel-associado");
  }

  const lookups = await getPortalLookups("/portal-associativo/pessoas");
  const editing = data.rows.find((row) => row.id === editId);
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/pessoas"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Pessoas e usuarios"
          description="Cadastre pessoas uma unica vez, evite duplicidades e vincule ao usuario central do MBA Labs."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <SearchBox defaultValue={search} placeholder="Buscar por nome, CPF/CNPJ, email, telefone ou WhatsApp" />
          <FilterLink href="/portal-associativo/pessoas" label="Todos" active={!status && !perfil} />
          <FilterLink href="/portal-associativo/pessoas?status=ativa" label="Ativos" active={status === "ativa"} />
        </div>

        {canWrite ? (
          <form action={savePortalPessoa}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm
              title={editing ? "Editar pessoa" : "Nova pessoa"}
              actions={
                <>
                  <SubmitButton>{editing ? "Salvar alteracoes" : "Salvar pessoa"}</SubmitButton>
                  {editing ? <Link className="button-secondary" href="/portal-associativo/pessoas">Cancelar</Link> : null}
                </>
              }
            >
              <FormInput label="Nome completo" name="nome_completo" defaultValue={String(editing?.nome_completo ?? "")} required />
              <FormSelect
                label="Tipo de pessoa"
                name="tipo_pessoa"
                defaultValue={String(editing?.tipo_pessoa ?? "fisica")}
                options={[
                  { value: "fisica", label: "Fisica" },
                  { value: "juridica", label: "Juridica" }
                ]}
                required
              />
              <FormInput label="CPF/CNPJ" name="cpf_cnpj" defaultValue={String(editing?.cpf_cnpj ?? "")} />
              <FormInput label="RG/IE" name="rg_ie" defaultValue={String(editing?.rg_ie ?? "")} />
              <FormInput label="Telefone" name="telefone" defaultValue={String(editing?.telefone ?? "")} />
              <FormInput label="WhatsApp" name="whatsapp" defaultValue={String(editing?.whatsapp ?? "")} />
              <FormInput label="Email" name="email" type="email" defaultValue={String(editing?.email ?? "")} />
              <FormSelect
                label="Usuario MBA Labs"
                name="core_usuario_id"
                defaultValue={String(editing?.core_usuario_id ?? "")}
                options={lookups.usuarios.map((user: Record<string, unknown>) => ({
                  value: String(user.id),
                  label: `${user.nome} (${user.email})`
                }))}
              />
              <FormSelect label="Perfil interno" name="perfil" defaultValue={String(editing?.perfil ?? "")} options={PORTAL_PERFIL_OPTIONS} />
              <FormSelect
                label="Status"
                name="status_pessoa"
                defaultValue={String(editing?.status_pessoa ?? "ativa")}
                options={[
                  { value: "ativa", label: "Ativa" },
                  { value: "inativa", label: "Inativa" },
                  { value: "antigo_proprietario", label: "Antigo proprietario" }
                ]}
              />
              <FormInput label="Cidade" name="cidade" defaultValue={String(editing?.cidade ?? "")} />
              <FormInput label="UF" name="uf" defaultValue={String(editing?.uf ?? "")} />
              <FormTextarea label="Endereco residencial" name="endereco_residencial" defaultValue={String(editing?.endereco_residencial ?? "")} />
              <FormTextarea label="Observacoes" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[
            { key: "nome_completo", label: "Nome" },
            { key: "cpf_cnpj", label: "CPF/CNPJ" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "email", label: "Email" },
            { key: "perfil", label: "Perfil" },
            { key: "status_pessoa", label: "Status" },
            { key: "criado_em", label: "Criado em" }
          ]}
          rows={data.rows.map((row) => ({ ...row, criado_em: formatDate(row.criado_em) }))}
          actions={(row) =>
            canWrite ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Link className="button-secondary" href={`/portal-associativo/pessoas?edit=${row.id}`}>
                  Editar
                </Link>
                <form action={inactivatePortalPessoa}>
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

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link className={active ? "button-primary" : "button-secondary"} href={href}>
      {label}
    </Link>
  );
}
