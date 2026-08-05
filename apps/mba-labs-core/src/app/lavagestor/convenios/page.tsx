import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import {
  BackButton,
  DataTable,
  DeleteButton,
  FormCheckbox,
  FormInput,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SearchBox,
  SubmitButton,
  formatDate
} from "@/components/ui-kit";
import { deleteLavaConvenio, saveLavaConvenio } from "@/lib/actions/lavagestor-convenios-actions";
import { firstParam } from "@/lib/form-utils";
import { listLavaConvenios } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function ConveniosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const editId = firstParam(params.edit);
  const { rows, error } = await listLavaConvenios(search);
  const editing = rows.find((row) => String(row.id) === String(editId ?? ""));

  return (
    <LavaGestorShell activePath="/lavagestor/convenios">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Convênios"
          description="Cadastre convênios com desconto em porcentagem ou marque como não paga."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar convênio" />

        <form action={saveLavaConvenio}>
          <input name="id" type="hidden" value={String(editing?.id ?? "")} />
          <ResourceForm
            title={editing ? "Editar convênio" : "Novo convênio"}
            actions={
              <>
                <SubmitButton>{editing ? "Salvar alterações" : "Salvar convênio"}</SubmitButton>
                {editing ? <Link className="button-secondary" href="/lavagestor/convenios">Cancelar</Link> : null}
              </>
            }
          >
            <FormInput label="Nome do convênio" name="nome" defaultValue={String(editing?.nome ?? "")} required />
            <FormInput
              label="Desconto %"
              name="percentual_desconto"
              type="number"
              min="0"
              step="0.01"
              defaultValue={String(editing?.percentual_desconto ?? 0)}
            />
            <FormCheckbox label="Convênio não paga nada" name="nao_paga" defaultChecked={Boolean(editing?.nao_paga)} />
            <FormCheckbox label="Convênio ativo" name="ativo" defaultChecked={editing ? editing.ativo !== false : true} />
            <FormTextarea label="Descrição / observação" name="descricao" defaultValue={String(editing?.descricao ?? "")} />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "nome", label: "Convênio" },
            { key: "regra", label: "Regra" },
            { key: "ativo_label", label: "Ativo" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={rows.map((row) => ({
            ...row,
            regra: row.nao_paga === true ? "Não paga" : `${Number(row.percentual_desconto ?? 0)}% de desconto`,
            ativo_label: row.ativo === false ? "Não" : "Sim",
            created_at: formatDate(row.created_at)
          }))}
          actions={(row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <Link className="button-secondary" href={`/lavagestor/convenios?edit=${row.id}`}>
                Editar
              </Link>
              <form action={deleteLavaConvenio}>
                <input name="id" type="hidden" value={String(row.id)} />
                <DeleteButton>Excluir</DeleteButton>
              </form>
            </div>
          )}
        />
      </section>
    </LavaGestorShell>
  );
}
