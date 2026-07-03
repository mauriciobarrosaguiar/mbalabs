"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { callGemini, defaultGeminiModel, removeLavaGeminiKey, saveLavaGeminiKey, testLavaGeminiDemo } from "@/lib/lavagestor-ai";
import {
  checkEvolutionStatus,
  createOrGetEvolutionInstance,
  disconnectEvolutionInstance,
  getEvolutionQrCode,
  reconnectEvolutionInstance
} from "@/lib/lavagestor-evolution";
import { encryptLavaSecret, redactSensitiveText } from "@/lib/lavagestor-secrets";
import { requireLavaGestorAccess } from "@/lib/lavagestor-permissions";
import {
  buildWhatsappUrl,
  generateWhatsappMessageWithIa,
  getWhatsappIntegration,
  normalizePhoneBR,
  sendWhatsappMessage,
  type WhatsappMode,
  type WhatsappProvider
} from "@/lib/lavagestor-whatsapp";
import { booleanValue, messageParam, textValue } from "@/lib/form-utils";
import { getSupabaseServer } from "@/lib/supabase";

type Row = Record<string, unknown>;

const SETUP_PATH = "/lavagestor/setup-facil";

export async function startEasySetupAction() {
  const { current } = await requireEasySetupEditor();
  await markEasySetup(current.empresaId, { setup_facil_started_at: new Date().toISOString(), setup_facil_status: "em_andamento", setup_facil_ultimo_erro: null });
  revalidateSetupPaths();
  redirect(`${SETUP_PATH}?step=ia&ok=${messageParam("Configuracao facil iniciada.")}`);
}

export async function saveAndTestGeminiEasyAction(formData: FormData) {
  const { current } = await requireEasySetupEditor();
  try {
    const apiKey = textValue(formData, "gemini_api_key");
    const model = textValue(formData, "iamob_model") || defaultGeminiModel();
    await saveLavaGeminiKey(current, apiKey, model, {
      mode: "gemini",
      allowPhotoAnalysis: true,
      allowPlateReading: true
    });
    const result = await callGemini(current, {
      prompt: "Responda apenas: IAMob conectado.",
      systemInstruction: "Voce testa uma conexao de IA. Seja breve.",
      fallbackText: "",
      logType: "setup_facil_teste_gemini",
      throwOnError: true
    });
    await markEasySetup(current.empresaId, { setup_facil_ultimo_teste_em: new Date().toISOString(), setup_facil_ultimo_erro: null, setup_facil_status: "em_andamento" });
    revalidateSetupPaths();
    redirect(`${SETUP_PATH}?step=whatsapp&ok=${messageParam(`IA conectada: ${result.text}`)}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const error = redactSensitiveText(err instanceof Error ? err.message : "Nao foi possivel testar a IA.");
    await markEasySetup(current.empresaId, { setup_facil_ultimo_teste_em: new Date().toISOString(), setup_facil_ultimo_erro: error, setup_facil_status: "em_andamento" }).catch(() => null);
    redirect(`${SETUP_PATH}?step=ia&error=${messageParam(friendlyGeminiError(error))}`);
  }
}

export async function removeGeminiEasyAction() {
  const { current } = await requireEasySetupEditor();
  try {
    await removeLavaGeminiKey(current);
    await markEasySetup(current.empresaId, { setup_facil_ultimo_erro: null, setup_facil_status: "em_andamento" });
    revalidateSetupPaths();
    redirect(`${SETUP_PATH}?step=ia&ok=${messageParam("IA removida. O IAMob voltou para o modo regras.")}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect(`${SETUP_PATH}?step=ia&error=${messageParam(err instanceof Error ? err.message : "Nao foi possivel remover a IA.")}`);
  }
}

export async function testGeminiEasyAction() {
  const { current } = await requireEasySetupEditor();
  try {
    const result = await callGemini(current, {
      prompt: "Responda apenas: IAMob conectado.",
      systemInstruction: "Voce testa uma conexao de IA. Seja breve.",
      fallbackText: "",
      logType: "setup_facil_teste_gemini",
      throwOnError: true
    });
    await markEasySetup(current.empresaId, { setup_facil_ultimo_teste_em: new Date().toISOString(), setup_facil_ultimo_erro: null });
    revalidateSetupPaths();
    redirect(`${SETUP_PATH}?step=ia&ok=${messageParam(`IA respondeu: ${result.text}`)}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const error = redactSensitiveText(err instanceof Error ? err.message : "Nao foi possivel testar a IA.");
    await markEasySetup(current.empresaId, { setup_facil_ultimo_teste_em: new Date().toISOString(), setup_facil_ultimo_erro: error }).catch(() => null);
    redirect(`${SETUP_PATH}?step=ia&error=${messageParam(friendlyGeminiError(error))}`);
  }
}

export async function startGeminiDemoAction() {
  const { current } = await requireEasySetupEditor();
  try {
    const result = await testLavaGeminiDemo(current);
    await markEasySetup(current.empresaId, { setup_facil_ultimo_teste_em: new Date().toISOString(), setup_facil_ultimo_erro: null, setup_facil_status: "em_andamento" });
    revalidateSetupPaths();
    redirect(`${SETUP_PATH}?step=ia&ok=${messageParam(`Demo Gemini respondeu: ${result.text}. Restam ${result.remaining} usos hoje.`)}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect(`${SETUP_PATH}?step=ia&error=${messageParam(err instanceof Error ? err.message : "Demo Gemini indisponivel.")}`);
  }
}

export async function createEvolutionEasyInstanceAction() {
  const { current } = await requireEasySetupEditor();
  try {
    const result = await createOrGetEvolutionInstance(current);
    await markEasySetup(current.empresaId, { setup_facil_status: "em_andamento", setup_facil_ultimo_erro: null });
    revalidateSetupPaths();
    redirect(`${SETUP_PATH}?step=whatsapp&ok=${messageParam(result.status === "conectado" ? "WhatsApp conectado." : "Instancia criada. Leia o QR Code para conectar.")}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect(`${SETUP_PATH}?step=whatsapp&error=${messageParam(err instanceof Error ? err.message : "Nao foi possivel criar o WhatsApp automatico.")}`);
  }
}

export async function getEvolutionEasyQrAction() {
  const { current } = await requireEasySetupEditor();
  try {
    const result = await getEvolutionQrCode(current);
    revalidateSetupPaths();
    return result;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : "Nao foi possivel gerar o QR Code." };
  }
}

export async function checkEvolutionEasyStatusAction() {
  const { current } = await requireEasySetupEditor();
  try {
    const result = await checkEvolutionStatus(current);
    revalidateSetupPaths();
    return result;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : "Nao foi possivel conferir o WhatsApp." };
  }
}

export async function disconnectEvolutionEasyAction() {
  const { current } = await requireEasySetupEditor();
  try {
    await disconnectEvolutionInstance(current);
    revalidateSetupPaths();
    redirect(`${SETUP_PATH}?step=whatsapp&ok=${messageParam("WhatsApp desconectado.")}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect(`${SETUP_PATH}?step=whatsapp&error=${messageParam(err instanceof Error ? err.message : "Nao foi possivel desconectar o WhatsApp.")}`);
  }
}

export async function reconnectEvolutionEasyAction() {
  const { current } = await requireEasySetupEditor();
  try {
    await reconnectEvolutionInstance(current);
    revalidateSetupPaths();
    redirect(`${SETUP_PATH}?step=whatsapp&ok=${messageParam("Reconexao iniciada. Leia o novo QR Code.")}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect(`${SETUP_PATH}?step=whatsapp&error=${messageParam(err instanceof Error ? err.message : "Nao foi possivel reconectar o WhatsApp.")}`);
  }
}

export async function saveEasyWhatsappModeAction(formData: FormData) {
  const { current } = await requireEasySetupEditor();
  try {
    const client = (await getSupabaseServer()) as any;
    const existing = await getExistingIntegrationRow(client, current.empresaId);
    const provider = normalizeProvider(textValue(formData, "provider") || String(existing?.provider || "manual"));
    const mode = normalizeMode(textValue(formData, "modo_envio"));
    const payload: Row = {
      empresa_id: current.empresaId,
      provider,
      status: existing?.status || (provider === "manual" ? "conectado" : "inativo"),
      modo_envio: mode,
      exigir_aprovacao: mode !== "automatico_total",
      usar_ia_para_mensagens: true,
      enviar_agendamento_auto: flagValue(formData, "enviar_agendamento_auto"),
      enviar_lembrete_auto: flagValue(formData, "enviar_lembrete_auto"),
      enviar_veiculo_recebido_auto: flagValue(formData, "enviar_veiculo_recebido_auto"),
      enviar_checklist_auto: flagValue(formData, "enviar_checklist_auto"),
      enviar_veiculo_pronto_auto: flagValue(formData, "enviar_veiculo_pronto_auto"),
      enviar_pagamento_auto: flagValue(formData, "enviar_pagamento_auto"),
      enviar_pos_venda_auto: flagValue(formData, "enviar_pos_venda_auto"),
      enviar_cobranca_auto: flagValue(formData, "enviar_cobranca_auto"),
      enviar_promocao_auto: flagValue(formData, "enviar_promocao_auto"),
      horario_envio_inicio: existing?.horario_envio_inicio || "08:00",
      horario_envio_fim: existing?.horario_envio_fim || "18:00",
      limite_mensagens_cliente_dia: existing?.limite_mensagens_cliente_dia || 5,
      limite_tentativas: existing?.limite_tentativas || 3,
      setup_facil: true
    };

    const apiUrl = textValue(formData, "api_url");
    const apiKey = textValue(formData, "api_key");
    const instance = textValue(formData, "instancia_id");
    const numero = textValue(formData, "numero");
    if (apiUrl) payload.api_url = apiUrl.replace(/\/+$/, "");
    else if (existing?.api_url) payload.api_url = existing.api_url;
    if (instance) payload.instancia_id = instance;
    else if (existing?.instancia_id) payload.instancia_id = existing.instancia_id;
    if (numero) payload.numero = normalizePhoneBR(numero) || numero;
    else if (existing?.numero) payload.numero = existing.numero;
    if (apiKey) payload.api_key_encrypted = encryptLavaSecret(apiKey, "whatsapp");
    else if (existing?.api_key_encrypted) payload.api_key_encrypted = existing.api_key_encrypted;

    const { error } = await client
      .from("lava_whatsapp_integracoes")
      .upsert(payload, { onConflict: "empresa_id,provider" });
    if (error) throw new Error(error.message);
    await markEasySetup(current.empresaId, { setup_facil_status: "em_andamento", setup_facil_ultimo_erro: null });
    revalidateSetupPaths();
    redirect(`${SETUP_PATH}?step=teste&ok=${messageParam("Modo de envio salvo.")}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect(`${SETUP_PATH}?step=whatsapp&error=${messageParam(err instanceof Error ? err.message : "Nao foi possivel salvar o modo de envio.")}`);
  }
}

export async function sendEasyIntegratedTestAction(formData: FormData) {
  const { current } = await requireEasySetupEditor();
  const phone = normalizePhoneBR(textValue(formData, "telefone_teste"));
  if (!phone) redirect(`${SETUP_PATH}?step=teste&error=${messageParam("Informe um WhatsApp valido para o teste.")}`);

  const fallback = "Teste do LavaGestor: IAMob e WhatsApp automatico estao em configuracao.";
  const client = (await getSupabaseServer()) as any;
  try {
    const generated = await generateWhatsappMessageWithIa(current, "teste_setup_facil", { empresa: "LavaGestor" }, fallback);
    const integration = await getWhatsappIntegration(current);
    await client
      .from("lava_whatsapp_envios")
      .update({ status: "cancelado", erro: null })
      .eq("empresa_id", current.empresaId)
      .eq("evento", "teste_setup_facil")
      .neq("status", "cancelado");

    const autoReady = integration.provider !== "manual" && integration.status === "conectado";
    const insert = await client
      .from("lava_whatsapp_envios")
      .insert({
        empresa_id: current.empresaId,
        usuario_id: current.usuario?.id ?? null,
        evento: "teste_setup_facil",
        telefone: phone,
        mensagem: generated.message,
        mensagem_gerada_por: generated.generatedBy,
        provider: autoReady ? integration.provider : "manual",
        status: autoReady ? "pendente" : "pronto",
        precisa_aprovacao: false,
        erro: generated.error || null
      })
      .select("id")
      .single();
    if (insert.error) throw new Error(insert.error.message);

    if (autoReady) {
      const sent = await sendWhatsappMessage(current, String(insert.data.id));
      if (!sent.ok) {
        await markEasySetup(current.empresaId, { setup_facil_ultimo_teste_em: new Date().toISOString(), setup_facil_ultimo_erro: sent.error || "WhatsApp nao enviado." });
        redirect(`${SETUP_PATH}?step=teste&error=${messageParam(sent.error || "WhatsApp nao enviado.")}`);
      }
      await markEasySetup(current.empresaId, { setup_facil_ultimo_teste_em: new Date().toISOString(), setup_facil_ultimo_erro: null });
      revalidateSetupPaths();
      redirect(`${SETUP_PATH}?step=pronto&ok=${messageParam("Teste enviado pelo WhatsApp automatico.")}`);
    }

    await markEasySetup(current.empresaId, { setup_facil_ultimo_teste_em: new Date().toISOString(), setup_facil_ultimo_erro: null });
    revalidateSetupPaths();
    redirect(buildWhatsappUrl(phone, generated.message));
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const error = redactSensitiveText(err instanceof Error ? err.message : "Nao foi possivel enviar o teste.");
    await markEasySetup(current.empresaId, { setup_facil_ultimo_teste_em: new Date().toISOString(), setup_facil_ultimo_erro: error }).catch(() => null);
    redirect(`${SETUP_PATH}?step=teste&error=${messageParam(error)}`);
  }
}

export async function finishEasySetupAction() {
  const { current } = await requireEasySetupEditor();
  const [integration, client] = await Promise.all([
    getWhatsappIntegration(current),
    getSupabaseServer() as any
  ]);
  const ready = integration.provider !== "manual" && integration.status === "conectado" && integration.modoEnvio !== "manual";
  if (!ready) {
    redirect(`${SETUP_PATH}?step=pronto&error=${messageParam("Conecte o WhatsApp automatico antes de finalizar.")}`);
  }
  const { error } = await client
    .from("lava_configuracoes")
    .upsert({
      empresa_id: current.empresaId,
      setup_facil_finished_at: new Date().toISOString(),
      setup_facil_status: "pronto",
      setup_facil_ultimo_erro: null
    }, { onConflict: "empresa_id" });
  if (error) redirect(`${SETUP_PATH}?step=pronto&error=${messageParam(error.message)}`);
  revalidateSetupPaths();
  redirect(`${SETUP_PATH}?step=pronto&ok=${messageParam("Setup finalizado. WhatsApp automatico pronto para usar.")}`);
}

async function requireEasySetupEditor() {
  const access = await requireLavaGestorAccess(SETUP_PATH);
  if (access.perfil !== "admin_master" && access.perfil !== "admin_empresa") {
    redirect(`/lavagestor?error=${messageParam("Seu perfil pode visualizar, mas nao pode alterar o setup facil.")}`);
  }
  return access;
}

async function markEasySetup(empresaId: string | null, payload: Row) {
  if (!empresaId) return;
  const client = (await getSupabaseServer()) as any;
  await client.from("lava_configuracoes").upsert({ empresa_id: empresaId, ...payload }, { onConflict: "empresa_id" });
}

async function getExistingIntegrationRow(client: any, empresaId: string | null) {
  if (!empresaId) return null;
  const { data } = await client
    .from("lava_whatsapp_integracoes")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("provider", "evolution")
    .maybeSingle();
  return (data ?? null) as Row | null;
}

function normalizeProvider(value: string): WhatsappProvider {
  if (value === "evolution" || value === "whatsapp_cloud_api") return value;
  return "manual";
}

function normalizeMode(value: string): WhatsappMode {
  if (value === "automatico_com_aprovacao" || value === "automatico_total") return value;
  return "manual";
}

function flagValue(formData: FormData, name: string) {
  return booleanValue(formData, name);
}

function friendlyGeminiError(error: string) {
  return `Nao foi possivel testar a IA. Confira a chave do Google AI Studio e tente novamente. Detalhe: ${error}`;
}

function revalidateSetupPaths() {
  revalidatePath(SETUP_PATH);
  revalidatePath("/lavagestor/configuracoes");
  revalidatePath("/lavagestor/iamob");
  revalidatePath("/lavagestor/whatsapp");
}
