import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader, formatDateTime, formatMoney } from "@/components/ui-kit";
import { createLavaEstoqueMovimento, criarProdutosPadraoLavaGestor, saveLavaEstoqueProduto, saveLavaServicoInsumo } from "@/lib/actions/lavagestor-estoque-actions";
import { firstParam } from "@/lib/form-utils";
import { LAVA_ESTOQUE_CATEGORIAS, LAVA_ESTOQUE_MOVIMENTOS, LAVA_ESTOQUE_UNIDADES, getLavaEstoqueData } from "@/lib/lavagestor-estoque-data";

export const dynamic = "force-dynamic";

export default async function EstoquePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const data = await getLavaEstoqueData();

  return (
    <LavaGestorShell activePath="/lavagestor/estoque">
      <section className="grid gap-5">
        <PageHeader
          eyebrow="LavaGestor"
          title="Estoque"
          description="Controle produtos, entradas, saidas e insumos por servico. A baixa automatica roda ao finalizar a lavagem e nao bloqueia a operacao."
          actions={<><BackButton href="/lavagestor" /><form action={criarProdutosPadraoLavaGestor}><button className="button-primary" type="submit">Criar produtos padrao</button></form></>}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? data.error ?? undefined} />

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Metric label="Produtos" value={data.summary.totalProdutos} />
          <Metric label="Estoque baixo" value={data.summary.estoqueBaixo} warning />
          <Metric label="Valor em estoque" value={formatMoney(data.summary.valorEstoque)} green />
          <Metric label="Consumo do mes" value={formatMoney(data.summary.consumoMes)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <form action={saveLavaEstoqueProduto} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black">Produto</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Nome" name="nome" required />
              <Select label="Categoria" name="categoria" options={LAVA_ESTOQUE_CATEGORIAS.map((item) => ({ value: item, label: item }))} />
              <Select label="Unidade base" name="unidade_base" options={LAVA_ESTOQUE_UNIDADES.map((item) => ({ value: item.value, label: item.label }))} />
              <Input label="Estoque atual" name="estoque_atual" type="number" step="0.001" defaultValue="0" />
              <Input label="Estoque minimo" name="estoque_minimo" type="number" step="0.001" defaultValue="0" />
              <Input label="Custo unitario" name="custo_unitario" type="number" step="0.01" defaultValue="0" />
            </div>
            <button className="button-primary w-fit" type="submit">Salvar produto</button>
          </form>

          <form action={createLavaEstoqueMovimento} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-black">Movimentacao</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black">Produto</span>
                <select className="input" name="produto_id" required>
                  <option value="">Selecione</option>
                  {data.produtos.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.nome)}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-black">Tipo</span>
                <select className="input" name="tipo" required>
                  {LAVA_ESTOQUE_MOVIMENTOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <Input label="Quantidade" name="quantidade" type="number" step="0.001" required />
              <Select label="Unidade" name="unidade_movimento" options={LAVA_ESTOQUE_UNIDADES.map((item) => ({ value: item.value, label: item.label }))} />
              <Input label="Custo unitario" name="custo_unitario" type="number" step="0.01" />
              <Input label="Custo total" name="custo_total" type="number" step="0.01" />
              <label className="grid gap-2 md:col-span-2">
                <span className="text-sm font-black">Observacao</span>
                <textarea className="input min-h-20" name="observacao" />
              </label>
            </div>
            <button className="button-primary w-fit" type="submit">Registrar movimento</button>
          </form>
        </div>

        <form action={saveLavaServicoInsumo} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Insumo por servico</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_160px_160px_auto]">
            <label className="grid gap-2">
              <span className="text-sm font-black">Servico</span>
              <select className="input" name="servico_id" required>
                <option value="">Selecione</option>
                {data.servicos.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.nome)}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-black">Produto</span>
              <select className="input" name="produto_id" required>
                <option value="">Selecione</option>
                {data.produtos.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.nome)}</option>)}
              </select>
            </label>
            <Input label="Qtd. por servico" name="quantidade_por_servico" type="number" step="0.001" required />
            <Select label="Unidade" name="unidade" options={LAVA_ESTOQUE_UNIDADES.map((item) => ({ value: item.value, label: item.label }))} />
            <button className="button-primary self-end" type="submit">Vincular</button>
          </div>
        </form>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Produtos</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.produtos.map((row) => {
              const baixo = Number(row.estoque_atual ?? 0) <= Number(row.estoque_minimo ?? 0);
              return (
                <article className={`rounded-lg border p-3 ${baixo ? "border-amber-200 bg-amber-50" : "border-border bg-white"}`} key={String(row.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <strong className="break-words">{String(row.nome)}</strong>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black">{String(row.unidade_base ?? row.unidade ?? "un")}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Info label="Atual" value={String(row.quantidade_label ?? row.estoque_atual ?? 0)} />
                    <Info label="Minimo" value={String(row.estoque_minimo ?? 0)} />
                    <Info label="Custo" value={formatMoney(row.custo_unitario)} />
                    <Info label="Valor" value={formatMoney(row.valor_estoque ?? Number(row.estoque_atual ?? 0) * Number(row.custo_unitario ?? 0))} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Insumos vinculados</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.insumos.map((row) => (
              <article className="rounded-lg border border-border p-3" key={String(row.id)}>
                <strong>{String(row.servico)}</strong>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">{String(row.produto)} - {String(row.quantidade_por_servico)} {String(row.unidade ?? "")}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-black">Ultimos movimentos</h2>
          {data.movimentos.length === 0 ? <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhum movimento registrado.</p> : null}
          <div className="grid gap-2">
            {data.movimentos.slice(0, 30).map((row) => (
              <div className="grid gap-2 rounded-lg border border-border p-3 text-sm md:grid-cols-[1fr_auto_auto_auto]" key={String(row.id)}>
                <strong>{String(row.produto || "Produto")}</strong>
                <span>{String(row.tipo)}</span>
                <span>{String(row.quantidade)} {String(row.unidade_movimento ?? "")}</span>
                <span className="text-muted-foreground">{formatDateTime(row.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </LavaGestorShell>
  );
}

function Metric({ label, value, green = false, warning = false }: { label: string; value: string | number; green?: boolean; warning?: boolean }) {
  const tone = green ? "border-emerald-200 bg-emerald-50" : warning ? "border-amber-200 bg-amber-50" : "border-border bg-white";
  return <div className={`rounded-xl border p-3 shadow-sm ${tone}`}><p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</p><strong className="mt-2 block break-words text-xl font-black">{value}</strong></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <span className="rounded-lg bg-muted px-2 py-2"><span className="block text-[10px] font-black uppercase text-muted-foreground">{label}</span><strong className="block truncate text-sm" title={value}>{value}</strong></span>;
}

function Input({ label, name, type = "text", required = false, defaultValue, placeholder, step }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string; placeholder?: string; step?: string }) {
  return <label className="grid gap-2"><span className="text-sm font-black">{label}</span><input className="input" name={name} type={type} required={required} defaultValue={defaultValue} placeholder={placeholder} step={step} /></label>;
}

function Select({ label, name, options }: { label: string; name: string; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <select className="input" name={name}>
        {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
  );
}
