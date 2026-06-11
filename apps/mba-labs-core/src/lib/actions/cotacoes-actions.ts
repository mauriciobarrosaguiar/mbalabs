"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUserProfile, logAction } from "@/lib/core-data";
import { booleanValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveProduto(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");

  if (!nome) {
    redirect(`/cotacoes/produtos?error=${messageParam("Informe o nome do produto.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    ean: nullableTextValue(formData, "ean"),
    nome,
    laboratorio: nullableTextValue(formData, "laboratorio"),
    apresentacao: nullableTextValue(formData, "apresentacao"),
    ativo: booleanValue(formData, "ativo")
  };

  const result = id
    ? await (supabase as any).from("cot_produtos").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("cot_produtos").insert(payload);

  if (result.error) {
    redirect(`/cotacoes/produtos?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "mba-cotacoes", acao: id ? "editar produto" : "criar produto", detalhes: { nome } });
  revalidatePath("/cotacoes/produtos");
  redirect(`/cotacoes/produtos?ok=${messageParam("Produto salvo com sucesso.")}`);
}

export async function inactivateProduto(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");

  const { error } = await (supabase as any)
    .from("cot_produtos")
    .update({ ativo: false })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/cotacoes/produtos?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "mba-cotacoes", acao: "inativar produto", detalhes: { id } });
  revalidatePath("/cotacoes/produtos");
  redirect(`/cotacoes/produtos?ok=${messageParam("Produto inativado.")}`);
}

export async function saveVendedor(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");
  const nome = textValue(formData, "nome");

  if (!nome) {
    redirect(`/cotacoes/vendedores?error=${messageParam("Informe o nome do vendedor.")}`);
  }

  const payload = {
    empresa_id: current.empresaId,
    nome,
    empresa_vendedora: nullableTextValue(formData, "empresa_vendedora"),
    telefone: nullableTextValue(formData, "telefone"),
    email: nullableTextValue(formData, "email"),
    ativo: booleanValue(formData, "ativo")
  };

  const result = id
    ? await (supabase as any).from("cot_vendedores").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("cot_vendedores").insert(payload);

  if (result.error) {
    redirect(`/cotacoes/vendedores?error=${messageParam(result.error.message)}`);
  }

  await logAction({ appSlug: "mba-cotacoes", acao: id ? "editar vendedor" : "criar vendedor", detalhes: { nome } });
  revalidatePath("/cotacoes/vendedores");
  redirect(`/cotacoes/vendedores?ok=${messageParam("Vendedor salvo com sucesso.")}`);
}

export async function inactivateVendedor(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");

  const { error } = await (supabase as any)
    .from("cot_vendedores")
    .update({ ativo: false })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/cotacoes/vendedores?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "mba-cotacoes", acao: "inativar vendedor", detalhes: { id } });
  revalidatePath("/cotacoes/vendedores");
  redirect(`/cotacoes/vendedores?ok=${messageParam("Vendedor inativado.")}`);
}

export async function createCotacao(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const titulo = textValue(formData, "titulo");

  if (!titulo) {
    redirect(`/cotacoes/nova?error=${messageParam("Informe o título da cotação.")}`);
  }

  const productIds = formData
    .getAll("produto_id")
    .map((value) => String(value ?? "").trim());
  const quantities = formData.getAll("quantidade").map((value) => Number(String(value ?? "1").replace(",", ".")));
  const observations = formData.getAll("item_observacao").map((value) => String(value ?? "").trim());
  const items = productIds
    .map((produtoId, index) => ({
      produto_id: produtoId,
      quantidade: Number.isFinite(quantities[index]) && quantities[index] > 0 ? quantities[index] : 1,
      observacao: observations[index] || null
    }))
    .filter((item) => item.produto_id);

  if (items.length === 0) {
    redirect(`/cotacoes/nova?error=${messageParam("Selecione pelo menos um produto.")}`);
  }

  const { data: cotacao, error } = await client
    .from("cot_cotacoes")
    .insert({
      empresa_id: current.empresaId,
      titulo,
      observacao: nullableTextValue(formData, "observacao"),
      status: "aberta",
      criada_por: current.usuario.id
    })
    .select("id")
    .single();

  if (error || !cotacao?.id) {
    redirect(`/cotacoes/nova?error=${messageParam(error?.message ?? "Não foi possível criar a cotação.")}`);
  }

  const { error: itemsError } = await client.from("cot_cotacao_itens").insert(
    items.map((item) => ({
      cotacao_id: cotacao.id,
      ...item
    }))
  );

  if (itemsError) {
    redirect(`/cotacoes/${cotacao.id}?error=${messageParam(itemsError.message)}`);
  }

  await logAction({ appSlug: "mba-cotacoes", acao: "criar cotação", detalhes: { titulo, itens: items.length } });
  revalidatePath("/cotacoes");
  redirect(`/cotacoes/${cotacao.id}?ok=${messageParam("Cotação criada com sucesso.")}`);
}

export async function finalizarCotacao(formData: FormData) {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const id = textValue(formData, "id");

  const { error } = await (supabase as any)
    .from("cot_cotacoes")
    .update({ status: "finalizada" })
    .eq("id", id)
    .eq("empresa_id", current.empresaId);

  if (error) {
    redirect(`/cotacoes/${id}?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "mba-cotacoes", acao: "finalizar cotação", detalhes: { id } });
  revalidatePath("/cotacoes");
  redirect(`/cotacoes/${id}?ok=${messageParam("Cotação finalizada.")}`);
}
