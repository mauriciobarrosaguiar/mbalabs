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
  const cidade = firstParam(params.cidade) ?? "";
  const uf = firstParam(params.uf) ?? "";
  const editId = firstParam(params.edit);
  const quickMode = firstParam(params.modo) === "rapido";
  const data = await listPortalPessoas(search, { status, perfil, cidade, uf });
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
          title="Associados"
          description="Aqui você cadastra as pessoas da associação. Depois, vincule cada pessoa a uma chácara ou lote."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <SearchBox defaultValue={search} placeholder="Buscar por nome, CPF/CNPJ, email, telefone ou WhatsApp" />
          <FilterLink href="/portal-associativo/pessoas" label="Todos" active={!status && !perfil} />
          <FilterLink href="/portal-associativo/pessoas?status=ativa" label="Ativos" active={status === "ativa"} />
        </div>

        {canWrite && !editing ? (
          <form action={savePortalPessoa} id="cadastro">
            <input name="tipo_pessoa" type="hidden" value="fisica" />
            <input name="status_pessoa" type="hidden" value="ativa" />
            <ResourceForm
              title="Cadastro rápido"
              actions={
                <>
                  <button className="button-primary" name="proxima_acao" type="submit" value="">Salvar</button>
                  <button className="button-secondary" name="proxima_acao" type="submit" value="unidade">Salvar e cadastrar unidade</button>
                  <button className="button-secondary" name="proxima_acao" type="submit" value="cobranca">Salvar e gerar cobrança</button>
                </>
              }
            >
              <FormInput label="Nome" name="nome_completo" required />
              <FormInput label="WhatsApp" name="whatsapp" placeholder="Ex.: (11) 99999-9999" />
              <FormInput label="CPF (opcional)" name="cpf_cnpj" />
              <FormInput label="E-mail (opcional)" name="email" type="email" />
            </ResourceForm>
          </form>
        ) : null}

        {canWrite ? (
          <details className="panel p-4" open={Boolean(editing) || !quickMode}>
            <summary className="cursor-pointer text-lg font-black">{editing ? "Editar cadastro" : "Cadastro completo"}</summary>
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
              <FormInput label="Data de nascimento" name="data_nascimento" type="date" defaultValue={String(editing?.data_nascimento ?? "")} />
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
                  { value: "antigo_proprietario", label: "Antigo proprietário" },
                  { value: "bloqueada", label: "Bloqueada" }
                ]}
              />
              <FormInput label="Cidade" name="cidade" defaultValue={String(editing?.cidade ?? "")} />
              <FormInput label="UF" name="uf" defaultValue={String(editing?.uf ?? "")} />
              <FormTextarea label="Endereço" name="endereco" defaultValue={String(editing?.endereco ?? editing?.endereco_residencial ?? "")} />
              <FormTextarea label="Endereco residencial" name="endereco_residencial" defaultValue={String(editing?.endereco_residencial ?? "")} />
              <FormTextarea label="Observacoes" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
            </ResourceForm>
          </form>
          </details>
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
                <Link className="button-secondary" href={`/portal-associativo/pessoas/${row.id}`}>
                  Ficha
                </Link>
                <details className="rounded-xl border border-red-200 bg-red-50 p-2">
                  <summary className="cursor-pointer text-sm font-bold text-red-700">Inativar</summary>
                  <form action={inactivatePortalPessoa} className="mt-2">
                    <input name="id" type="hidden" value={String(row.id)} />
                    <button className="button-danger" type="submit">Confirmar inativação</button>
                  </form>
                </details>
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
