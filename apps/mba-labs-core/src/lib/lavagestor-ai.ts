import "server-only";

import { normalizePlate } from "./lavagestor-placa";
import { decryptLavaSecret, encryptLavaSecret, redactSensitiveText } from "./lavagestor-secrets";
import { getSupabaseServer } from "./supabase";

type DbClient = any;
type Row = Record<string, unknown>;
type Current = { empresaId: string | null; usuario?: { id?: string | null } };

export type LavaAiConnectionView = {
  provider: "gemini";
  status: "inativo" | "conectado" | "erro";
  model: string;
  accountHint: string;
  ultimoTesteEm: string | null;
  ultimoErro: string;
  usoTotal: number;
  apiKeyConfigured: boolean;
};

export type LavaAiMode = {
  active: boolean;
  mode: "regras" | "gemini";
  label: string;
  allowPhotoAnalysis: boolean;
  allowPlateReading: boolean;
  connection: LavaAiConnectionView;
  error: string | null;
};

export type GeminiCallParams = {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  imageBase64?: string;
  imageMimeType?: string;
  fallbackText?: string;
  logType?: string;
  logInput?: Record<string, unknown>;
  related?: {
    lavagemId?: string | null;
    clienteId?: string | null;
    veiculoId?: string | null;
  };
  throwOnError?: boolean;
};

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_MODEL = "gemini-3.5-flash";
const BASE_IAMOB_PROMPT =
  "Voce e o IAMob, assistente de um lava-jato. Gere uma mensagem curta, educada e profissional para WhatsApp em portugues do Brasil. Nao invente dados. Use somente as informacoes fornecidas. Nao use emojis em excesso. Nao prometa desconto, prazo ou servico que nao foi informado.";

export async function getLavaAiConnection(current: Current): Promise<LavaAiConnectionView> {
  const empresaId = current.empresaId;
  const fallback = emptyConnection();
  if (!empresaId) return fallback;

  try {
    const client = (await getSupabaseServer()) as DbClient;
    const { data, error } = await client
      .from("lava_ai_connections")
      .select("provider,status,model,api_key_encrypted,account_hint,ultimo_teste_em,ultimo_erro,uso_total")
      .eq("empresa_id", empresaId)
      .eq("provider", "gemini")
      .maybeSingle();

    if (error || !data) return fallback;
    return normalizeConnection(data);
  } catch {
    return fallback;
  }
}

export async function getLavaAiMode(current: Current): Promise<LavaAiMode> {
  const connection = await getLavaAiConnection(current);
  let config: Row = {};
  let error: string | null = null;

  if (current.empresaId) {
    try {
      const client = (await getSupabaseServer()) as DbClient;
      const result = await client
        .from("lava_configuracoes")
        .select("iamob_ativo,iamob_modo,iamob_provider,iamob_model,iamob_permitir_analise_foto,iamob_permitir_leitura_placa")
        .eq("empresa_id", current.empresaId)
        .maybeSingle();
      config = result.data ?? {};
      error = result.error?.message ?? null;
    } catch (err) {
      error = err instanceof Error ? err.message : "Nao foi possivel carregar configuracao IAMob.";
    }
  }

  const wantsGemini = config.iamob_ativo !== false && (config.iamob_modo === "gemini" || config.iamob_provider === "gemini");
  const active = wantsGemini && connection.status === "conectado" && connection.apiKeyConfigured;
  return {
    active,
    mode: active ? "gemini" : "regras",
    label: active ? "IAMob usando Gemini" : "IAMob em modo regras",
    allowPhotoAnalysis: active && config.iamob_permitir_analise_foto === true,
    allowPlateReading: active && config.iamob_permitir_leitura_placa === true,
    connection,
    error
  };
}

export async function saveLavaGeminiKey(
  current: Current,
  apiKey: string,
  model = DEFAULT_MODEL,
  options: { allowPhotoAnalysis?: boolean; allowPlateReading?: boolean; mode?: "regras" | "gemini" } = {}
) {
  if (!current.empresaId) throw new Error("Empresa nao identificada.");
  const trimmedKey = apiKey.trim();
  const selectedModel = normalizeModel(model);
  const client = (await getSupabaseServer()) as DbClient;
  const encrypted = trimmedKey ? encryptLavaSecret(trimmedKey, "ai") : undefined;

  const existing = await client
    .from("lava_ai_connections")
    .select("id,api_key_encrypted")
    .eq("empresa_id", current.empresaId)
    .eq("provider", "gemini")
    .maybeSingle();

  if (!trimmedKey && !existing.data?.api_key_encrypted) {
    throw new Error("Informe a API Key Gemini para salvar.");
  }

  const connectionPayload: Row = {
    empresa_id: current.empresaId,
    provider: "gemini",
    status: "inativo",
    model: selectedModel,
    ultimo_erro: null
  };
  if (encrypted) connectionPayload.api_key_encrypted = encrypted;

  const { error } = await client
    .from("lava_ai_connections")
    .upsert(connectionPayload, { onConflict: "empresa_id,provider" });
  if (error) throw new Error(error.message);

  const configPayload: Row = {
    empresa_id: current.empresaId,
    iamob_ativo: true,
    iamob_provider: options.mode === "regras" ? "regras" : "gemini",
    iamob_modo: options.mode ?? "gemini",
    iamob_model: selectedModel,
    iamob_permitir_analise_foto: options.allowPhotoAnalysis === true,
    iamob_permitir_leitura_placa: options.allowPlateReading === true
  };
  const config = await client.from("lava_configuracoes").upsert(configPayload, { onConflict: "empresa_id" });
  if (config.error) throw new Error(config.error.message);

  return { ok: true };
}

export async function removeLavaGeminiKey(current: Current) {
  if (!current.empresaId) throw new Error("Empresa nao identificada.");
  const client = (await getSupabaseServer()) as DbClient;
  const { error } = await client
    .from("lava_ai_connections")
    .upsert({
      empresa_id: current.empresaId,
      provider: "gemini",
      status: "inativo",
      api_key_encrypted: null,
      ultimo_erro: null
    }, { onConflict: "empresa_id,provider" });
  if (error) throw new Error(error.message);

  const config = await client
    .from("lava_configuracoes")
    .upsert({
      empresa_id: current.empresaId,
      iamob_provider: "regras",
      iamob_modo: "regras",
      iamob_permitir_analise_foto: false,
      iamob_permitir_leitura_placa: false
    }, { onConflict: "empresa_id" });
  if (config.error) throw new Error(config.error.message);
  return { ok: true };
}

export async function testLavaGeminiConnection(current: Current) {
  const result = await callGemini(current, {
    prompt: "Responda apenas: IAMob Gemini conectado.",
    systemInstruction: "Voce testa uma conexao de IA. Seja breve.",
    fallbackText: "",
    logType: "teste_gemini",
    throwOnError: true
  });
  return result;
}

export async function callGemini(current: Current, params: GeminiCallParams) {
  const client = (await getSupabaseServer()) as DbClient;
  const connection = await getConnectionWithEncryptedKey(client, current.empresaId);
  const fallbackText = params.fallbackText ?? "";

  if (!connection?.api_key_encrypted) {
    const error = "Gemini nao configurado. IAMob segue em modo regras.";
    if (params.throwOnError) throw new Error(error);
    return { ok: false, text: fallbackText, provider: "regras" as const, error, fallbackUsed: true };
  }

  const apiKey = decryptLavaSecret(String(connection.api_key_encrypted), "ai");
  const model = normalizeModel(params.model || String(connection.model || DEFAULT_MODEL));
  const payload: Row = {
    model,
    system_instruction: params.systemInstruction || BASE_IAMOB_PROMPT,
    input: buildGeminiInput(params)
  };

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000)
    });

    if (!response.ok) {
      throw new Error(await responseErrorMessage(response, "Gemini"));
    }

    const json = await response.json();
    const text = extractGeminiText(json);
    if (!text) throw new Error("Gemini respondeu sem texto.");

    await Promise.all([
      markConnectionSuccess(client, current.empresaId, model),
      logIamob(client, current, {
        tipo: params.logType || "gemini",
        entrada: { ...params.logInput, prompt: params.prompt, model, hasImage: Boolean(params.imageBase64) },
        saida: text,
        provider: "gemini",
        status: "concluido",
        related: params.related
      })
    ]);

    return { ok: true, text, provider: "gemini" as const, model, raw: json, fallbackUsed: false };
  } catch (err) {
    const error = redactSensitiveText(err instanceof Error ? err.message : "Falha ao chamar Gemini.");
    await Promise.all([
      markConnectionError(client, current.empresaId, error),
      logIamob(client, current, {
        tipo: params.logType || "gemini_erro",
        entrada: { ...params.logInput, prompt: params.prompt, model, hasImage: Boolean(params.imageBase64) },
        saida: fallbackText || null,
        provider: "gemini",
        status: "erro",
        erro: error,
        related: params.related
      })
    ]).catch(() => null);

    if (params.throwOnError) throw new Error(error);
    return { ok: false, text: fallbackText, provider: "regras" as const, error, fallbackUsed: true };
  }
}

export async function generateIamobMessage(current: Current, params: { evento: string; dados?: Record<string, unknown>; fallbackText: string }) {
  return callGemini(current, {
    prompt: `Evento: ${params.evento}\nDados: ${JSON.stringify(params.dados ?? {})}\nGere uma mensagem de WhatsApp pronta para envio.`,
    fallbackText: params.fallbackText,
    logType: `mensagem_${params.evento}`,
    logInput: { evento: params.evento, dados: params.dados }
  });
}

export async function generateIamobDailySummary(current: Current, params: { dados: Record<string, unknown>; fallbackText: string }) {
  return callGemini(current, {
    prompt: `Resumo operacional do dia para lava-jato:\n${JSON.stringify(params.dados)}\nRetorne 3 a 5 linhas objetivas.`,
    fallbackText: params.fallbackText,
    logType: "resumo_dia",
    logInput: params.dados
  });
}

export async function generateIamobRecommendations(current: Current, params: { dados: Record<string, unknown>; fallbackText: string }) {
  return callGemini(current, {
    prompt: `Analise os dados do LavaGestor e gere recomendacoes curtas, priorizadas:\n${JSON.stringify(params.dados)}`,
    fallbackText: params.fallbackText,
    logType: "recomendacoes",
    logInput: params.dados
  });
}

export async function analyzeVehiclePhotoWithGemini(
  current: Current,
  params: {
    imageBase64: string;
    mimeType: string;
    fallbackText?: string;
    lavagemId?: string | null;
    clienteId?: string | null;
    veiculoId?: string | null;
  }
) {
  return callGemini(current, {
    prompt:
      "Analise a foto do veiculo para checklist. Gere: descricao do estado visual, possiveis avarias observadas e sugestao de observacao. Use sempre possivel avaria, indicio visual e confirme manualmente. Nunca escreva avaria confirmada.",
    imageBase64: params.imageBase64,
    imageMimeType: params.mimeType,
    fallbackText: params.fallbackText || "Analise gerada por IA indisponivel. Confirme manualmente antes de usar.",
    logType: "analise_foto",
    related: {
      lavagemId: params.lavagemId,
      clienteId: params.clienteId,
      veiculoId: params.veiculoId
    }
  });
}

export async function recognizePlateWithGemini(current: Current, params: { imageBase64: string; mimeType: string }) {
  const result = await callGemini(current, {
    prompt: "Leia apenas a placa do veiculo na imagem. Responda somente com a placa no padrao brasileiro, sem explicacoes. Se nao conseguir ler, responda NAO_IDENTIFICADA.",
    systemInstruction: "Voce le placas de veiculos brasileiros. Responda somente a placa ou NAO_IDENTIFICADA.",
    imageBase64: params.imageBase64,
    imageMimeType: params.mimeType,
    fallbackText: "NAO_IDENTIFICADA",
    logType: "leitura_placa"
  });
  const plate = normalizePlate(result.text);
  return { ...result, plate: plate || "NAO_IDENTIFICADA" };
}

export function defaultGeminiModel() {
  return DEFAULT_MODEL;
}

export function betterGeminiModel() {
  return FALLBACK_MODEL;
}

async function responseErrorMessage(response: Response, providerLabel: string) {
  const text = await response.text().catch(() => "");
  let detail = text;
  try {
    const json = JSON.parse(text);
    detail = json.error_description || json.error?.message || json.error || text;
  } catch {
    // Keep original text.
  }
  return redactSensitiveText(`${providerLabel} erro ${response.status}: ${detail || response.statusText}`);
}

function buildGeminiInput(params: GeminiCallParams) {
  if (params.imageBase64) {
    return [
      { type: "text", text: params.prompt },
      {
        type: "image",
        data: params.imageBase64,
        mime_type: params.imageMimeType || "image/jpeg"
      }
    ];
  }

  return params.prompt;
}

function extractGeminiText(json: unknown): string {
  const row = json as Row;
  if (typeof row.output_text === "string") return row.output_text.trim();
  if (typeof row.text === "string") return row.text.trim();
  const candidates = Array.isArray(row.candidates) ? row.candidates : [];
  const candidateText = candidates
    .flatMap((candidate: any) => candidate?.content?.parts ?? [])
    .map((part: any) => part?.text)
    .filter(Boolean)
    .join("\n")
    .trim();
  if (candidateText) return candidateText;
  const steps = Array.isArray(row.steps) ? row.steps : [];
  return steps
    .flatMap((step: any) => step?.content ?? step?.output ?? [])
    .map((part: any) => part?.text ?? part?.content?.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function getConnectionWithEncryptedKey(client: DbClient, empresaId: string | null) {
  if (!empresaId) return null;
  const { data, error } = await client
    .from("lava_ai_connections")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("provider", "gemini")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Row | null;
}

async function markConnectionSuccess(client: DbClient, empresaId: string | null, model: string) {
  if (!empresaId) return;
  const existing = await client
    .from("lava_ai_connections")
    .select("uso_total")
    .eq("empresa_id", empresaId)
    .eq("provider", "gemini")
    .maybeSingle();
  const usoTotal = Number(existing.data?.uso_total ?? 0);
  await client
    .from("lava_ai_connections")
    .update({
      status: "conectado",
      model,
      ultimo_teste_em: new Date().toISOString(),
      ultimo_erro: null,
      uso_total: usoTotal + 1
    })
    .eq("empresa_id", empresaId)
    .eq("provider", "gemini");
}

async function markConnectionError(client: DbClient, empresaId: string | null, error: string) {
  if (!empresaId) return;
  await client
    .from("lava_ai_connections")
    .update({
      status: "erro",
      ultimo_teste_em: new Date().toISOString(),
      ultimo_erro: error
    })
    .eq("empresa_id", empresaId)
    .eq("provider", "gemini");
}

async function logIamob(
  client: DbClient,
  current: Current,
  params: {
    tipo: string;
    entrada: Record<string, unknown>;
    saida?: string | null;
    provider: string;
    status: "concluido" | "erro";
    erro?: string | null;
    related?: GeminiCallParams["related"];
  }
) {
  if (!current.empresaId) return;
  await client.from("lava_iamob_logs").insert({
    empresa_id: current.empresaId,
    usuario_id: current.usuario?.id ?? null,
    lavagem_id: params.related?.lavagemId ?? null,
    cliente_id: params.related?.clienteId ?? null,
    veiculo_id: params.related?.veiculoId ?? null,
    tipo: params.tipo,
    entrada: params.entrada,
    saida: params.saida ?? null,
    provider: params.provider,
    status: params.status,
    erro: params.erro ?? null
  });
}

function normalizeConnection(row: Row): LavaAiConnectionView {
  const status = ["conectado", "erro", "inativo"].includes(String(row.status)) ? String(row.status) : "inativo";
  return {
    provider: "gemini",
    status: status as LavaAiConnectionView["status"],
    model: normalizeModel(String(row.model || DEFAULT_MODEL)),
    accountHint: String(row.account_hint ?? ""),
    ultimoTesteEm: row.ultimo_teste_em ? String(row.ultimo_teste_em) : null,
    ultimoErro: redactSensitiveText(row.ultimo_erro ?? ""),
    usoTotal: Number(row.uso_total ?? 0),
    apiKeyConfigured: Boolean(row.api_key_encrypted)
  };
}

function emptyConnection(): LavaAiConnectionView {
  return {
    provider: "gemini",
    status: "inativo",
    model: DEFAULT_MODEL,
    accountHint: "",
    ultimoTesteEm: null,
    ultimoErro: "",
    usoTotal: 0,
    apiKeyConfigured: false
  };
}

function normalizeModel(model: string) {
  const value = model.trim();
  return value || DEFAULT_MODEL;
}
