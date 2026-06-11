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
import { inactivateProduto, saveProduto } from "@/lib/actions/cotacoes-actions";
import { listCotProdutos } from "@/lib/cotacoes-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function ProdutosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const editId = firstParam(params.edit);
  const { rows, error } = await listCotProdutos(search);
  const editing = rows.find((row) => row.id === editId);
  const displayRows = rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) }));

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="MBA Cotações"
          title="Produtos"
          description="Cadastre os produtos que entram nas cotações."
          actions={<BackButton href="/cotacoes" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por nome, EAN ou laboratório" />

        <form action={saveProduto}>
          <input name="id" type="hidden" value={String(editing?.id ?? "")} />
          <ResourceForm
            title={editing ? "Editar produto" : "Novo Produto"}
            actions={
              <>
                <SubmitButton>{editing ? "Salvar alterações" : "Salvar produto"}</SubmitButton>
                {editing ? <Link className="button-secondary" href="/cotacoes/produtos">Cancelar</Link> : null}
              </>
            }
          >
            <FormInput label="EAN" name="ean" defaultValue={String(editing?.ean ?? "")} />
            <FormInput label="Nome" name="nome" defaultValue={String(editing?.nome ?? "")} required />
            <FormInput label="Laboratório" name="laboratorio" defaultValue={String(editing?.laboratorio ?? "")} />
            <FormInput label="Apresentação" name="apresentacao" defaultValue={String(editing?.apresentacao ?? "")} />
            <FormCheckbox label="Produto ativo" name="ativo" defaultChecked={editing ? editing.ativo !== false : true} />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "ean", label: "EAN" },
            { key: "nome", label: "Nome" },
            { key: "laboratorio", label: "Laboratório" },
            { key: "apresentacao", label: "Apresentação" },
            { key: "ativo", label: "Ativo" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={displayRows}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/cotacoes/produtos?edit=${row.id}`}>
                Editar
              </Link>
              <form action={inactivateProduto}>
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
