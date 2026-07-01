"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAction, requireAppAccess } from "@/lib/core-data";
import { booleanValue, messageParam, nullableTextValue, numberValue, textValue } from "@/lib/form-utils";
import { requireLavaGestorSettingsAccess } from "@/lib/lavagestor-permissions";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveLavaConfiguracoesEmpresa(formData: FormData) {
  await requireLavaGestorSettingsAccess("/lavagestor/configuracoes");
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");
  const supabase = await getSupabaseServer();
  const empresaId = current.empresaId;

  if (!empresaId) {
    redirect(`/lavagestor/configuracoes?error=${messageParam("Empresa não identificada.")}`);
  }

  const nomeExibicao = textValue(formData, "nome_exibicao");
  if (!nomeExibicao) {
    redirect(`/lavagestor/configuracoes?error=${messageParam("Informe o nome que aparecerá no LavaGestor.")}`);
  }

  const payload = {
    empresa_id: empresaId,
    nome_exibicao: nomeExibicao,
    nome_fantasia: nullableTextValue(formData, "nome_fantasia"),
    documento: nullableTextValue(formData, "documento"),
    whatsapp: nullableTextValue(formData, "whatsapp"),
    telefone: nullableTextValue(formData, "telefone"),
    endereco: nullableTextValue(formData, "endereco"),
    cidade: nullableTextValue(formData, "cidade"),
    estado: nullableTextValue(formData, "estado"),
    chave_pix: nullableTextValue(formData, "chave_pix"),
    logo_url: nullableTextValue(formData, "logo_url"),
    cor_principal: textValue(formData, "cor_principal") || "#059669",
    percentual_comissao_padrao: numberValue(formData, "percentual_comissao_padrao", 35),
    forma_pagamento_padrao: textValue(formData, "forma_pagamento_padrao") || "pix",
    permitir_fiado: booleanValue(formData, "permitir_fiado"),
    permitir_desconto: booleanValue(formData, "permitir_desconto"),
    bloquear_entrega_sem_pagamento: booleanValue(formData, "bloquear_entrega_sem_pagamento"),
    exigir_checklist_antes_finalizar: booleanValue(formData, "exigir_checklist_antes_finalizar"),
    exigir_checklist_antes_entregar: booleanValue(formData, "exigir_checklist_antes_entregar"),
    permitir_recibo_sem_checklist: booleanValue(formData, "permitir_recibo_sem_checklist"),
    mensagem_veiculo_pronto: nullableTextValue(formData, "mensagem_veiculo_pronto"),
    mensagem_recibo: nullableTextValue(formData, "mensagem_recibo"),
    mensagem_pos_venda_agradecimento: nullableTextValue(formData, "mensagem_pos_venda_agradecimento"),
    mensagem_pesquisa_satisfacao: nullableTextValue(formData, "mensagem_pesquisa_satisfacao"),
    mensagem_retorno: nullableTextValue(formData, "mensagem_retorno"),
    mensagem_cobranca_fiado: nullableTextValue(formData, "mensagem_cobranca_fiado"),
    mensagem_promocao: nullableTextValue(formData, "mensagem_promocao"),
    motivos_cancelamento: listValue(formData, "motivos_cancelamento"),
    tipos_entrega: listValue(formData, "tipos_entrega"),
    checklist_itens_padrao: listValue(formData, "checklist_itens_padrao"),
    checklist_tipos_foto: listValue(formData, "checklist_tipos_foto")
  };

  const { error } = await (supabase as any)
    .from("lava_configuracoes")
    .upsert(payload, { onConflict: "empresa_id" });

  if (error) {
    redirect(`/lavagestor/configuracoes?error=${messageParam(error.message)}`);
  }

  await logAction({ appSlug: "lavagestor", acao: "salvar configurações", detalhes: { nome_exibicao: nomeExibicao } });
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/configuracoes");
  revalidatePath("/lavagestor/relatorios");
  redirect(`/lavagestor/configuracoes?ok=${messageParam("Configurações salvas com sucesso.")}`);
}

function listValue(formData: FormData, key: string) {
  return textValue(formData, key)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
