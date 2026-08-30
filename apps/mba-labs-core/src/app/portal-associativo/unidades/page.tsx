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

type Row = Record<string, unknown>;

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
  const editing = (data.rows as Row[]).find((row) => row.id === editId);
  const personOptions = lookups.pessoas.map((person: Row) => ({
    value: String(person.id),
    label: String(person.nome_completo)
  }));
  const loteamentoOptions: Array<{ value: string; label: string }> = lookups.loteamentos.map((item: Row) => ({
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
      <section className="grid gap-5">
        <PageHeader
          eyebrow="Portal Associativo"
          title="Unidades"
          description="Cadastre chácaras, lotes, casas ou salas e defina quem paga."
          actions={<BackButton href="/portal-associativo" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid gap-2 sm:grid-cols-3">
          <Link className="button-primary min-h-12 justify-center text-center" href="#cadastro">Nova unidade</Link>
          <Link className="button-secondary min-h-12 justify-center text-center" href="/portal-associativo/loteamentos">Grupos/Loteamentos</Link>
          <Link className="button-secondary min-h-12 justify-center text-center" href="/portal-associativo/importacao?tipo=unidades">Importar planilha</Link>
        </div>

        <details className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-black">Entenda esta tela</summary>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <p><b>Unidade</b> é a chácara, lote, casa, sala ou box.</p>
            <p><b>Grupo/Loteamento</b> é opcional e serve para organizar várias unidades.</p>
            <p><b>Financeiro</b> sempre cobra em cima da unidade, não solto no associado.</p>
          </div>
        </details>

        <form className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[1fr_220px_160px_auto]" action="">
          <input className="input" name="q" defaultValue={search} placeholder="Buscar..." />
          <select className="input" name="loteamento" defaultValue={loteamento}>
            <option value="">Todos os grupos</option>
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
          <details className="panel p-4" id="cadastro" open={Boolean(editing)}>
            <summary className="cursor-pointer text-lg font-black">{editing ? "Editar unidade" : "Cadastrar unidade"}</summary>
            <form action={savePortalUnidade} className="mt-4">
              <input name="id" type="hidden" value={String(editing?.id ?? "")} />
              <ResourceForm
                title={editing ? "Editar unidade" : "Nova unidade"}
                actions={
                  <>
                    <SubmitButton>{editing ? "Salvar alterações" : "Salvar unidade"}</SubmitButton>
                    {editing ? <Link className="button-secondary" href="/portal-associativo/unidades">Cancelar</Link> : null}
                  </>
                }
              >
                <FormSelect label="Grupo/Loteamento" name="loteamento_id" defaultValue={String(editing?.loteamento_id ?? "")} options={loteamentoOptions} />
                <UnitCodeFields defaultCode={String(editing?.codigo_unidade ?? "")} defaultNumber={String(editing?.numero_unidade ?? "")} defaultType={String(editing?.tipo_unidade ?? "chacara")} />
                <FormInput label="Quadra/setor" name="quadra_setor" defaultValue={String(editing?.quadra_setor ?? "")} />
                <FormSelect label="Proprietário" name="proprietario_id" defaultValue={preselectedOwner} options={personOptions} />
                <FormSelect label="Responsável pelo pagamento" name="responsavel_financeiro_id" defaultValue={preselectedOwner} options={personOptions} />
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
                <FormInput label="Dia de vencimento" name="vencimento_dia" type="number" defaultValue={String(editing?.vencimento_dia ?? "")} />
                <FormCheckbox label="Isento de mensalidade" name="isento_mensalidade" defaultChecked={editing?.isento_mensalidade === true} />
                <FormInput label="Área (m²)" name="area_m2" type="number" defaultValue={String(editing?.area_m2 ?? "")} />
                <FormInput label="Link do mapa" name="coordenadas_maps" defaultValue={String(editing?.coordenadas_maps ?? "")} />
                <FormCheckbox label="Possui construção" name="possui_construcao" defaultChecked={editing?.possui_construcao === true} />
                <FormTextarea label="Endereço/localização" name="endereco_localizacao" defaultValue={String(editing?.endereco_localizacao ?? "")} />
                <FormTextarea label="Observações" name="observacoes" defaultValue={String(editing?.observacoes ?? "")} />
              </ResourceForm>
            </form>
          </details>
        ) : null}

        <div className="grid gap-3 md:hidden">
          {(data.rows as Row[]).length ? (data.rows as Row[]).map((row) => (
            <article className="grid gap-3 rounded-2xl border border-border bg-card p-4" key={String(row.id)}>
              <div>
                <strong className="text-lg">{unitCardLabel(row)}</strong>
                <p className="text-sm text-muted-foreground">{statusLabel(row.status_unidade)} · {typeLabel(row.tipo_unidade)}</p>
              </div>
              <div className="grid gap-1 text-sm">
                <p><b>Proprietário:</b> {String(row.proprietario || "Não informado")}</p>
                <p><b>Quem paga:</b> {String(row.responsavel_financeiro || "Não informado")}</p>
                <p><b>Mensalidades:</b> {String(row.cobrancas_abertas)} aberta(s), {String(row.cobrancas_vencidas)} vencida(s)</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link className="button-primary justify-center" href={`/portal-associativo/unidades/${row.id}`}>Ver</Link>
                <Link className="button-secondary justify-center" href={`/portal-associativo/financeiro?unidade=${row.id}`}>Financeiro</Link>
                {canWrite ? <Link className="button-secondary col-span-2 justify-center" href={`/portal-associativo/transferencias?unidade=${row.id}`}>Transferir</Link> : null}
              </div>
            </article>
          )) : <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Nenhuma unidade cadastrada. Cadastre uma unidade ou importe uma planilha.</p>}
        </div>

        <div className="hidden md:block">
          <DataTable
            columns={[
              { key: "loteamento", label: "Grupo" },
              { key: "codigo_unidade", label: "Código" },
              { key: "numero_unidade", label: "Unidade" },
              { key: "tipo_visual", label: "Tipo" },
              { key: "proprietario", label: "Proprietário" },
              { key: "responsavel_financeiro", label: "Quem paga" },
              { key: "mensalidade", label: "Mensalidade" },
              { key: "status_visual", label: "Status" },
              { key: "criado_em", label: "Criada em" }
            ]}
            rows={(data.rows as Row[]).map((row) => ({
              ...row,
              tipo_visual: typeLabel(row.tipo_unidade),
              status_visual: statusLabel(row.status_unidade),
              mensalidade: row.isento_mensalidade === true ? "Isento" : row.valor_mensalidade ? formatMoney(row.valor_mensalidade) : "Padrão",
              criado_em: formatDate(row.criado_em)
            }))}
            actions={(row) =>
              canWrite ? (
                <div className="flex flex-wrap justify-end gap-2">
                  <Link className="button-secondary" href={`/portal-associativo/unidades?edit=${row.id}#cadastro`}>
                    Editar
                  </Link>
                  <Link className="button-secondary" href={`/portal-associativo/unidades/${row.id}`}>
                    Ficha
                  </Link>
                  <Link className="button-secondary" href={`/portal-associativo/financeiro?unidade=${row.id}`}>
                    Financeiro
                  </Link>
                  <Link className="button-secondary" href={`/portal-associativo/transferencias?unidade=${row.id}`}>
                    Transferir
                  </Link>
                  {row.status_unidade !== "inativa" ? (
                    <details className="rounded-xl border border-red-200 bg-red-50 p-2">
                      <summary className="cursor-pointer text-sm font-bold text-red-700">Inativar</summary>
                      <form action={inactivatePortalUnidade} className="mt-2">
                        <input name="id" type="hidden" value={String(row.id)} />
                        <button className="button-danger" type="submit">Confirmar</button>
                      </form>
                    </details>
                  ) : null}
                </div>
              ) : null
            }
          />
        </div>
      </section>
    </PortalAssociativoShell>
  );
}

function unitCardLabel(row: Row) {
  const codigo = String(row.codigo_unidade ?? "").trim();
  const numero = String(row.numero_unidade ?? "").trim();
  if (codigo && numero && codigo === numero) return `Unidade ${numero}`;
  return [codigo, numero].filter(Boolean).join(" - ") || "Unidade";
}

function statusLabel(value: unknown) {
  const labels: Record<string, string> = {
    ativa: "Ativa",
    inativa: "Inativa",
    bloqueada: "Bloqueada",
    vendida: "Vendida",
    em_transferencia: "Em transferência"
  };
  return labels[String(value ?? "")] ?? String(value ?? "-");
}

function typeLabel(value: unknown) {
  const labels: Record<string, string> = {
    chacara: "Chácara",
    lote: "Lote",
    casa: "Casa",
    sala: "Sala",
    box: "Box",
    propriedade: "Propriedade",
    outro: "Outro"
  };
  return labels[String(value ?? "")] ?? String(value ?? "-");
}
