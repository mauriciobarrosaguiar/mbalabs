"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import { booleanValue, messageParam, numberValue, textValue } from "@/lib/form-utils";
import { requireLavaGestorAccess, requireLavaGestorSettingsAccess } from "@/lib/lavagestor-permissions";
import {
  approveWhatsappMessage,
  buildWhatsappUrl,
  cancelWhatsappMessage,
  markWhatsappAsSent,
  saveWhatsappIntegration,
  sendPendingWhatsappMessages,
  sendWhatsappMessage,
  testWhatsappIntegration
} from "@/lib/lavagestor-whatsapp";
import { getSupabaseServer } from "@/lib/supabase";

export async function saveLavaWhatsappIntegrationAction(formData: FormData) {
  await requireLavaGestorSettingsAccess("/lavagestor/configuracoes");
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");

  try {
    await saveWhatsappIntegration(current, {
      provider: normalizeProvider(textValue(formData, "provider")),
      modoEnvio: normalizeMode(textValue(formData, "modo_envio")),
      numero: textValue(formData, "numero"),
      nomeExibicao: textValue(formData, "nome_exibicao"),
      instanciaId: textValue(formData, "instancia_id"),
      phoneNumberId: textValue(formData, "phone_number_id"),
      businessAccountId: textValue(formData, "business_account_id"),
      apiUrl: textValue(formData, "api_url"),
      apiKey: textValue(formData, "api_key"),
      accessToken: textValue(formData, "access_token"),
      webhookSecret: textValue(formData, "webhook_secret"),
      exigirAprovacao: booleanValue(formData, "exigir_aprovacao"),
      usarIaParaMensagens: booleanValue(formData, "usar_ia_para_mensagens"),
      enviarAgendamentoAuto: booleanValue(formData, "enviar_agendamento_auto"),
      enviarLembreteAuto: booleanValue(formData, "enviar_lembrete_auto"),
      enviarVeiculoRecebidoAuto: booleanValue(formData, "enviar_veiculo_recebido_auto"),
      enviarChecklistAuto: booleanValue(formData, "enviar_checklist_auto"),
      enviarVeiculoProntoAuto: booleanValue(formData, "enviar_veiculo_pronto_auto"),
      enviarPagamentoAuto: booleanValue(formData, "enviar_pagamento_auto"),
      enviarPosVendaAuto: booleanValue(formData, "enviar_pos_venda_auto"),
      enviarCobrancaAuto: booleanValue(formData, "enviar_cobranca_auto"),
      enviarPromocaoAuto: booleanValue(formData, "enviar_promocao_auto"),
      horarioEnvioInicio: textValue(formData, "horario_envio_inicio") || "08:00",
      horarioEnvioFim: textValue(formData, "horario_envio_fim") || "18:00",
      limiteMensagensClienteDia: numberValue(formData, "limite_mensagens_cliente_dia", 5),
      limiteTentativas: numberValue(formData, "limite_tentativas", 3)
    });
  } catch (err) {
    redirect(`/lavagestor/configuracoes?error=${messageParam(err instanceof Error ? err.message : "Falha ao salvar WhatsApp.")}`);
  }

  revalidatePath("/lavagestor/configuracoes");
  revalidatePath("/lavagestor/whatsapp");
  redirect(`/lavagestor/configuracoes?ok=${messageParam("Configuracao de WhatsApp salva.")}`);
}

export async function testLavaWhatsappIntegrationAction() {
  await requireLavaGestorSettingsAccess("/lavagestor/configuracoes");
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");
  try {
    const result = await testWhatsappIntegration(current);
    revalidatePath("/lavagestor/configuracoes");
    redirect(`/lavagestor/configuracoes?ok=${messageParam(result.detail)}`);
  } catch (err) {
    redirect(`/lavagestor/configuracoes?error=${messageParam(err instanceof Error ? err.message : "Falha ao testar WhatsApp.")}`);
  }
}

export async function approveLavaWhatsappMessageAction(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/whatsapp");
  const id = textValue(formData, "id");
  const returnTo = safeReturn(formData);
  try {
    await approveWhatsappMessage(current, id);
  } catch (err) {
    redirect(`${returnTo}?error=${messageParam(err instanceof Error ? err.message : "Falha ao aprovar mensagem.")}`);
  }
  revalidateWhatsappPaths();
  redirect(`${returnTo}?ok=${messageParam("Mensagem aprovada.")}`);
}

export async function cancelLavaWhatsappMessageAction(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/whatsapp");
  const id = textValue(formData, "id");
  const returnTo = safeReturn(formData);
  try {
    await cancelWhatsappMessage(current, id);
  } catch (err) {
    redirect(`${returnTo}?error=${messageParam(err instanceof Error ? err.message : "Falha ao cancelar mensagem.")}`);
  }
  revalidateWhatsappPaths();
  redirect(`${returnTo}?ok=${messageParam("Mensagem cancelada.")}`);
}

export async function sendLavaWhatsappMessageAction(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/whatsapp");
  const id = textValue(formData, "id");
  const returnTo = safeReturn(formData);
  const result = await sendWhatsappMessage(current, id);
  revalidateWhatsappPaths();
  if (result.url) {
    redirect(result.url);
  }
  if (!result.ok) {
    redirect(`${returnTo}?error=${messageParam(result.error || "Mensagem nao enviada.")}`);
  }
  redirect(`${returnTo}?ok=${messageParam("Mensagem enviada.")}`);
}

export async function markLavaWhatsappSentAction(formData: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/whatsapp");
  const returnTo = safeReturn(formData);
  const id = textValue(formData, "id");
  const client = (await getSupabaseServer()) as any;
  const result = await markWhatsappAsSent(client, String(current.empresaId), id, "envio");
  revalidateWhatsappPaths();
  if (!result.ok) {
    redirect(`${returnTo}?error=${messageParam(result.error || "Falha ao marcar envio.")}`);
  }
  redirect(`${returnTo}?ok=${messageParam("Mensagem marcada como enviada.")}`);
}

export async function sendPendingLavaWhatsappMessagesAction(formData?: FormData) {
  const { current } = await requireLavaGestorAccess("/lavagestor/whatsapp");
  const returnTo = formData ? safeReturn(formData) : "/lavagestor/whatsapp";
  try {
    const result = await sendPendingWhatsappMessages(current);
    revalidateWhatsappPaths();
    redirect(`${returnTo}?ok=${messageParam(`${result.synced} sincronizados, ${result.failed} com erro, ${result.skipped} ignorados.`)}`);
  } catch (err) {
    redirect(`${returnTo}?error=${messageParam(err instanceof Error ? err.message : "Falha ao enviar pendentes.")}`);
  }
}

export async function openManualWhatsappAction(formData: FormData) {
  const phone = textValue(formData, "telefone");
  const message = textValue(formData, "mensagem");
  const returnTo = safeReturn(formData);
  const url = buildWhatsappUrl(phone, message);
  if (!url) redirect(`${returnTo}?error=${messageParam("Telefone WhatsApp invalido.")}`);
  redirect(url);
}

function normalizeProvider(value: string) {
  if (value === "evolution" || value === "whatsapp_cloud_api") return value;
  return "manual";
}

function normalizeMode(value: string) {
  if (value === "automatico_com_aprovacao" || value === "automatico_total") return value;
  return "manual";
}

function safeReturn(formData: FormData) {
  const value = textValue(formData, "return_to");
  return value.startsWith("/lavagestor") && !value.startsWith("//") ? value : "/lavagestor/whatsapp";
}

function revalidateWhatsappPaths() {
  revalidatePath("/lavagestor");
  revalidatePath("/lavagestor/whatsapp");
  revalidatePath("/lavagestor/agendamentos");
  revalidatePath("/lavagestor/automacoes");
  revalidatePath("/lavagestor/fila");
}
