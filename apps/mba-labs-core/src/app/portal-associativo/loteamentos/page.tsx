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
import { getCidadeOptions, getUfOptions } from "@/lib/brazil-location-options";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, listPortalLoteamentos } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

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

  const editing = data.rows.find((row) => row.id === editId);
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";
  const cidadeOptions = getCidadeOptions(String(editing?.cidade ?? "Palmas"));
  const ufOptions = getUfOptions(String(editing?.uf ?? "TO"));

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/loteamentos"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Loteamentos"
          description="Cadastre os loteamentos da associação e defina regras padrão de mensalidade para as chácaras e lotes."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_180px_auto]" action="">
          <input className="input" name="q" defaultValue={search} placeholder="Buscar por nome, código, cidade ou endereço" />
          <select className="input" name="status" defaultValue={status}>
            <option value="">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
          <button className="button-secondary" type="submit">Filtrar</button>
        </form>

        {canWrite ? (
          <form action={savePortalLoteamento}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm
              title={editing ? "Editar loteamento" : "Novo loteamento"}
              actions={
                <>
                  <SubmitButton>{editing ? "Salvar alterações" : "Salvar loteamento"}</SubmitButton>
                  {editing ? <Link className="button-secondary" href="/portal-associativo/loteamentos">Cancelar</Link> : null}
                </>
              }
            >
              <FormInput label="Nome do loteamento" name="nome" defaultValue={String(editing?.nome ?? "")} required />
              <FormInput label="Código interno" name="codigo" defaultValue={String(editing?.codigo ?? "")} />
              <FormSelect label="UF" name="uf" defaultValue={String(editing?.uf ?? "TO")} options={ufOptions} />
              <FormSelect label="Cidade" name="cidade" defaultValue={String(editing?.cidade ?? "Palmas")} options={cidadeOptions} />
              <FormMoneyInput label="Mensalidade padrão" name="valor_mensalidade_padrao" defaultValue={Number(editing?.valor_mensalidade_padrao ?? 0)} />
              <FormInput label="Dia de vencimento padrão" name="vencimento_padrao" type="number" defaultValue={String(editing?.vencimento_padrao ?? 10)} />
              <FormInput
                label="Descrição padrão da mensalidade"
                name="descricao_mensalidade_padrao"
                defaultValue={String(editing?.descricao_mensalidade_padrao ?? "Mensalidade")}
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
        ) : null}

        <DataTable
          columns={[
            { key: "nome", label: "Loteamento" },
            { key: "codigo", label: "Código" },
            { key: "cidade_uf", label: "Cidade/UF" },
            { key: "valor_mensalidade_padrao", label: "Mensalidade padrão" },
            { key: "vencimento_padrao", label: "Vencimento" },
            { key: "status", label: "Status" },
            { key: "criado_em", label: "Criado em" }
          ]}
          rows={data.rows.map((row) => ({
            ...row,
            cidade_uf: [row.cidade, row.uf].filter(Boolean).join(" / "),
            valor_mensalidade_padrao: formatMoney(row.valor_mensalidade_padrao),
            vencimento_padrao: `Dia ${row.vencimento_padrao ?? 10}`,
            criado_em: formatDate(row.criado_em)
          }))}
          actions={(row) =>
            canWrite ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Link className="button-secondary" href={`/portal-associativo/loteamentos?edit=${row.id}`}>
                  Editar
                </Link>
                <Link className="button-secondary" href={`/portal-associativo/unidades?loteamento=${row.id}`}>
                  Chácaras
                </Link>
                <Link className="button-secondary" href={`/portal-associativo/financeiro?loteamento=${row.id}`}>
                  Mensalidades
                </Link>
                {row.status !== "inativo" ? (
                  <form action={inactivatePortalLoteamento}>
                    <input name="id" type="hidden" value={String(row.id)} />
                    <button className="button-danger" type="submit">Inativar</button>
                  </form>
                ) : null}
              </div>
            ) : null
          }
        />
      </section>
    </PortalAssociativoShell>
  );
}
