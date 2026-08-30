import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  DataTable,
  FormInput,
  FormMoneyInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton,
  formatDate,
  formatMoney
} from "@/components/ui-kit";
import { inactivatePortalLoteamento, savePortalLoteamento } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, listPortalLoteamentos } from "@/lib/portal-associativo-data";
import { BrazilLocationFields } from "../BrazilLocationFields";
import { LoteamentoCodeFields } from "../LoteamentoCodeFields";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

export default async function PortalLoteamentosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const status = firstParam(params.status) ?? "";
  const editId = firstParam(params.edit);
  const data = await listPortalLoteamentos(search, status);

  if (!canPortalAccess(data.perfil, "loteamentos")) {
    redirect("/portal-associativo/painel-associado");
  }

  const editing = (data.rows as Row[]).find((row) => row.id === editId);
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/loteamentos"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-5">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Grupos/Loteamentos"
          description="Use esta tela apenas para organizar unidades por condomínio, setor, associação ou loteamento."
          actions={<BackButton href="/portal-associativo/unidades" label="Voltar para unidades" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid gap-2 sm:grid-cols-3">
          <Link className="button-primary min-h-12 justify-center text-center" href="#cadastro-grupo">Novo grupo</Link>
          <Link className="button-secondary min-h-12 justify-center text-center" href="/portal-associativo/unidades">Ver unidades</Link>
          <Link className="button-secondary min-h-12 justify-center text-center" href="/portal-associativo/importacao?tipo=unidades">Importar planilha</Link>
        </div>

        <details className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-black">Quando usar grupos?</summary>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Use grupos quando a associação tiver mais de um loteamento, setor, quadra, condomínio ou conjunto de chácaras. Se for tudo em um só local, você pode cadastrar as unidades sem mexer aqui.
          </p>
        </details>

        <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_180px_auto]" action="">
          <input className="input" name="q" defaultValue={search} placeholder="Buscar..." />
          <select className="input" name="status" defaultValue={status}>
            <option value="">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
          <button className="button-secondary" type="submit">Filtrar</button>
        </form>

        {canWrite ? (
          <details className="panel p-4" id="cadastro-grupo" open={Boolean(editing)}>
            <summary className="cursor-pointer text-lg font-black">{editing ? "Editar grupo" : "Cadastrar grupo/loteamento"}</summary>
            <form action={savePortalLoteamento} className="mt-4">
              <input name="id" type="hidden" value={String(editing?.id ?? "")} />
              <ResourceForm
                title={editing ? "Editar grupo" : "Novo grupo/loteamento"}
                actions={
                  <>
                    <SubmitButton>{editing ? "Salvar alterações" : "Salvar grupo"}</SubmitButton>
                    {editing ? <Link className="button-secondary" href="/portal-associativo/loteamentos">Cancelar</Link> : null}
                  </>
                }
              >
                <FormInput label="Nome do grupo/loteamento" name="nome" defaultValue={String(editing?.nome ?? "")} required />
                <LoteamentoCodeFields defaultCode={String(editing?.codigo ?? "")} defaultType={String(editing?.tipo_loteamento ?? "outro")} />
                <BrazilLocationFields defaultCity={String(editing?.cidade ?? "")} defaultUf={String(editing?.uf ?? "")} />
                <FormMoneyInput label="Mensalidade padrão" name="valor_mensalidade_padrao" defaultValue={Number(editing?.valor_mensalidade_padrao ?? 0)} />
                <FormInput label="Dia de vencimento" name="vencimento_padrao" type="number" defaultValue={String(editing?.vencimento_padrao ?? 10)} />
                <FormSelect
                  label="Descrição da mensalidade"
                  name="descricao_mensalidade_padrao"
                  defaultValue={String(editing?.descricao_mensalidade_padrao ?? "Mensalidade")}
                  options={[
                    { value: "Mensalidade", label: "Mensalidade" },
                    { value: "Taxa de manutenção", label: "Taxa de manutenção" },
                    { value: "Taxa de associação", label: "Taxa de associação" },
                    { value: "Fundo de reserva", label: "Fundo de reserva" },
                    { value: "Água", label: "Água" },
                    { value: "Energia", label: "Energia" },
                    { value: "Projeto", label: "Projeto" },
                    { value: "Multa", label: "Multa" },
                    { value: "Acordo", label: "Acordo" },
                    { value: "Outra", label: "Outra" }
                  ]}
                />
                <FormSelect
                  label="Status"
                  name="status"
                  defaultValue={String(editing?.status ?? "ativo")}
                  options={[
                    { value: "ativo", label: "Ativo" },
                    { value: "inativo", label: "Inativo" }
                  ]}
                />
                <FormTextarea label="Endereço/localização" name="endereco" defaultValue={String(editing?.endereco ?? "")} />
                <FormTextarea label="Observações" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
              </ResourceForm>
            </form>
          </details>
        ) : null}

        <DataTable
          columns={[
            { key: "nome", label: "Grupo" },
            { key: "codigo", label: "Código" },
            { key: "cidade_uf", label: "Cidade/UF" },
            { key: "valor_mensalidade_padrao", label: "Mensalidade" },
            { key: "vencimento_padrao", label: "Vencimento" },
            { key: "status_visual", label: "Status" },
            { key: "criado_em", label: "Criado em" }
          ]}
          rows={(data.rows as Row[]).map((row) => ({
            ...row,
            cidade_uf: [row.cidade, row.uf].filter(Boolean).join(" / ") || "-",
            valor_mensalidade_padrao: formatMoney(row.valor_mensalidade_padrao),
            vencimento_padrao: `Dia ${row.vencimento_padrao ?? 10}`,
            status_visual: statusLabel(row.status),
            criado_em: formatDate(row.criado_em)
          }))}
          actions={(row) =>
            canWrite ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Link className="button-secondary" href={`/portal-associativo/loteamentos?edit=${row.id}#cadastro-grupo`}>
                  Editar
                </Link>
                <Link className="button-secondary" href={`/portal-associativo/unidades?loteamento=${row.id}`}>
                  Ver unidades
                </Link>
                <Link className="button-secondary" href={`/portal-associativo/financeiro?loteamento=${row.id}`}>
                  Financeiro
                </Link>
                {row.status !== "inativo" ? (
                  <details className="rounded-xl border border-red-200 bg-red-50 p-2">
                    <summary className="cursor-pointer text-sm font-bold text-red-700">Inativar</summary>
                    <form action={inactivatePortalLoteamento} className="mt-2">
                      <input name="id" type="hidden" value={String(row.id)} />
                      <button className="button-danger" type="submit">Confirmar</button>
                    </form>
                  </details>
                ) : null}
              </div>
            ) : null
          }
        />
      </section>
    </PortalAssociativoShell>
  );
}

function statusLabel(value: unknown) {
  const labels: Record<string, string> = {
    ativo: "Ativo",
    inativo: "Inativo"
  };
  return labels[String(value ?? "")] ?? String(value ?? "-");
}
