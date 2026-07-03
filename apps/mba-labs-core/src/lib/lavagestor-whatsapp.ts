import "server-only";

import { generateIamobMessage } from "./lavagestor-ai";
import { decryptLavaSecret, encryptLavaSecret, redactSensitiveText } from "./lavagestor-secrets";
import { getSupabaseServer } from "./supabase";

type DbClient = any;
type Row = Record<string, unknown>;
type Current = { empresaId: string | null; usuario?: { id?: string | null } };

type QueueInput = {
  empresaId: string;
  clienteId?: string | null;
  lavagemId?: string | null;
  agendamentoId?: string | null;
  automacaoId?: string | null;
  automacaoFilaId?: string | null;
  telefone?: string | null;
  mensagem: string;
  tipo?: string;
  evento?: string;
  agendadoPara?: string | null;
};

export type WhatsappProvider = "manual" | "evolution" | "whatsapp_cloud_api";
export type WhatsappMode = "manual" | "automatico_com_aprovacao" | "automatico_total";

export type WhatsappIntegrationInput = {
  provider: WhatsappProvider;
  modoEnvio: WhatsappMode;
  numero?: string;
  nomeExibicao?: string;
  instanciaId?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  apiUrl?: string;
  apiKey?: string;
  accessToken?: string;
  webhookSecret?: string;
  exigirAprovacao?: boolean;
  usarIaParaMensagens?: boolean;
  enviarAgendamentoAuto?: boolean;
  enviarLembreteAuto?: boolean;
  enviarVeiculoRecebidoAuto?: boolean;
  enviarChecklistAuto?: boolean;
  enviarVeiculoProntoAuto?: boolean;
  enviarPagamentoAuto?: boolean;
  enviarPosVendaAuto?: boolean;
  enviarCobrancaAuto?: boolean;
  enviarPromocaoAuto?: boolean;
  horarioEnvioInicio?: string;
  horarioEnvioFim?: string;
  limiteMensagensClienteDia?: number;
  limiteTentativas?: number;
};

export type WhatsappIntegrationView = {
  provider: WhatsappProvider;
  status: "inativo" | "conectado" | "erro";
  modoEnvio: WhatsappMode;
  numero: string;
  nomeExibicao: string;
  instanciaId: string;
  phoneNumberId: string;
  businessAccountId: string;
  apiUrl: string;
  apiKeyConfigured: boolean;
  accessTokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  exigirAprovacao: boolean;
  usarIaParaMensagens: boolean;
  eventFlags: Record<string, boolean>;
  horarioEnvioInicio: string;
  horarioEnvioFim: string;
  limiteMensagensClienteDia: number;
  limiteTentativas: number;
  ultimoTesteEm: string | null;
  ultimoErro: string;
};

export function buildWhatsappUrl(phone: unknown, message: string) {
  const normalized = normalizePhoneBR(phone);
  if (!normalized) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export function buildAgendamentoConfirmacaoMessage({
  cliente,
  empresa,
  servico,
  quando
}: {
  cliente?: unknown;
  empresa?: unknown;
  servico?: unknown;
  quando?: unknown;
}) {
  return `Ola, ${String(cliente || "cliente")}! Confirmando seu agendamento na ${String(empresa || "empresa")} para ${String(quando || "o horario combinado")}, servico: ${String(servico || "lavagem")}. Podemos confirmar?`;
}

export async function getWhatsappIntegration(current: Current): Promise<WhatsappIntegrationView> {
  if (!current.empresaId) return emptyIntegration();
  try {
    const client = (await getSupabaseServer()) as DbClient;
    const { data, error } = await client
      .from("lava_whatsapp_integracoes")
      .select("*")
      .eq("empresa_id", current.empresaId)
      .order("updated_at", { ascending: false });
    if (error) return { ...emptyIntegration(), ultimoErro: error.message };
    const rows = (data ?? []) as Row[];
    const connected = rows.find((row) => row.status === "conectado" && row.provider !== "manual");
    const nonManual = rows.find((row) => row.provider !== "manual");
    return normalizeIntegration(connected ?? nonManual ?? rows[0] ?? {});
  } catch (err) {
    return { ...emptyIntegration(), ultimoErro: err instanceof Error ? err.message : "Nao foi possivel carregar WhatsApp." };
  }
}

export async function saveWhatsappIntegration(current: Current, input: WhatsappIntegrationInput) {
  if (!current.empresaId) throw new Error("Empresa nao identificada.");
  const client = (await getSupabaseServer()) as DbClient;
  const provider = normalizeProvider(input.provider);
  const existing = await client
    .from("lava_whatsapp_integracoes")
    .select("api_key_encrypted,access_token_encrypted,webhook_secret_encrypted")
    .eq("empresa_id", current.empresaId)
    .eq("provider", provider)
    .maybeSingle();

  const payload: Row = {
    empresa_id: current.empresaId,
    provider,
    status: provider === "manual" ? "conectado" : "inativo",
    numero: normalizePhoneBR(input.numero),
    nome_exibicao: textOrNull(input.nomeExibicao),
    instancia_id: textOrNull(input.instanciaId),
    phone_number_id: textOrNull(input.phoneNumberId),
    business_account_id: textOrNull(input.businessAccountId),
    api_url: trimUrl(input.apiUrl),
    modo_envio: normalizeMode(input.modoEnvio),
    exigir_aprovacao: input.exigirAprovacao !== false,
    usar_ia_para_mensagens: input.usarIaParaMensagens === true,
    enviar_agendamento_auto: input.enviarAgendamentoAuto === true,
    enviar_lembrete_auto: input.enviarLembreteAuto === true,
    enviar_veiculo_recebido_auto: input.enviarVeiculoRecebidoAuto === true,
    enviar_checklist_auto: input.enviarChecklistAuto === true,
    enviar_veiculo_pronto_auto: input.enviarVeiculoProntoAuto === true,
    enviar_pagamento_auto: input.enviarPagamentoAuto === true,
    enviar_pos_venda_auto: input.enviarPosVendaAuto === true,
    enviar_cobranca_auto: input.enviarCobrancaAuto === true,
    enviar_promocao_auto: input.enviarPromocaoAuto === true,
    horario_envio_inicio: input.horarioEnvioInicio || "08:00",
    horario_envio_fim: input.horarioEnvioFim || "18:00",
    limite_mensagens_cliente_dia: clampInt(input.limiteMensagensClienteDia, 1, 50, 5),
    limite_tentativas: clampInt(input.limiteTentativas, 1, 10, 3),
    ultimo_erro: null
  };

  if (input.apiKey?.trim()) payload.api_key_encrypted = encryptLavaSecret(input.apiKey, "whatsapp");
  if (!input.apiKey?.trim() && existing.data?.api_key_encrypted) payload.api_key_encrypted = existing.data.api_key_encrypted;
  if (input.accessToken?.trim()) payload.access_token_encrypted = encryptLavaSecret(input.accessToken, "whatsapp");
  if (!input.accessToken?.trim() && existing.data?.access_token_encrypted) payload.access_token_encrypted = existing.data.access_token_encrypted;
  if (input.webhookSecret?.trim()) payload.webhook_secret_encrypted = encryptLavaSecret(input.webhookSecret, "whatsapp");
  if (!input.webhookSecret?.trim() && existing.data?.webhook_secret_encrypted) payload.webhook_secret_encrypted = existing.data.webhook_secret_encrypted;

  const { error } = await client.from("lava_whatsapp_integracoes").upsert(payload, { onConflict: "empresa_id,provider" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function testWhatsappIntegration(current: Current) {
  if (!current.empresaId) throw new Error("Empresa nao identificada.");
  const client = (await getSupabaseServer()) as DbClient;
  const row = await getIntegrationRow(client, current.empresaId);
  if (!row) throw new Error("Configure uma integracao de WhatsApp primeiro.");
  const provider = normalizeProvider(row.provider);

  try {
    let result: { ok: true; detail: string };
    if (provider === "manual") {
      result = { ok: true, detail: "Modo manual via wa.me pronto." };
    } else if (provider === "evolution") {
      result = await testEvolution(row);
    } else {
      result = await testCloudApi(row);
    }

    await client
      .from("lava_whatsapp_integracoes")
      .update({ status: "conectado", ultimo_teste_em: new Date().toISOString(), ultimo_erro: null })
      .eq("id", row.id)
      .eq("empresa_id", current.empresaId);
    return result;
  } catch (err) {
    const error = redactSensitiveText(err instanceof Error ? err.message : "Falha ao testar WhatsApp.");
    await client
      .from("lava_whatsapp_integracoes")
      .update({ status: "erro", ultimo_teste_em: new Date().toISOString(), ultimo_erro: error })
      .eq("id", row.id)
      .eq("empresa_id", current.empresaId);
    throw new Error(error);
  }
}

export function buildWhatsappMessage(evento: string, data: Record<string, unknown> = {}) {
  const template = String(data.template ?? defaultTemplate(evento));
  return replaceTemplateVariables(template, data);
}

export async function generateWhatsappMessageWithIa(current: Current, evento: string, data: Record<string, unknown>, fallbackText?: string) {
  const fallback = fallbackText || buildWhatsappMessage(evento, data);
  const result = await generateIamobMessage(current, { evento, dados: data, fallbackText: fallback });
  return { message: result.text || fallback, generatedBy: result.provider === "gemini" && result.ok ? "ia" : "modelo", error: result.error };
}

export async function enqueueWhatsappMessage(first: DbClient | Current, second: QueueInput | (Record<string, unknown> & { evento?: string; telefone?: string; mensagem?: string })) {
  if (isSupabaseClient(first)) {
    return enqueueWhatsappMessageLegacy(first, second as QueueInput);
  }
  return enqueueWhatsappMessageForCurrent(first as Current, second as Record<string, unknown>);
}

export async function approveWhatsappMessage(current: Current, envioId: string) {
  if (!current.empresaId) throw new Error("Empresa nao identificada.");
  const client = (await getSupabaseServer()) as DbClient;
  const { error } = await client
    .from("lava_whatsapp_envios")
    .update({
      status: "aprovado",
      precisa_aprovacao: false,
      aprovado_por: current.usuario?.id ?? null,
      aprovado_em: new Date().toISOString(),
      erro: null
    })
    .eq("id", envioId)
    .eq("empresa_id", current.empresaId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function cancelWhatsappMessage(current: Current, envioId: string) {
  if (!current.empresaId) throw new Error("Empresa nao identificada.");
  const client = (await getSupabaseServer()) as DbClient;
  const { error } = await client
    .from("lava_whatsapp_envios")
    .update({ status: "cancelado", erro: null })
    .eq("id", envioId)
    .eq("empresa_id", current.empresaId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function sendWhatsappMessage(current: Current, envioId: string) {
  if (!current.empresaId) throw new Error("Empresa nao identificada.");
  const client = (await getSupabaseServer()) as DbClient;
  const envioResult = await client
    .from("lava_whatsapp_envios")
    .select("*")
    .eq("id", envioId)
    .eq("empresa_id", current.empresaId)
    .maybeSingle();
  if (envioResult.error || !envioResult.data) throw new Error(envioResult.error?.message ?? "Mensagem nao encontrada.");

  const envio = envioResult.data as Row;
  const integration = await getIntegrationRow(client, current.empresaId);
  const view = normalizeIntegration(integration ?? {});
  const provider = view.provider;
  const tentativas = Number(envio.tentativas ?? 0);

  if (String(envio.status) === "cancelado") return { ok: false, error: "Mensagem cancelada." };
  if (String(envio.status) === "enviado") return { ok: true, skipped: true };
  if (tentativas >= view.limiteTentativas) {
    await setWhatsappError(client, current.empresaId, envioId, `Limite de tentativas atingido (${view.limiteTentativas}).`, tentativas);
    return { ok: false, error: `Limite de tentativas atingido (${view.limiteTentativas}).` };
  }
  if (envio.precisa_aprovacao && !envio.aprovado_em) {
    await client.from("lava_whatsapp_envios").update({ status: "aguardando_aprovacao" }).eq("id", envioId).eq("empresa_id", current.empresaId);
    return { ok: false, needsApproval: true, error: "Mensagem aguardando aprovacao." };
  }

  const phone = normalizePhoneBR(envio.telefone);
  if (!phone) {
    const error = "Telefone WhatsApp invalido ou vazio.";
    await setWhatsappError(client, current.empresaId, envioId, error, tentativas);
    return { ok: false, error };
  }

  if (provider === "manual") {
    return {
      ok: true,
      provider,
      manual: true,
      url: buildWhatsappUrl(phone, String(envio.mensagem ?? ""))
    };
  }

  await client
    .from("lava_whatsapp_envios")
    .update({ status: "enviando", provider, tentativas: tentativas + 1, erro: null })
    .eq("id", envioId)
    .eq("empresa_id", current.empresaId);

  try {
    const sendResult = provider === "evolution"
      ? await sendViaEvolution({ integration: integration ?? {}, phone, message: String(envio.mensagem ?? "") })
      : await sendViaWhatsAppCloudApi({ integration: integration ?? {}, phone, message: String(envio.mensagem ?? "") });

    await client
      .from("lava_whatsapp_envios")
      .update({
        status: "enviado",
        external_id: sendResult.externalId ?? null,
        resposta_provider: sendResult.response ?? {},
        erro: null,
        enviado_em: new Date().toISOString()
      })
      .eq("id", envioId)
      .eq("empresa_id", current.empresaId);
    return { ...sendResult, ok: true, provider };
  } catch (err) {
    const error = redactSensitiveText(err instanceof Error ? err.message : "Falha ao enviar WhatsApp.");
    await setWhatsappError(client, current.empresaId, envioId, error, tentativas + 1);
    await client
      .from("lava_whatsapp_integracoes")
      .update({ status: "erro", ultimo_erro: error })
      .eq("empresa_id", current.empresaId)
      .eq("provider", provider);
    return { ok: false, provider, error };
  }
}

export async function sendPendingWhatsappMessages(current: Current) {
  if (!current.empresaId) throw new Error("Empresa nao identificada.");
  const client = (await getSupabaseServer()) as DbClient;
  const { data, error } = await client
    .from("lava_whatsapp_envios")
    .select("id,status")
    .eq("empresa_id", current.empresaId)
    .in("status", ["pendente", "aprovado", "erro"])
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);

  let synced = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of (data ?? []) as Row[]) {
    const result = await sendWhatsappMessage(current, String(row.id));
    if (result.ok && !result.skipped && !result.manual) synced += 1;
    else if (result.ok) skipped += 1;
    else failed += 1;
  }
  return { synced, failed, skipped };
}

export function sendViaManualWaMe(params: { phone: unknown; message: string }) {
  return { ok: true, url: buildWhatsappUrl(params.phone, params.message) };
}

export async function sendViaEvolution(params: { integration: Row; phone: string; message: string }) {
  const apiUrl = trimUrl(params.integration.api_url);
  const instance = String(params.integration.instancia_id ?? "").trim();
  if (!apiUrl || !instance) throw new Error("Configure URL e instancia da Evolution API.");
  const apiKey = decryptLavaSecret(String(params.integration.api_key_encrypted ?? ""), "whatsapp");
  const response = await fetch(`${apiUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey
    },
    body: JSON.stringify({ number: params.phone, text: params.message }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Evolution API"));
  const json = await response.json().catch(() => ({}));
  return { ok: true, externalId: extractExternalId(json), response: json as Row };
}

export async function sendViaWhatsAppCloudApi(params: { integration: Row; phone: string; message: string }) {
  const phoneNumberId = String(params.integration.phone_number_id ?? "").trim();
  if (!phoneNumberId) throw new Error("Configure Phone Number ID do WhatsApp Cloud API.");
  const token = decryptLavaSecret(String(params.integration.access_token_encrypted ?? ""), "whatsapp");
  const baseUrl = trimUrl(params.integration.api_url) || "https://graph.facebook.com/v20.0";
  const response = await fetch(`${baseUrl}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.phone,
      type: "text",
      text: { preview_url: false, body: params.message }
    }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "WhatsApp Cloud API"));
  const json = await response.json().catch(() => ({}));
  return { ok: true, externalId: extractExternalId(json), response: json as Row };
}

export function normalizePhoneBR(phone: unknown) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 12 ? digits : "";
}

export function replaceTemplateVariables(template: string, data: Record<string, unknown>) {
  return Object.entries(data).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value ?? "")), template);
}

export async function canSendAutomaticMessage(current: Current, evento: string, clienteId?: string | null) {
  if (!current.empresaId) return { ok: false, error: "Empresa nao identificada." };
  const integration = await getWhatsappIntegration(current);
  if (integration.modoEnvio === "manual" || integration.provider === "manual") return { ok: false, manual: true };
  if (!eventEnabled(integration, evento)) return { ok: false, error: "Envio automatico desativado para este evento." };
  if (!isInsideAllowedWindow(integration)) return { ok: false, error: "Fora do horario permitido para envio automatico." };
  if (evento === "promocao" && integration.exigirAprovacao) return { ok: false, needsApproval: true };
  if (clienteId) {
    const client = (await getSupabaseServer()) as DbClient;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const { count } = await client
      .from("lava_whatsapp_envios")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", current.empresaId)
      .eq("cliente_id", clienteId)
      .gte("created_at", since.toISOString())
      .neq("status", "cancelado");
    if ((count ?? 0) >= integration.limiteMensagensClienteDia) {
      return { ok: false, error: `Limite diario de ${integration.limiteMensagensClienteDia} mensagens para este cliente.` };
    }
  }
  return { ok: true };
}

export async function avoidDuplicateWhatsappMessage(params: {
  empresaId: string;
  evento?: string | null;
  lavagemId?: string | null;
  agendamentoId?: string | null;
  automacaoId?: string | null;
  clienteId?: string | null;
}) {
  const client = (await getSupabaseServer()) as DbClient;
  let query = client
    .from("lava_whatsapp_envios")
    .select("id,status")
    .eq("empresa_id", params.empresaId)
    .eq("evento", params.evento || "manual")
    .neq("status", "cancelado")
    .limit(1);

  query = applyNullableEq(query, "lavagem_id", params.lavagemId);
  query = applyNullableEq(query, "agendamento_id", params.agendamentoId);
  query = applyNullableEq(query, "automacao_id", params.automacaoId);
  query = applyNullableEq(query, "cliente_id", params.clienteId);
  const { data } = await query.maybeSingle();
  return data ? { duplicate: true, id: String(data.id), status: String(data.status) } : { duplicate: false };
}

export async function enqueueAutomationQueue(client: DbClient, input: QueueInput) {
  if (!input.empresaId || !input.mensagem.trim()) return { ok: false, error: "Mensagem sem empresa ou conteudo." };

  if (input.agendamentoId) {
    const existing = await client
      .from("lava_automacao_fila")
      .select("id,status")
      .eq("empresa_id", input.empresaId)
      .eq("agendamento_id", input.agendamentoId)
      .eq("tipo", input.tipo || "confirmacao_agendamento")
      .neq("status", "cancelado")
      .maybeSingle();
    if (existing.data?.id) return { ok: true, id: String(existing.data.id), reused: true };
  }

  const { data, error } = await client
    .from("lava_automacao_fila")
    .insert({
      empresa_id: input.empresaId,
      automacao_id: input.automacaoId || null,
      cliente_id: input.clienteId || null,
      lavagem_id: input.lavagemId || null,
      agendamento_id: input.agendamentoId || null,
      canal: "whatsapp",
      tipo: input.tipo || "manual",
      mensagem: input.mensagem,
      status: "pronto",
      agendado_para: input.agendadoPara || new Date().toISOString()
    })
    .select("id,status")
    .single();

  if (error) return { ok: false, error: String(error.message ?? "Nao foi possivel gerar fila de automacao.") };
  return { ok: true, id: data?.id ? String(data.id) : null };
}

export async function markWhatsappAsSent(client: DbClient, empresaId: string, id: string, source: "fila" | "envio" = "fila") {
  const table = source === "envio" ? "lava_whatsapp_envios" : "lava_automacao_fila";
  const { error } = await client
    .from(table)
    .update({ status: "enviado_manual", enviado_em: new Date().toISOString(), erro: null })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  return error ? { ok: false, error: String(error.message ?? "Nao foi possivel marcar como enviado.") } : { ok: true };
}

export async function sendWhatsappMessageIfConfigured(client: DbClient, input: QueueInput) {
  const queued = await enqueueWhatsappMessageLegacy(client, input);
  return {
    ...queued,
    provider: "manual",
    url: buildWhatsappUrl(input.telefone, input.mensagem)
  };
}

async function enqueueWhatsappMessageLegacy(client: DbClient, input: QueueInput) {
  if (!input.empresaId || !input.mensagem.trim()) return { ok: false, error: "Mensagem sem empresa ou conteudo." };
  const evento = input.evento || input.tipo || (input.agendamentoId ? "confirmacao_agendamento" : "manual");
  const payload = {
    empresa_id: input.empresaId,
    cliente_id: input.clienteId || null,
    lavagem_id: input.lavagemId || null,
    agendamento_id: input.agendamentoId || null,
    automacao_id: input.automacaoId || null,
    automacao_fila_id: input.automacaoFilaId || null,
    evento,
    telefone: normalizePhoneBR(input.telefone) || input.telefone || null,
    mensagem: input.mensagem,
    mensagem_gerada_por: "modelo",
    provider: "manual",
    status: "pronto",
    precisa_aprovacao: false,
    agendado_para: input.agendadoPara || null
  };

  const { data, error } = await client.from("lava_whatsapp_envios").insert(payload).select("id,status").single();
  if (!error) return { ok: true, id: data?.id ? String(data.id) : null };

  const existing = await findExistingLegacyMessage(client, input, evento);
  if (existing?.id) return { ok: true, id: String(existing.id), reused: true };
  return { ok: false, error: String(error.message ?? "Nao foi possivel gerar fila de WhatsApp.") };
}

async function enqueueWhatsappMessageForCurrent(current: Current, params: Row) {
  if (!current.empresaId) return { ok: false, error: "Empresa nao identificada." };
  const client = (await getSupabaseServer()) as DbClient;
  const evento = String(params.evento || params.tipo || "manual");
  const duplicate = await avoidDuplicateWhatsappMessage({
    empresaId: current.empresaId,
    evento,
    lavagemId: stringOrNull(params.lavagemId ?? params.lavagem_id),
    agendamentoId: stringOrNull(params.agendamentoId ?? params.agendamento_id),
    automacaoId: stringOrNull(params.automacaoId ?? params.automacao_id),
    clienteId: stringOrNull(params.clienteId ?? params.cliente_id)
  });
  if (duplicate.duplicate) return { ok: true, id: duplicate.id, reused: true };

  const integration = await getWhatsappIntegration(current);
  const data = (params.data && typeof params.data === "object" ? params.data : params) as Record<string, unknown>;
  const baseMessage = String(params.mensagem || params.message || buildWhatsappMessage(evento, data));
  const generated = integration.usarIaParaMensagens
    ? await generateWhatsappMessageWithIa(current, evento, data, baseMessage)
    : { message: baseMessage, generatedBy: "modelo", error: undefined };

  const phone = normalizePhoneBR(params.telefone ?? params.phone);
  const auto = await canSendAutomaticMessage(current, evento, stringOrNull(params.clienteId ?? params.cliente_id));
  const needsApproval =
    integration.modoEnvio === "automatico_com_aprovacao" ||
    integration.exigirAprovacao ||
    generated.generatedBy === "ia" ||
    auto.needsApproval === true;
  const status = !phone
    ? "erro"
    : integration.modoEnvio === "manual" || integration.provider === "manual"
      ? "pronto"
      : needsApproval
        ? "aguardando_aprovacao"
        : auto.ok
          ? "pendente"
          : "erro";
  const erro = !phone ? "Telefone WhatsApp invalido ou vazio." : auto.ok || status === "pronto" || status === "aguardando_aprovacao" ? null : auto.error || null;

  const insert = await client.from("lava_whatsapp_envios").insert({
    empresa_id: current.empresaId,
    cliente_id: stringOrNull(params.clienteId ?? params.cliente_id),
    lavagem_id: stringOrNull(params.lavagemId ?? params.lavagem_id),
    agendamento_id: stringOrNull(params.agendamentoId ?? params.agendamento_id),
    automacao_id: stringOrNull(params.automacaoId ?? params.automacao_id),
    automacao_fila_id: stringOrNull(params.automacaoFilaId ?? params.automacao_fila_id),
    usuario_id: current.usuario?.id ?? null,
    evento,
    telefone: phone || String(params.telefone ?? ""),
    mensagem: generated.message,
    mensagem_gerada_por: generated.generatedBy,
    provider: integration.provider,
    status,
    precisa_aprovacao: needsApproval,
    erro,
    agendado_para: params.agendadoPara || params.agendado_para || null
  }).select("id,status").single();

  if (insert.error) return { ok: false, error: insert.error.message };
  if (status === "pendente" && integration.modoEnvio === "automatico_total") {
    const sent = await sendWhatsappMessage(current, String(insert.data.id));
    return { ok: true, id: String(insert.data.id), sent };
  }
  return { ok: true, id: String(insert.data.id), status };
}

async function findExistingLegacyMessage(client: DbClient, input: QueueInput, evento: string) {
  let query = client
    .from("lava_whatsapp_envios")
    .select("id,status")
    .eq("empresa_id", input.empresaId)
    .eq("evento", evento)
    .neq("status", "cancelado")
    .limit(1);
  query = applyNullableEq(query, "agendamento_id", input.agendamentoId);
  query = applyNullableEq(query, "lavagem_id", input.lavagemId);
  query = applyNullableEq(query, "automacao_id", input.automacaoId);
  const existing = await query.maybeSingle();
  return existing.data as Row | null;
}

async function getIntegrationRow(client: DbClient, empresaId: string | null) {
  if (!empresaId) return null;
  const { data, error } = await client
    .from("lava_whatsapp_integracoes")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  return rows.find((row) => row.status === "conectado" && row.provider !== "manual") ?? rows.find((row) => row.provider !== "manual") ?? rows[0] ?? null;
}

async function testEvolution(row: Row) {
  const apiUrl = trimUrl(row.api_url);
  const instance = String(row.instancia_id ?? "").trim();
  if (!apiUrl || !instance) throw new Error("Configure URL e instancia da Evolution API.");
  const apiKey = decryptLavaSecret(String(row.api_key_encrypted ?? ""), "whatsapp");
  const response = await fetch(`${apiUrl}/instance/connectionState/${encodeURIComponent(instance)}`, {
    headers: { apikey: apiKey },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "Evolution API"));
  return { ok: true as const, detail: "Evolution API respondeu ao teste." };
}

async function testCloudApi(row: Row) {
  const phoneNumberId = String(row.phone_number_id ?? "").trim();
  if (!phoneNumberId) throw new Error("Configure Phone Number ID do WhatsApp Cloud API.");
  const token = decryptLavaSecret(String(row.access_token_encrypted ?? ""), "whatsapp");
  const baseUrl = trimUrl(row.api_url) || "https://graph.facebook.com/v20.0";
  const response = await fetch(`${baseUrl}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(await responseErrorMessage(response, "WhatsApp Cloud API"));
  return { ok: true as const, detail: "WhatsApp Cloud API respondeu ao teste." };
}

async function responseErrorMessage(response: Response, providerLabel: string) {
  const text = await response.text().catch(() => "");
  let detail = text;
  try {
    const json = JSON.parse(text);
    detail = json.error_description || json.error?.message || json.error?.error_user_msg || json.error || text;
  } catch {
    // Keep response text.
  }
  const message = `${providerLabel} erro ${response.status}: ${detail || response.statusText}`;
  if (providerLabel === "WhatsApp Cloud API" && /template|24.?hour|outside/i.test(message)) {
    return `${message}. Mensagem exige template aprovado no WhatsApp Cloud API.`;
  }
  return redactSensitiveText(message);
}

async function setWhatsappError(client: DbClient, empresaId: string | null, envioId: string, error: string, tentativas: number) {
  if (!empresaId) return;
  await client
    .from("lava_whatsapp_envios")
    .update({ status: "erro", erro: redactSensitiveText(error), tentativas })
    .eq("id", envioId)
    .eq("empresa_id", empresaId);
}

function normalizeIntegration(row: Row): WhatsappIntegrationView {
  const provider = normalizeProvider(row.provider);
  const mode = normalizeMode(String(row.modo_envio ?? "manual"));
  return {
    provider,
    status: normalizeStatus(row.status),
    modoEnvio: mode,
    numero: String(row.numero ?? ""),
    nomeExibicao: String(row.nome_exibicao ?? ""),
    instanciaId: String(row.instancia_id ?? ""),
    phoneNumberId: String(row.phone_number_id ?? ""),
    businessAccountId: String(row.business_account_id ?? ""),
    apiUrl: String(row.api_url ?? ""),
    apiKeyConfigured: Boolean(row.api_key_encrypted),
    accessTokenConfigured: Boolean(row.access_token_encrypted),
    webhookSecretConfigured: Boolean(row.webhook_secret_encrypted),
    exigirAprovacao: row.exigir_aprovacao !== false,
    usarIaParaMensagens: row.usar_ia_para_mensagens === true,
    eventFlags: {
      confirmacao_agendamento: row.enviar_agendamento_auto === true,
      lembrete_agendamento: row.enviar_lembrete_auto === true,
      lavagem_recebida: row.enviar_veiculo_recebido_auto === true,
      checklist_concluido: row.enviar_checklist_auto === true,
      veiculo_pronto: row.enviar_veiculo_pronto_auto === true,
      pagamento_recebido: row.enviar_pagamento_auto === true,
      pos_venda: row.enviar_pos_venda_auto === true,
      cobranca_fiado: row.enviar_cobranca_auto === true,
      cliente_sem_retorno: row.enviar_pos_venda_auto === true,
      promocao: row.enviar_promocao_auto === true
    },
    horarioEnvioInicio: String(row.horario_envio_inicio ?? "08:00").slice(0, 5),
    horarioEnvioFim: String(row.horario_envio_fim ?? "18:00").slice(0, 5),
    limiteMensagensClienteDia: Number(row.limite_mensagens_cliente_dia ?? 5),
    limiteTentativas: Number(row.limite_tentativas ?? 3),
    ultimoTesteEm: row.ultimo_teste_em ? String(row.ultimo_teste_em) : null,
    ultimoErro: redactSensitiveText(row.ultimo_erro ?? "")
  };
}

function emptyIntegration(): WhatsappIntegrationView {
  return normalizeIntegration({
    provider: "manual",
    status: "inativo",
    modo_envio: "manual",
    horario_envio_inicio: "08:00",
    horario_envio_fim: "18:00",
    limite_mensagens_cliente_dia: 5,
    limite_tentativas: 3
  });
}

function defaultTemplate(evento: string) {
  const templates: Record<string, string> = {
    confirmacao_agendamento: "Ola, {cliente}! Confirmando seu agendamento na {empresa} para {data} as {hora}, servico: {servico}. Podemos confirmar?",
    lembrete_agendamento: "Ola, {cliente}! Lembrete do seu agendamento na {empresa} em {data} as {hora}.",
    lavagem_recebida: "Ola, {cliente}! Recebemos seu veiculo {veiculo} na {empresa}. Vamos avisar quando estiver pronto.",
    checklist_concluido: "Ola, {cliente}! O checklist do veiculo {veiculo} foi concluido. Qualquer observacao sera informada pela equipe.",
    veiculo_pronto: "Ola, {cliente}! Seu veiculo {veiculo} esta pronto na {empresa}. Total: {total}.",
    pagamento_recebido: "Ola, {cliente}! Pagamento recebido. Obrigado pela preferencia!",
    pos_venda: "Ola, {cliente}! Obrigado por escolher a {empresa}. Como foi sua experiencia com o servico?",
    cobranca_fiado: "Ola, {cliente}! Consta um valor em aberto de {valor}. Podemos combinar o pagamento?",
    cliente_sem_retorno: "Ola, {cliente}! Ja faz um tempo desde a ultima lavagem do seu veiculo {veiculo}. Podemos agendar uma nova?",
    promocao: "Ola, {cliente}! Temos uma condicao especial para uma nova lavagem do seu veiculo {veiculo}."
  };
  return templates[evento] ?? "Ola, {cliente}! Temos uma mensagem da {empresa} sobre seu veiculo {veiculo}.";
}

function eventEnabled(integration: WhatsappIntegrationView, evento: string) {
  return integration.eventFlags[evento] === true;
}

function isInsideAllowedWindow(integration: WhatsappIntegrationView) {
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(integration.horarioEnvioInicio);
  const end = timeToMinutes(integration.horarioEnvioFim);
  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map((item) => Number(item));
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function isSupabaseClient(value: unknown): value is DbClient {
  return Boolean(value && typeof value === "object" && typeof (value as { from?: unknown }).from === "function");
}

function normalizeProvider(value: unknown): WhatsappProvider {
  if (value === "evolution" || value === "whatsapp_cloud_api") return value;
  return "manual";
}

function normalizeMode(value: unknown): WhatsappMode {
  if (value === "automatico_com_aprovacao" || value === "automatico_total") return value;
  return "manual";
}

function normalizeStatus(value: unknown): WhatsappIntegrationView["status"] {
  if (value === "conectado" || value === "erro") return value;
  return "inativo";
}

function textOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function stringOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function trimUrl(value: unknown) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function applyNullableEq(query: any, column: string, value: unknown) {
  const normalized = stringOrNull(value);
  return normalized ? query.eq(column, normalized) : query.is(column, null);
}

function extractExternalId(json: unknown) {
  const row = json as Row;
  const messages = Array.isArray(row.messages) ? row.messages : [];
  const firstMessage = messages[0] as Row | undefined;
  return String(row.keyId ?? row.id ?? firstMessage?.id ?? row.messageId ?? "");
}
