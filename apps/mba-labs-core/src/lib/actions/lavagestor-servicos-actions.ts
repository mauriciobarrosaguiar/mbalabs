"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { booleanValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveServicoAvancado(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");
  const preco = numberValue(formData, "preco");
  const categoria = textValue(formData, "categoria") || "principal";
  const tipo = textValue(formData, "tipo") || "lavagem";
  const aplicacao = textValue(formData, "aplicacao") || "carro";

  if (!nome) {
    redirect(`/lavagestor/servicos?error=${messageParam("Informe o nome do serviço.")}`);
  }

  if (preco < 0) {
    redirect(`/lavagestor/servicos?error=${messageParam("O preço não pode ser negativo.")}`);
  }

  const percentualText = nullableTextValue(formData, "percentual_comissao");
  const payload = {
    empresa_id: current.empresaId,
    nome,
    descricao: nullableTextValue(formData, "descricao"),
    preco,
    percentual_comissao: percentualText === null ? null : numberValue(formData, "percentual_comissao"),
    tipo,
    aplicacao,
    categoria,
    adicional: categoria === "adicional" || tipo === "adicional" || booleanValue(formData, "adicional"),
    tempo_estimado_min: numberValue(formData, "tempo_estimado_min") || null,
    ordem: numberValue(formData, "ordem"),
    ativo: booleanValue(formData, "ativo")
  };

  const result = id
    ? await client.from("lava_servicos").update(payload).eq("id", id).eq("empresa_id", current.empresaId).select("id").maybeSingle()
    : await client.from("lava_servicos").insert(payload).select("id").maybeSingle();

  if (result.error || !result.data?.id) {
    redirect(`/lavagestor/servicos?error=${messageParam(result.error?.message ?? "Não foi possível salvar o serviço.")}`);
  }

  await saveServicoInsumos(client, current.empresaId, String(result.data.id), formData);

  await logAction({
    appSlug: "lavagestor",
    acao: id ? "editar serviço" : "criar serviço",
    detalhes: { nome, preco, tipo, aplicacao, categoria }
  });

  revalidatePath("/lavagestor/servicos");
  revalidatePath("/lavagestor/estoque");
  revalidatePath("/lavagestor/nova-lavagem");
  revalidatePath("/lavagestor/operacao/entrada");
  redirect(`/lavagestor/servicos?ok=${messageParam("Serviço salvo com sucesso.")}`);
}

async function saveServicoInsumos(client: any, empresaId: string | null, servicoId: string, formData: FormData) {
  const produtoIds = formData.getAll("insumo_produto_id").map((value) => String(value).trim());
  const quantidades = formData.getAll("insumo_quantidade").map((value) => String(value).trim());
  const pares = produtoIds
    .map((produtoId, index) => ({ produtoId, quantidade: Number(String(quantidades[index] ?? "0").replace(",", ".")) }))
    .filter((item) => item.produtoId && Number.isFinite(item.quantidade) && item.quantidade > 0);

  await client.from("lava_servico_insumos").delete().eq("empresa_id", empresaId).eq("servico_id", servicoId);

  if (pares.length === 0) return;

  const { data: produtos, error } = await client
    .from("lava_estoque_produtos")
    .select("id,unidade_base,unidade")
    .eq("empresa_id", empresaId)
    .in("id", pares.map((item) => item.produtoId));

  if (error) {
    redirect(`/lavagestor/servicos?error=${messageParam(error.message)}`);
  }

  const produtosMap = new Map(((produtos ?? []) as Array<Record<string, unknown>>).map((produto) => [String(produto.id), produto]));
  const rows = pares
    .filter((item) => produtosMap.has(item.produtoId))
    .map((item) => {
      const produto = produtosMap.get(item.produtoId)!;
      return {
        empresa_id: empresaId,
        servico_id: servicoId,
        produto_id: item.produtoId,
        quantidade_por_servico: item.quantidade,
        unidade: String(produto.unidade_base ?? produto.unidade ?? "un")
      };
    });

  if (rows.length > 0) {
    const { error: insertError } = await client.from("lava_servico_insumos").insert(rows);
    if (insertError) redirect(`/lavagestor/servicos?error=${messageParam(insertError.message)}`);
  }
}

export async function criarServicosPadraoLavaGestor() {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const { data: existing, error: existingError } = await client
    .from("lava_servicos")
    .select("nome")
    .eq("empresa_id", current.empresaId);

  if (existingError) {
    redirect(`/lavagestor/servicos?error=${messageParam(existingError.message)}`);
  }

  const existingNames = new Set(((existing ?? []) as Array<Record<string, unknown>>).map((row) => normalizeName(row.nome)));
  const rows = SERVICOS_PADRAO.filter((servico) => !existingNames.has(normalizeName(servico.nome))).map((servico, index) => ({
    empresa_id: current.empresaId,
    nome: servico.nome,
    descricao: servico.descricao,
    preco: servico.preco,
    percentual_comissao: null,
    tipo: servico.tipo,
    aplicacao: servico.aplicacao,
    categoria: servico.categoria,
    adicional: servico.adicional,
    tempo_estimado_min: null,
    ordem: index + 1,
    ativo: true
  }));

  if (rows.length > 0) {
    const { error } = await client.from("lava_servicos").insert(rows);
    if (error) {
      redirect(`/lavagestor/servicos?error=${messageParam(error.message)}`);
    }
  }

  await logAction({ appSlug: "lavagestor", acao: "criar servicos padrao", detalhes: { criados: rows.length } });
  revalidatePath("/lavagestor/servicos");
  revalidatePath("/lavagestor/nova-lavagem");
  revalidatePath("/lavagestor/operacao/entrada");
  redirect(`/lavagestor/servicos?ok=${messageParam(rows.length ? "Serviços padrão criados com sucesso. Você pode ajustar os preços." : "Serviços padrão já estavam cadastrados.")}`);
}

const SERVICOS_PADRAO = [
  { nome: "Lavagem simples carro", descricao: "Servico principal para carro.", tipo: "lavagem", aplicacao: "carro", categoria: "principal", adicional: false, preco: 40 },
  { nome: "Lavagem completa carro", descricao: "Lavagem completa externa e interna.", tipo: "lavagem", aplicacao: "carro", categoria: "principal", adicional: false, preco: 60 },
  { nome: "Lavagem moto", descricao: "Servico principal para moto.", tipo: "lavagem", aplicacao: "moto", categoria: "principal", adicional: false, preco: 25 },
  { nome: "Lavagem caminhonete", descricao: "Servico principal para caminhonete.", tipo: "lavagem", aplicacao: "caminhonete", categoria: "principal", adicional: false, preco: 80 },
  { nome: "Higienizacao interna", descricao: "Higienizacao interna do veiculo.", tipo: "higienizacao", aplicacao: "carro", categoria: "principal", adicional: false, preco: 150 },
  { nome: "Lavagem de motor", descricao: "Adicional para motor.", tipo: "lavagem", aplicacao: "carro", categoria: "adicional", adicional: true, preco: 40 },
  { nome: "Polimento simples", descricao: "Polimento simples do veiculo.", tipo: "polimento", aplicacao: "carro", categoria: "principal", adicional: false, preco: 200 },
  { nome: "Sofa", descricao: "Higienizacao de sofa.", tipo: "higienizacao", aplicacao: "sofa", categoria: "principal", adicional: false, preco: 120 },
  { nome: "Tapete", descricao: "Higienizacao de tapete.", tipo: "higienizacao", aplicacao: "tapete", categoria: "principal", adicional: false, preco: 25 },
  { nome: "Adicional: cera", descricao: "Aplicacao de cera.", tipo: "adicional", aplicacao: "todos", categoria: "adicional", adicional: true, preco: 20 },
  { nome: "Adicional: aspiracao", descricao: "Aspiracao interna.", tipo: "adicional", aplicacao: "todos", categoria: "adicional", adicional: true, preco: 15 },
  { nome: "Adicional: pretinho", descricao: "Aplicacao de pretinho nos pneus.", tipo: "adicional", aplicacao: "todos", categoria: "adicional", adicional: true, preco: 10 }
];

function normalizeName(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}
