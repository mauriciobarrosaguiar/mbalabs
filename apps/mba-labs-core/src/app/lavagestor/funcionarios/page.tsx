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
import { inactivateFuncionario, saveFuncionario } from "@/lib/actions/lavagestor-actions";
import { listLavaFuncionarios } from "@/lib/lavagestor-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function FuncionariosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const editId = firstParam(params.edit);
  const { rows, error } = await listLavaFuncionarios(search);
  const editing = rows.find((row) => row.id === editId);

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-6 py-8">
        <PageHeader
          eyebrow="LavaGestor"
          title="Funcionários"
          description="Cadastre lavadores e o percentual padrão de comissão."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por nome ou telefone" />

        <form action={saveFuncionario}>
          <input name="id" type="hidden" value={String(editing?.id ?? "")} />
          <ResourceForm
            title={editing ? "Editar funcionário" : "Novo Funcionário"}
            actions={
              <>
                <SubmitButton>{editing ? "Salvar alterações" : "Salvar funcionário"}</SubmitButton>
                {editing ? <Link className="button-secondary" href="/lavagestor/funcionarios">Cancelar</Link> : null}
              </>
            }
          >
            <FormInput label="Nome" name="nome" defaultValue={String(editing?.nome ?? "")} required />
            <FormInput label="Telefone" name="telefone" defaultValue={String(editing?.telefone ?? "")} />
            <FormInput
              label="Percentual de comissão"
              name="percentual_comissao"
              type="number"
              min="0"
              step="0.01"
              defaultValue={String(editing?.percentual_comissao ?? 0)}
            />
            <FormCheckbox label="Funcionário ativo" name="ativo" defaultChecked={editing ? editing.ativo !== false : true} />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "nome", label: "Nome" },
            { key: "telefone", label: "Telefone" },
            { key: "percentual_comissao", label: "Comissão %" },
            { key: "ativo", label: "Ativo" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={rows.map((row) => ({ ...row, created_at: formatDate(row.created_at) }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/lavagestor/funcionarios?edit=${row.id}`}>
                Editar
              </Link>
              <form action={inactivateFuncionario}>
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
