import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalAssociativoShell } from "@/components/PortalAssociativoShell";
import {
  BackButton,
  DataTable,
  FormCheckbox,
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
import { inactivatePortalUnidade, savePortalUnidade } from "@/lib/actions/portal-associativo-actions";
import { firstParam } from "@/lib/form-utils";
import { canPortalAccess, getPortalLookups, listPortalUnidades, loteamentoOptionLabel, PORTAL_UNIDADE_OPTIONS } from "@/lib/portal-associativo-data";

export const dynamic = "force-dynamic";

export default async function PortalUnidadesPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q) ?? "";
  const status = firstParam(params.status) ?? "";
  const loteamento = firstParam(params.loteamento) ?? "";
  const editId = firstParam(params.edit);
  const data = await listPortalUnidades(search, status, loteamento);
  if (!canPortalAccess(data.perfil, "unidades")) {
    redirect("/portal-associativo/painel-associado");
  }

  const lookups = await getPortalLookups("/portal-associativo/unidades");
  const editing = data.rows.find((row) => row.id === editId);
  const personOptions = lookups.pessoas.map((person: Record<string, unknown>) => ({
    value: String(person.id),
    label: String(person.nome_completo)
  }));
  const loteamentoOptions: Array<{ value: string; label: string }> = lookups.loteamentos.map((item: Record<string, unknown>) => ({
    value: String(item.id),
    label: loteamentoOptionLabel(item)
  }));
  const canWrite = data.perfil === "administrador" || data.perfil === "presidente" || data.perfil === "secretario";

  return (
    <PortalAssociativoShell
      activePath="/portal-associativo/unidades"
      can={(section) => canPortalAccess(data.perfil, section)}
      companyName={data.companyName}
      roleLabel={data.perfilLabel}
      userName={data.current.usuario.nome}
    >
      <section className="grid gap-6">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Chácaras e lotes"
          description="Cadastre cada chácara/lote dentro do loteamento, com proprietário, responsável financeiro e regra de mensalidade."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_220px_160px_auto]" action="">
          <input className="input" name="q" defaultValue={search} placeholder="Buscar por código, número, setor, loteamento ou responsável" />
          <select className="input" name="loteamento" defaultValue={loteamento}>
            <option value="">Todos os loteamentos</option>
            {loteamentoOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select className="input" name="status" defaultValue={status}>
            <option value="">Todos</option>
            <option value="ativa">Ativas</option>
            <option value="inativa">Inativas</option>
            <option value="bloqueada">Bloqueadas</option>
            <option value="vendida">Vendidas</option>
            <option value="em_transferencia">Em transferência</option>
          </select>
          <button className="button-secondary" type="submit">Filtrar</button>
        </form>

        {canWrite ? (
          <form action={savePortalUnidade}>
            <input name="id" type="hidden" value={String(editing?.id ?? "")} />
            <ResourceForm
              title={editing ? "Editar chácara/lote" : "Nova chácara/lote"}
              actions={
                <>
                  <SubmitButton>{editing ? "Salvar alterações" : "Salvar chácara/lote"}</SubmitButton>
                  {editing ? <Link className="button-secondary" href="/portal-associativo/unidades">Cancelar</Link> : null}
                </>
              }
            >
              <FormSelect label="Loteamento" name="loteamento_id" defaultValue={String(editing?.loteamento_id ?? "")} options={loteamentoOptions} />
              <FormInput label="Código da chácara/lote" name="codigo_unidade" defaultValue={String(editing?.codigo_unidade ?? "")} required />
              <FormInput label="Número/nome da chácara/lote" name="numero_unidade" defaultValue={String(editing?.numero_unidade ?? "")} required />
              <FormInput label="Quadra/setor" name="quadra_setor" defaultValue={String(editing?.quadra_setor ?? "")} />
              <FormSelect label="Tipo" name="tipo_unidade" defaultValue={String(editing?.tipo_unidade ?? "chacara")} options={PORTAL_UNIDADE_OPTIONS} required />
              <FormSelect label="Proprietário" name="proprietario_id" options={personOptions} />
              <FormSelect label="Responsável financeiro" name="responsavel_financeiro_id" options={personOptions} />
              <FormSelect label="Responsável de contato" name="responsavel_contato_id" options={personOptions} />
              <FormSelect
                label="Status"
                name="status_unidade"
                defaultValue={String(editing?.status_unidade ?? "ativa")}
                options={[
                  { value: "ativa", label: "Ativa" },
                  { value: "inativa", label: "Inativa" },
                  { value: "bloqueada", label: "Bloqueada" },
                  { value: "vendida", label: "Vendida" },
                  { value: "em_transferencia", label: "Em transferência" }
                ]}
              />
              <FormMoneyInput label="Mensalidade específica" name="valor_mensalidade" defaultValue={String(editing?.valor_mensalidade ?? "")} />
              <FormInput label="Dia de vencimento específico" name="vencimento_dia" type="number" defaultValue={String(editing?.vencimento_dia ?? "")} />
              <FormCheckbox label="Isento de mensalidade" name="isento_mensalidade" defaultChecked={editing?.isento_mensalidade === true} />
              <FormInput label="Área m2" name="area_m2" type="number" defaultValue={String(editing?.area_m2 ?? "")} />
              <FormInput label="Coordenadas/Maps" name="coordenadas_maps" defaultValue={String(editing?.coordenadas_maps ?? "")} />
              <FormCheckbox label="Possui construção" name="possui_construcao" defaultChecked={editing?.possui_construcao === true} />
              <FormTextarea label="Endereço/localização" name="endereco_localizacao" defaultValue={String(editing?.endereco_localizacao ?? "")} />
              <FormTextarea label="Observações" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
            </ResourceForm>
          </form>
        ) : null}

        <DataTable
          columns={[
            { key: "loteamento", label: "Loteamento" },
            { key: "codigo_unidade", label: "Código" },
            { key: "numero_unidade", label: "Chácara/Lote" },
            { key: "tipo_unidade", label: "Tipo" },
            { key: "proprietario", label: "Proprietário" },
            { key: "responsavel_financeiro", label: "Financeiro" },
            { key: "mensalidade", label: "Mensalidade" },
            { key: "status_unidade", label: "Status" },
            { key: "criado_em", label: "Criada em" }
          ]}
          rows={data.rows.map((row) => ({
            ...row,
            mensalidade: row.isento_mensalidade === true ? "Isento" : row.valor_mensalidade ? formatMoney(row.valor_mensalidade) : "-",
            criado_em: formatDate(row.criado_em)
          }))}
          actions={(row) =>
            canWrite ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Link className="button-secondary" href={`/portal-associativo/unidades?edit=${row.id}`}>
                  Editar
                </Link>
                <Link className="button-secondary" href={`/portal-associativo/unidades/${row.id}`}>
                  Ficha
                </Link>
                <Link className="button-secondary" href={`/portal-associativo/financeiro?unidade=${row.id}`}>
                  Mensalidades
                </Link>
                <form action={inactivatePortalUnidade}>
                  <input name="id" type="hidden" value={String(row.id)} />
                  <button className="button-danger" type="submit">Inativar</button>
                </form>
              </div>
            ) : null
          }
        />
      </section>
    </PortalAssociativoShell>
  );
}
