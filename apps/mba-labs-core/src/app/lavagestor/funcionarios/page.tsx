import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
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
  formatDate,
  formatMoney
} from "@/components/ui-kit";
import { inactivateFuncionario, saveFuncionario } from "@/lib/actions/lavagestor-actions";
import { listLavaComissoes, listLavaFuncionarios, listLavaVales } from "@/lib/lavagestor-data";
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
  const [{ rows, error }, comissoes, vales] = await Promise.all([
    listLavaFuncionarios(search),
    listLavaComissoes(),
    listLavaVales()
  ]);
  const editing = rows.find((row) => row.id === editId);
  const financeiroPorFuncionario = rows.reduce<Record<string, { comissoes: number; vales: number }>>((map, funcionario) => {
    const funcionarioId = String(funcionario.id);
    const comissoesPendentes = comissoes.rows
      .filter((row) => row.funcionario_id === funcionarioId && row.status === "pendente")
      .reduce((sum, row) => sum + Number(row.valor ?? 0), 0);
    const valesAbertos = vales.rows
      .filter((row) => row.funcionario_id === funcionarioId && row.status === "aberto")
      .reduce((sum, row) => sum + Number(row.valor ?? 0), 0);

    map[funcionarioId] = { comissoes: comissoesPendentes, vales: valesAbertos };
    return map;
  }, {});

  return (
    <LavaGestorShell activePath="/lavagestor/funcionarios">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Funcionários"
          description="Cadastre lavadores e o percentual padrão de comissão."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner
          ok={firstParam(params.ok)}
          error={firstParam(params.error) ?? error ?? comissoes.error ?? vales.error ?? undefined}
        />
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
            { key: "comissoes_pendentes", label: "Comissões pendentes" },
            { key: "vales_abertos", label: "Vales em aberto" },
            { key: "saldo_previsto", label: "Saldo previsto" },
            { key: "ativo", label: "Ativo" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={rows.map((row) => {
            const resumo = financeiroPorFuncionario[String(row.id)] ?? { comissoes: 0, vales: 0 };
            return {
              ...row,
              comissoes_pendentes: formatMoney(resumo.comissoes),
              vales_abertos: formatMoney(resumo.vales),
              saldo_previsto: formatMoney(resumo.comissoes - resumo.vales),
              created_at: formatDate(row.created_at)
            };
          })}
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
    </LavaGestorShell>
  );
}
