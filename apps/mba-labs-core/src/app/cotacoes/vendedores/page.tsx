import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import {
  BackButton,
  DataTable,
  DeleteButton,
  FormCheckbox,
  FormInput,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SearchBox,
  SubmitButton,
  formatDate
} from "@/components/ui-kit";
import { inactivateVendedor, saveVendedor } from "@/lib/actions/cotacoes-actions";
import { listCotVendedores } from "@/lib/cotacoes-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function VendedoresPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const editId = firstParam(params.edit);
  const { rows, error } = await listCotVendedores(search);
  const editing = rows.find((row) => row.id === editId);
  const displayRows = rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) }));

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="MBA Cotações"
          title="Vendedores"
          description="Cadastre fornecedores e contatos que participam das cotações."
          actions={<BackButton href="/cotacoes" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por nome, empresa, telefone ou email" />

        <form action={saveVendedor}>
          <input name="id" type="hidden" value={String(editing?.id ?? "")} />
          <ResourceForm
            title={editing ? "Editar vendedor" : "Novo Vendedor"}
            actions={
              <>
                <SubmitButton>{editing ? "Salvar alterações" : "Salvar vendedor"}</SubmitButton>
                {editing ? <Link className="button-secondary" href="/cotacoes/vendedores">Cancelar</Link> : null}
              </>
            }
          >
            <FormInput label="Nome" name="nome" defaultValue={String(editing?.nome ?? "")} required />
            <FormInput label="Empresa vendedora" name="empresa_vendedora" defaultValue={String(editing?.empresa_vendedora ?? "")} />
            <FormInput label="Telefone" name="telefone" defaultValue={String(editing?.telefone ?? "")} />
            <FormInput label="Email" name="email" type="email" defaultValue={String(editing?.email ?? "")} />
            <FormCheckbox label="Vendedor ativo" name="ativo" defaultChecked={editing ? editing.ativo !== false : true} />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "nome", label: "Nome" },
            { key: "empresa_vendedora", label: "Empresa" },
            { key: "telefone", label: "Telefone" },
            { key: "email", label: "Email" },
            { key: "ativo", label: "Ativo" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={displayRows}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/cotacoes/vendedores?edit=${row.id}`}>
                Editar
              </Link>
              <form action={inactivateVendedor}>
                <input name="id" type="hidden" value={String(row.id)} />
                <DeleteButton>Inativar</DeleteButton>
              </form>
            </div>
          )}
        />
      </section>
    </main>
  );
}
