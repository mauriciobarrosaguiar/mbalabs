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
import { canPortalAccess, getPortalLookups, listPortalUnidades, loteamentoOptionLabel } from "@/lib/portal-associativo-data";
import { UnitCodeFields } from "../UnitCodeFields";

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
  const preselectedOwner = firstParam(params.proprietario) ?? "";
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
          description="Aqui você cadastra as unidades e define quem é o dono e quem paga as mensalidades."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid gap-2 sm:grid-cols-2">
          <Link className="button-primary justify-center" href="#cadastro">Nova chácara/lote</Link>
          <Link className="button-secondary justify-center" href="/portal-associativo/importacao?tipo=unidades">Importar planilha</Link>
        </div>

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
          <details className="panel p-4" id="cadastro" open>
            <summary className="cursor-pointer text-lg font-black">{editing ? "Editar cadastro" : "Cadastro completo"}</summary>
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
              <UnitCodeFields defaultCode={String(editing?.codigo_unidade ?? "")} defaultNumber={String(editing?.numero_unidade ?? "")} defaultType={String(editing?.tipo_unidade ?? "chacara")} />
              <FormInput label="Quadra/setor" name="quadra_setor" defaultValue={String(editing?.quadra_setor ?? "")} />
              <FormSelect label="Proprietário" name="proprietario_id" defaultValue={preselectedOwner} options={personOptions} />
              <FormSelect label="Responsável financeiro" name="responsavel_financeiro_id" defaultValue={preselectedOwner} options={personOptions} />
              <FormSelect label="Responsável de contato" name="responsavel_contato_id" defaultValue={preselectedOwner} options={personOptions} />
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
          </details>
        ) : null}

        <div className="grid gap-3 md:hidden">
          {data.rows.length ? data.rows.map((row) => (
            <article className="grid gap-3 rounded-2xl border border-border bg-card p-4" key={String(row.id)}>
              <div><strong className="text-lg">{unitCardLabel(row)}</strong><p className="text-sm text-muted-foreground">{String(row.status_unidade)} · {String(row.tipo_unidade)}</p></div>
              <div className="grid gap-1 text-sm"><p><b>Proprietário:</b> {String(row.proprietario || "Não informado")}</p><p><b>Responsável pelo pagamento:</b> {String(row.responsavel_financeiro || "Não informado")}</p><p><b>Cobranças:</b> {String(row.cobrancas_abertas)} aberta(s), {String(row.cobrancas_vencidas)} vencida(s)</p></div>
              <div className="grid grid-cols-2 gap-2">
                <Link className="button-primary justify-center" href={`/portal-associativo/unidades/${row.id}`}>Ver</Link>
                <Link className="button-secondary justify-center" href={`/portal-associativo/financeiro?unidade=${row.id}`}>Cobranças</Link>
                {canWrite ? <Link className="button-secondary col-span-2 justify-center" href={`/portal-associativo/transferencias?unidade=${row.id}`}>Transferir</Link> : null}
              </div>
            </article>
          )) : <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Nenhuma unidade cadastrada. Use o cadastro completo ou importe uma planilha para começar.</p>}
        </div>

        <div className="hidden md:block"><DataTable
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
                <details className="rounded-xl border border-red-200 bg-red-50 p-2">
                  <summary className="cursor-pointer text-sm font-bold text-red-700">Inativar</summary>
                  <form action={inactivatePortalUnidade} className="mt-2">
                    <input name="id" type="hidden" value={String(row.id)} />
                    <button className="button-danger" type="submit">Confirmar inativação</button>
                  </form>
                </details>
              </div>
            ) : null
          }
        /></div>
      </section>
    </PortalAssociativoShell>
  );
}

function unitCardLabel(row: Record<string, unknown>) {
  const codigo = String(row.codigo_unidade ?? "").trim();
  const numero = String(row.numero_unidade ?? "").trim();
  if (codigo && numero && codigo === numero) return `Unidade ${numero}`;
  return [codigo, numero].filter(Boolean).join(" - ") || "Unidade";
}
