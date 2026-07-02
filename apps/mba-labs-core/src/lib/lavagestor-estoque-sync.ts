type Current = { empresaId: string | null; usuario: { id: string } };
type Row = Record<string, unknown>;

export async function baixarEstoqueDaLavagem(client: any, current: Current, lavagemId: string) {
  if (!current.empresaId) return { baixados: 0, avisos: ["Empresa nao identificada."] };
  const existing = await client
    .from("lava_estoque_movimentos")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", current.empresaId)
    .eq("lavagem_id", lavagemId)
    .eq("tipo", "baixa_servico");
  if ((existing.count ?? 0) > 0) return { baixados: 0, avisos: ["Baixa ja registrada para esta lavagem."] };

  const servicosResult = await client.from("lava_lavagem_servicos").select("servico_id").eq("empresa_id", current.empresaId).eq("lavagem_id", lavagemId);
  const servicoIds = Array.from(new Set(((servicosResult.data ?? []) as Row[]).map((row) => String(row.servico_id ?? "")).filter(Boolean)));
  if (servicoIds.length === 0) return { baixados: 0, avisos: [] };

  const insumosResult = await client
    .from("lava_servico_insumos")
    .select("servico_id,produto_id,quantidade_por_servico,lava_estoque_produtos(id,estoque_atual,custo_unitario,nome)")
    .eq("empresa_id", current.empresaId)
    .in("servico_id", servicoIds);
  const insumos = (insumosResult.data ?? []) as Row[];
  const avisos: string[] = [];
  let baixados = 0;

  for (const insumo of insumos) {
    const produto = relationObject(insumo.lava_estoque_produtos);
    const produtoId = String(insumo.produto_id ?? "");
    const quantidade = moneyNumber(insumo.quantidade_por_servico);
    if (!produtoId || quantidade <= 0 || !produto) continue;
    const estoqueAtual = moneyNumber(produto.estoque_atual);
    const novoEstoque = roundMoney(estoqueAtual - quantidade);
    if (novoEstoque < 0) avisos.push(`${produto.nome ?? "Produto"} ficou negativo (${novoEstoque}).`);
    await client.from("lava_estoque_produtos").update({ estoque_atual: novoEstoque }).eq("id", produtoId).eq("empresa_id", current.empresaId);
    await client.from("lava_estoque_movimentos").insert({
      empresa_id: current.empresaId,
      produto_id: produtoId,
      lavagem_id: lavagemId,
      servico_id: insumo.servico_id,
      usuario_id: current.usuario.id,
      tipo: "baixa_servico",
      quantidade,
      custo_unitario: moneyNumber(produto.custo_unitario),
      observacao: "Baixa automatica ao finalizar lavagem."
    });
    baixados += 1;
  }

  return { baixados, avisos };
}

function moneyNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function relationObject(value: unknown): Row | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Row) : null;
}
