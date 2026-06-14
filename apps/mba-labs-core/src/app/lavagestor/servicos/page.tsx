import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import {
  BackButton,
  DataTable,
  DeleteButton,
  FormCheckbox,
  FormInput,
  FormMoneyInput,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SearchBox,
  SubmitButton,
  formatDate,
  formatMoney
} from "@/components/ui-kit";
import { inactivateServico, saveServico } from "@/lib/actions/lavagestor-actions";
import { listLavaServicos } from "@/lib/lavagestor-data";
import { firstParam } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

export default async function ServicosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const editId = firstParam(params.edit);
  const { rows, error } = await listLavaServicos(search);
  const editing = rows.find((row) => row.id === editId);

  return (
    <LavaGestorShell activePath="/lavagestor/servicos">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Serviços"
          description="Configure serviços como lavagem simples, lavagem completa, polimento, higienização, sofá, tapete, máquina e outros."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por nome ou descrição" />

        <form action={saveServico}>
          <input name="id" type="hidden" value={String(editing?.id ?? "")} />
          <ResourceForm
            title={editing ? "Editar serviço" : "Novo Serviço"}
            actions={
              <>
                <SubmitButton>{editing ? "Salvar alterações" : "Salvar serviço"}</SubmitButton>
                {editing ? <Link className="button-secondary" href="/lavagestor/servicos">Cancelar</Link> : null}
              </>
            }
          >
            <FormInput label="Nome" name="nome" defaultValue={String(editing?.nome ?? "")} required />
            <FormMoneyInput label="Preço" name="preco" defaultValue={String(editing?.preco ?? 0)} />
            <FormInput
              label="Percentual de comissão"
              name="percentual_comissao"
              type="number"
              min="0"
              step="0.01"
              defaultValue={String(editing?.percentual_comissao ?? "")}
            />
            <FormCheckbox label="Serviço ativo" name="ativo" defaultChecked={editing ? editing.ativo !== false : true} />
            <FormTextarea label="Descrição" name="descricao" defaultValue={String(editing?.descricao ?? "")} />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "nome", label: "Nome" },
            { key: "preco", label: "Preço" },
            { key: "percentual_comissao", label: "Comissão %" },
            { key: "ativo", label: "Ativo" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={rows.map((row) => ({ ...row, preco: formatMoney(row.preco), created_at: formatDate(row.created_at) }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/lavagestor/servicos?edit=${row.id}`}>
                Editar
              </Link>
              <form action={inactivateServico}>
                <input name="id" type="hidden" value={String(row.id)} />
                <DeleteButton>Inativar</DeleteButton>
              </form>
            </div>
          )}
        />
      </section>
    </LavaGestorShell>
  );
}
