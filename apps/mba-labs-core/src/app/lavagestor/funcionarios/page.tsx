import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import {
  BackButton,
  DataTable,
  DeleteButton,
  FormCheckbox,
  FormInput,
  FormSelect,
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
import { requireLavaGestorFinanceAccess } from "@/lib/lavagestor-permissions";

export const dynamic = "force-dynamic";

const PERFIL_ACESSO_OPTIONS = [
  { value: "lavador", label: "Lavador - acesso básico à fila" },
  { value: "operador", label: "Operador - cria e movimenta lavagens" },
  { value: "caixa", label: "Caixa - recebe pagamentos" },
  { value: "gerente", label: "Gerente - operação quase completa" },
  { value: "visualizador", label: "Visualizador - apenas consulta" }
];

const PERMISSOES_EXTRAS_OPTIONS = [
  {
    value: "lavagem.criar",
    label: "Criar lavagem",
    description: "Permite abrir uma nova lavagem para cliente e veículo."
  },
  {
    value: "lavagem.alterar_responsavel",
    label: "Alterar lavador/responsável",
    description: "Permite trocar o funcionário responsável na fila."
  },
  {
    value: "pagamento.ver_valor",
    label: "Ver valores",
    description: "Permite visualizar preço, pendência e valores da lavagem."
  },
  {
    value: "pagamento.receber",
    label: "Receber pagamento",
    description: "Permite registrar pagamento e enviar recibo."
  },
  {
    value: "pagamento.ver_todos",
    label: "Ver todos os pagamentos",
    description: "Permite acessar a área de pagamentos."
  },
  {
    value: "agendamento.criar",
    label: "Criar agendamento",
    description: "Permite criar e editar agendamentos."
  },
  {
    value: "cliente.criar",
    label: "Cadastrar cliente/veículo",
    description: "Permite cadastrar clientes e veículos durante a operação."
  },
  {
    value: "whatsapp.enviar_manual",
    label: "Enviar WhatsApp manual",
    description: "Permite usar botões manuais de WhatsApp."
  },
  {
    value: "comissao.ver_propria",
    label: "Ver comissão própria",
    description: "Permite acompanhar a própria comissão."
  },
  {
    value: "relatorio.ver_basico",
    label: "Ver relatório básico",
    description: "Permite consultar relatórios simples."
  }
];


export default async function FuncionariosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { current, perfil } = await requireLavaGestorFinanceAccess("/lavagestor/funcionarios");
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
    <LavaGestorShell activePath="/lavagestor/funcionarios" perfil={perfil} userName={current.usuario.nome} roleLabel={perfil}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Funcionários"
          description="Cadastre lavadores e o percentual padrão de comissão."
          actions={<BackButton href="/lavagestor/operacao" />}
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
            <FormInput label="E-mail para acesso" name="email" type="email" defaultValue={String(editing?.email ?? "")} />
            <FormInput
              label={editing?.core_usuario_id || editing?.usuario_id ? "Nova senha provisória" : "Senha provisória"}
              name="senha_provisoria"
              type="password"
              placeholder={editing?.core_usuario_id || editing?.usuario_id ? "Preencha somente se quiser trocar" : "Mínimo 6 caracteres"}
            />
            <FormInput
              label="Percentual de comissão"
              name="percentual_comissao"
              type="number"
              min="0"
              step="0.01"
              defaultValue={String(editing?.percentual_comissao ?? 0)}
            />
            <FormSelect
              label="Perfil base de acesso"
              name="perfil_acesso"
              defaultValue={String(editing?.perfil_acesso ?? "lavador")}
              options={PERFIL_ACESSO_OPTIONS}
            />
            <div className="grid gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 p-4 md:col-span-2">
              <FormCheckbox
                label="Liberar acesso ao sistema para este funcionário"
                name="acesso_sistema"
                defaultChecked={editing?.acesso_sistema === true}
              />
              <p className="text-sm leading-6 text-slate-600">
                O perfil base define o acesso principal. As opções abaixo adicionam funções extras sem transformar o lavador em administrador.
              </p>
            </div>
            <div className="grid gap-3 rounded-[18px] border border-white/10 bg-white p-4 md:col-span-2">
              <div>
                <h3 className="text-base font-black text-slate-900">Permissões extras</h3>
                <p className="text-sm leading-6 text-slate-600">
                  Marque somente o que o dono deseja liberar para esse funcionário.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {PERMISSOES_EXTRAS_OPTIONS.map((option) => {
                  const selected = toStringArray(editing?.permissoes_extras).includes(option.value);
                  return (
                    <label
                      className="flex items-start gap-3 rounded-[14px] border border-slate-200 bg-slate-50 p-3 text-sm"
                      key={option.value}
                    >
                      <input
                        className="mt-1"
                        type="checkbox"
                        name="permissoes_extras"
                        value={option.value}
                        defaultChecked={selected}
                      />
                      <span>
                        <strong className="block text-slate-900">{option.label}</strong>
                        <span className="text-xs leading-5 text-slate-600">{option.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <FormCheckbox label="Funcionário ativo" name="ativo" defaultChecked={editing ? editing.ativo !== false : true} />
          </ResourceForm>
        </form>

        <DataTable
          columns={[
            { key: "nome", label: "Nome" },
            { key: "telefone", label: "Telefone" },
            { key: "email", label: "E-mail" },
            { key: "perfil_acesso_label", label: "Perfil" },
            { key: "acesso_sistema_label", label: "Acesso" },
            { key: "login_vinculado", label: "Login" },
            { key: "permissoes_resumo", label: "Permissões extras" },
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
              perfil_acesso_label: perfilLabel(String(row.perfil_acesso ?? "lavador")),
              acesso_sistema_label: row.acesso_sistema === true ? "Liberado" : "Sem acesso",
              login_vinculado: row.core_usuario_id || row.usuario_id ? "Vinculado" : row.acesso_sistema === true ? "Pendente" : "-",
              permissoes_resumo: permissoesResumo(row.permissoes_extras),
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

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function perfilLabel(value: string) {
  return PERFIL_ACESSO_OPTIONS.find((option) => option.value === value)?.label.split(" - ")[0] ?? value;
}

function permissoesResumo(value: unknown) {
  const selected = toStringArray(value);

  if (selected.length === 0) {
    return "-";
  }

  return selected
    .map((permission) => PERMISSOES_EXTRAS_OPTIONS.find((option) => option.value === permission)?.label ?? permission)
    .join(", ");
}
