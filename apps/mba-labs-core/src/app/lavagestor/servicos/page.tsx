import Link from "next/link";
import { LavaGestorShell } from "@/components/LavaGestorShell";
import {
  BackButton,
  DataTable,
  DeleteButton,
  FormCheckbox,
  FormInput,
  FormMoneyInput,
  FormSelect,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SearchBox,
  SubmitButton,
  formatDate,
  formatMoney
} from "@/components/ui-kit";
import { inactivateServico } from "@/lib/actions/lavagestor-actions";
import { criarServicosPadraoLavaGestor, saveServicoAvancado } from "@/lib/actions/lavagestor-servicos-actions";
import { requireAppAccess } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";
import {
  LAVA_SERVICE_APPLICATION_OPTIONS,
  LAVA_SERVICE_CATEGORY_OPTIONS,
  LAVA_SERVICE_TYPE_OPTIONS,
  listLavaServicosAvancados
} from "@/lib/lavagestor-servicos-data";
import { firstParam } from "@/lib/form-utils";

type ServiceRow = Record<string, unknown>;
type ProdutoRow = Record<string, unknown>;
type InsumoRow = Record<string, unknown>;

export const dynamic = "force-dynamic";

export default async function ServicosPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const search = firstParam(params.q) ?? "";
  const editId = firstParam(params.edit);
  const result = await listLavaServicosAvancados(search);
  const rows = result.rows as ServiceRow[];
  const serviceIds = rows.map((row) => String(row.id ?? "")).filter(Boolean);
  const [{ data: produtosData, error: produtosError }, { data: insumosData, error: insumosError }] = await Promise.all([
    client
      .from("lava_estoque_produtos")
      .select("id,nome,unidade,unidade_base,ativo")
      .eq("empresa_id", current.empresaId)
      .eq("ativo", true)
      .order("nome", { ascending: true })
      .limit(300),
    serviceIds.length
      ? client
          .from("lava_servico_insumos")
          .select("id,servico_id,produto_id,quantidade_por_servico,unidade,lava_estoque_produtos(nome,unidade,unidade_base)")
          .eq("empresa_id", current.empresaId)
          .in("servico_id", serviceIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null })
  ]);
  const produtos = (produtosData ?? []) as ProdutoRow[];
  const insumos = (insumosData ?? []) as InsumoRow[];
  const insumosPorServico = insumos.reduce<Record<string, InsumoRow[]>>((map, insumo) => {
    const servicoId = String(insumo.servico_id ?? "");
    if (!servicoId) return map;
    map[servicoId] = [...(map[servicoId] ?? []), insumo];
    return map;
  }, {});
  const error = result.error ?? produtosError?.message ?? insumosError?.message ?? null;
  const editing = rows.find((row) => String(row.id) === String(editId ?? ""));
  const editingInsumos = editing ? insumosPorServico[String(editing.id)] ?? [] : [];

  return (
    <LavaGestorShell activePath="/lavagestor/servicos">
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Serviços"
          description="Cadastre serviços principais e adicionais com tipo, aplicação, preço e comissão. Isso alimenta automaticamente a Nova Lavagem."
          actions={<><BackButton href="/lavagestor" /><form action={criarServicosPadraoLavaGestor}><button className="button-primary" type="submit">Criar servicos padrao</button></form></>}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />
        <SearchBox defaultValue={search} placeholder="Buscar por nome, tipo, aplicação ou descrição" />

        <form action={saveServicoAvancado}>
          <input name="id" type="hidden" value={String(editing?.id ?? "")} />
          <ResourceForm
            title={editing ? "Editar serviço" : "Novo serviço"}
            actions={
              <>
                <SubmitButton>{editing ? "Salvar alterações" : "Salvar serviço"}</SubmitButton>
                {editing ? <Link className="button-secondary" href="/lavagestor/servicos">Cancelar</Link> : null}
              </>
            }
          >
            <FormInput label="Nome do serviço" name="nome" defaultValue={String(editing?.nome ?? "")} required placeholder="Ex.: Lavagem simples carro pequeno" />
            <FormMoneyInput label="Preço padrão" name="preco" defaultValue={String(editing?.preco ?? 0)} />
            <FormSelect
              label="Tipo do serviço"
              name="tipo"
              defaultValue={String(editing?.tipo ?? "lavagem")}
              options={LAVA_SERVICE_TYPE_OPTIONS}
            />
            <FormSelect
              label="Aplicação"
              name="aplicacao"
              defaultValue={String(editing?.aplicacao ?? "carro")}
              options={LAVA_SERVICE_APPLICATION_OPTIONS}
            />
            <FormSelect
              label="Categoria"
              name="categoria"
              defaultValue={String(editing?.categoria ?? (editing?.adicional ? "adicional" : "principal"))}
              options={LAVA_SERVICE_CATEGORY_OPTIONS}
            />
            <FormInput
              label="Comissão padrão %"
              name="percentual_comissao"
              type="number"
              min="0"
              step="0.01"
              defaultValue={String(editing?.percentual_comissao ?? "")}
            />
            <FormInput
              label="Tempo estimado em minutos"
              name="tempo_estimado_min"
              type="number"
              min="0"
              step="1"
              defaultValue={String(editing?.tempo_estimado_min ?? "")}
            />
            <FormInput
              label="Ordem de exibição"
              name="ordem"
              type="number"
              min="0"
              step="1"
              defaultValue={String(editing?.ordem ?? 0)}
            />
            <FormCheckbox label="Serviço adicional" name="adicional" defaultChecked={Boolean(editing?.adicional)} />
            <FormCheckbox label="Serviço ativo" name="ativo" defaultChecked={editing ? editing.ativo !== false : true} />
            <FormTextarea label="Descrição / observações internas" name="descricao" defaultValue={String(editing?.descricao ?? "")} />

            <div className="grid gap-3 rounded-[18px] border border-emerald-100 bg-emerald-50 p-4 md:col-span-2">
              <div>
                <h3 className="text-base font-black text-slate-950">Produtos usados neste serviço</h3>
                <p className="text-sm font-semibold text-slate-600">Informe quanto de cada produto esse serviço consome. A baixa acontece automaticamente ao finalizar a lavagem.</p>
              </div>
              {produtos.length === 0 ? (
                <p className="rounded-xl bg-white p-3 text-sm font-bold text-slate-700">Cadastre produtos no estoque para vincular ao serviço.</p>
              ) : (
                <div className="grid gap-2">
                  {[0, 1, 2, 3, 4].map((index) => {
                    const insumo = editingInsumos[index];
                    return (
                      <div className="grid gap-2 rounded-xl bg-white p-3 md:grid-cols-[1fr_160px]" key={index}>
                        <label className="grid gap-1">
                          <span className="text-xs font-black uppercase text-slate-600">Produto</span>
                          <select className="input" name="insumo_produto_id" defaultValue={String(insumo?.produto_id ?? "")}>
                            <option value="">Selecione</option>
                            {produtos.map((produto) => (
                              <option key={String(produto.id)} value={String(produto.id)}>
                                {String(produto.nome)} ({String(produto.unidade_base ?? produto.unidade ?? "un")})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-black uppercase text-slate-600">Quantidade</span>
                          <input className="input" name="insumo_quantidade" type="number" min="0" step="0.001" defaultValue={String(insumo?.quantidade_por_servico ?? "")} />
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ResourceForm>
        </form>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ResumoCard label="Serviços ativos" value={rows.filter((row) => row.ativo !== false).length} />
          <ResumoCard label="Principais" value={rows.filter((row) => row.categoria === "principal").length} />
          <ResumoCard label="Adicionais" value={rows.filter((row) => row.adicional === true || row.categoria === "adicional").length} />
          <ResumoCard label="Sofá/Tapete/Máquina" value={rows.filter((row) => ["sofa", "tapete", "maquina"].includes(String(row.aplicacao))).length} />
        </div>

        <DataTable
          columns={[
            { key: "nome", label: "Serviço" },
            { key: "aplicacao_label", label: "Aplicação" },
            { key: "categoria_label", label: "Categoria" },
            { key: "preco", label: "Preço" },
            { key: "percentual_comissao", label: "Comissão %" },
            { key: "insumos_resumo", label: "Produtos usados" },
            { key: "ativo", label: "Ativo" },
            { key: "created_at", label: "Criado em" }
          ]}
          rows={rows.map((row) => ({
            ...row,
            preco: formatMoney(row.preco),
            percentual_comissao: row.percentual_comissao === null || row.percentual_comissao === undefined ? "Padrão do lavador" : `${row.percentual_comissao}%`,
            insumos_resumo: resumoInsumos(insumosPorServico[String(row.id)] ?? []),
            tempo_estimado_min: row.tempo_estimado_min ? `${row.tempo_estimado_min} min` : "-",
            ativo: row.ativo === false ? "Não" : "Sim",
            created_at: formatDate(row.created_at)
          }))}
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

function ResumoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function resumoInsumos(insumos: InsumoRow[]) {
  if (insumos.length === 0) return "-";
  return insumos.map((insumo) => `${produtoNome(insumo.lava_estoque_produtos)}: ${insumo.quantidade_por_servico} ${insumo.unidade ?? ""}`).join(", ");
}

function produtoNome(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) {
    return String((relation as { nome?: unknown }).nome ?? "Produto");
  }
  return "Produto";
}
