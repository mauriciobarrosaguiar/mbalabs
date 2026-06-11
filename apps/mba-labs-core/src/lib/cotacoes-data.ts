import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "./core-data";
import { includesSearch } from "./form-utils";
import { getSupabaseServer } from "./supabase";

export type CotacaoStatus = "aberta" | "finalizada";

export async function getCotacoesDashboard() {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const [produtos, vendedores, abertas, finalizadas, pedidos] = await Promise.all([
    countByEmpresa(client, "cot_produtos", current.empresaId, { ativo: true }),
    countByEmpresa(client, "cot_vendedores", current.empresaId, { ativo: true }),
    countByEmpresa(client, "cot_cotacoes", current.empresaId, { status: "aberta" }),
    countByEmpresa(client, "cot_cotacoes", current.empresaId, { status: "finalizada" }),
    countByEmpresa(client, "cot_pedidos", current.empresaId)
  ]);

  return {
    produtos,
    vendedores,
    abertas,
    finalizadas,
    pedidos
  };
}

export async function listCotProdutos(search = "") {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("cot_produtos")
    .select("id,ean,nome,laboratorio,apresentacao,ativo,created_at")
    .eq("empresa_id", current.empresaId)
    .order("nome", { ascending: true })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) =>
    includesSearch(row, ["nome", "ean", "laboratorio"], search)
  );

  return { rows, error: error?.message ?? null };
}

export async function listCotVendedores(search = "") {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("cot_vendedores")
    .select("id,nome,empresa_vendedora,telefone,email,ativo,created_at")
    .eq("empresa_id", current.empresaId)
    .order("nome", { ascending: true })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).filter((row) =>
    includesSearch(row, ["nome", "empresa_vendedora", "telefone", "email"], search)
  );

  return { rows, error: error?.message ?? null };
}

export async function listCotacoes(status?: CotacaoStatus) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  let query = (supabase as any)
    .from("cot_cotacoes")
    .select("id,titulo,status,observacao,created_at")
    .eq("empresa_id", current.empresaId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  return { rows: (data ?? []) as Array<Record<string, unknown>>, error: error?.message ?? null };
}

export async function getCotacoesLookups() {
  const [produtos, vendedores] = await Promise.all([listCotProdutos(), listCotVendedores()]);

  return {
    produtos: produtos.rows.filter((row) => row.ativo !== false),
    vendedores: vendedores.rows.filter((row) => row.ativo !== false)
  };
}

export async function getCotacaoDetail(id: string) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const { data: cotacao, error } = await client
    .from("cot_cotacoes")
    .select("id,titulo,status,observacao,created_at")
    .eq("id", id)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();

  if (error) {
    return { cotacao: null, items: [], responses: [], error: error.message };
  }

  if (!cotacao) {
    redirect("/cotacoes/abertas");
  }

  const [items, responses] = await Promise.all([
    client
      .from("cot_cotacao_itens")
      .select("id,produto_id,quantidade,observacao,cot_produtos(nome,ean,laboratorio)")
      .eq("cotacao_id", id)
      .order("created_at", { ascending: true }),
    client
      .from("cot_respostas")
      .select("id,preco,comentario,respondido_em,cot_vendedores(nome)")
      .eq("cotacao_id", id)
      .order("respondido_em", { ascending: false })
  ]);

  return {
    cotacao: cotacao as Record<string, unknown>,
    items: ((items.data ?? []) as Array<Record<string, unknown>>).map<Record<string, unknown>>((row) => ({
      ...row,
      produto: productLabel(row.cot_produtos)
    })),
    responses: ((responses.data ?? []) as Array<Record<string, unknown>>).map<Record<string, unknown>>((row) => ({
      ...row,
      vendedor: relationName(row.cot_vendedores)
    })),
    error: items.error?.message ?? responses.error?.message ?? null
  };
}

export async function listCotPedidos() {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from("cot_pedidos")
    .select("id,cotacao_id,status,total,created_at,cot_vendedores(nome,empresa_vendedora),cot_cotacoes(titulo)")
    .eq("empresa_id", current.empresaId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map<Record<string, unknown>>((row) => ({
    ...row,
    vendedor: relationName(row.cot_vendedores) || "-",
    cotacao: relationTitle(row.cot_cotacoes) || "-"
  }));

  return { rows, error: error?.message ?? null };
}

async function countByEmpresa(
  client: any,
  table: string,
  empresaId: string,
  filters: Record<string, unknown> = {}
) {
  let query = client.from(table).select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  const { count } = await query;
  return count ?? 0;
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) {
    return String((relation as { nome?: unknown }).nome ?? "");
  }

  return "";
}

function relationTitle(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "titulo" in relation) {
    return String((relation as { titulo?: unknown }).titulo ?? "");
  }

  return "";
}

function productLabel(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") {
    return "-";
  }

  const produto = relation as { nome?: unknown; ean?: unknown; laboratorio?: unknown };
  return [produto.nome, produto.ean, produto.laboratorio].filter(Boolean).join(" - ");
}
