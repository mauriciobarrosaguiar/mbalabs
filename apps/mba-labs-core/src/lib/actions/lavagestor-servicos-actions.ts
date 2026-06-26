"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { booleanValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveServicoAvancado(formData: FormData) {
  const current = await requireAppAccess("lavagestor");
  const supabase = await getSupabaseServer();
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
    ? await (supabase as any).from("lava_servicos").update(payload).eq("id", id).eq("empresa_id", current.empresaId)
    : await (supabase as any).from("lava_servicos").insert(payload);

  if (result.error) {
    redirect(`/lavagestor/servicos?error=${messageParam(result.error.message)}`);
  }

  await logAction({
    appSlug: "lavagestor",
    acao: id ? "editar serviço" : "criar serviço",
    detalhes: { nome, preco, tipo, aplicacao, categoria }
  });

  revalidatePath("/lavagestor/servicos");
  revalidatePath("/lavagestor/nova-lavagem");
  redirect(`/lavagestor/servicos?ok=${messageParam("Serviço salvo com sucesso.")}`);
}
