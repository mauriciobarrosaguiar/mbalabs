import "server-only";

import { decryptLavaSecret, encryptLavaSecret, redactSensitiveText } from "./lavagestor-secrets";
import { getSupabaseServer } from "./supabase";

type DbClient = any;
type Row = Record<string, unknown>;
type Current = { empresaId: string | null; usuario?: { id?: string | null } };

export type EvolutionManagerConfig = {
  configured: boolean;
  apiUrl: string;
  apiKeyConfigured: boolean;
  prefix: string;
  missing: string[];
};

type EvolutionRequestConfig = {
  apiUrl: string;
  apiKey: string;
  instance: string;
  rowId?: string | null;
};

export function normalizeEvolutionBaseUrl(value: unknown) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}

export function getEvolutionManagerConfig(): EvolutionManagerConfig {
  const apiUrl = normalizeEvolutionBaseUrl(process.env.LAVAGESTOR_EVOLUTION_MANAGER_URL);
  const apiKey = process.env.LAVAGESTOR_EVOLUTION_MANAGER_API_KEY?.trim() ?? "";
  const prefix = slugPart(process.env.LAVAGESTOR_EVOLUTION_INSTANCE_PREFIX || "lavagestor");
  const missing = [
    apiUrl ? "" : "LAVAGESTOR_EVOLUTION_MANAGER_URL",
    apiKey ? "" : "LAVAGESTOR_EVOLUTION_MANAGER_API_KEY"
  ].filter(Boolean);

  return {
    configured: missing.length === 0,
    apiUrl,
    apiKeyConfigured: Boolean(apiKey),
    prefix,
    missing
  };
}

export async function getCompanyEvolutionIntegration(current: Current) {
  if (!current.empresaId) return null;
  const client = (await getSupabaseServer()) as DbClient;
  const { data, error } = await client
    .from("lava_whatsapp_integracoes")
    .select("*")
    .eq("empresa_id", current.empresaId)
    .eq("provider", "evolution")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Row | null;
}

export async function buildCompanyInstanceName(current: Current) {
  if (!current.empresaId) throw new Error("Empresa não identificada.");
  const client = (await getSupabaseServer()) as DbClient;
  const { data } = await client
    .from("core_empresas")
    .select("nome,nome_fantasia")
    .eq("id", current.empresaId)
    .maybeSingle();

  const config = getEvolutionManagerConfig();
  const companyName = slugPart(String(data?.nome_fantasia || data?.nome || current.empresaId.slice(0, 8)));
  return `${config.prefix}_${companyName}_${current.empresaId.slice(0, 8)}`.slice(0, 64);
}

export async function createOrGetEvolutionInstance(current: Current) {
  if (!current.empresaId) throw new Error("Empresa não identificada.");
  const config = await resolveEvolutionCreateConfig(current);
  const status = await tryReadConnectionState(config);

  if (!status.ok) {
    await fetchEvolutionJson(config, `/instance/create`, {
      method: "POST",
      body: {
        instanceName: config.instance,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      }
    });
  }

  const state = status.ok ? status.state : "aguardando_qr";
  const connected = isEvolutionConnected(state);
  const client = (await getSupabaseServer()) as DbClient;
  const { error } = await client
    .from("lava_whatsapp_integracoes")
    .upsert({
      empresa_id: current.empresaId,
      provider: "evolution",
      status: connected ? "conectado" : "inativo",
      modo_envio: "automatico_com_aprovacao",
      exigir_aprovacao: true,
      usar_ia_para_mensagens: true,
      enviar_agendamento_auto: true,
      enviar_lembrete_auto: true,
      enviar_veiculo_pronto_auto: true,
      enviar_cobranca_auto: false,
      enviar_promocao_auto: false,
      api_url: config.apiUrl,
      api_key_encrypted: encryptLavaSecret(config.apiKey, "whatsapp"),
      instancia_id: config.instance,
      setup_facil: true,
      central_manager: config.rowId ? false : true,
      qr_status: connected ? "conectado" : "aguardando_qr",
      ultimo_erro: null,
      ultimo_teste_em: new Date().toISOString()
    }, { onConflict: "empresa_id,provider" });
  if (error) throw new Error(error.message);

  return { ok: true, instance: config.instance, status: connected ? "conectado" : "aguardando_qr", state };
}

export async function getEvolutionQrCode(current: Current) {
  const config = await evolutionRequestConfig(current);
  const json = await fetchEvolutionJson(config, `/instance/connect/${encodeURIComponent(config.instance)}`, { method: "GET" })
    .catch(async (err) => {
      if (String(err instanceof Error ? err.message : err).includes("404")) {
        return fetchEvolutionJson(config, `/instance/connect/${encodeURIComponent(config.instance)}`, { method: "POST" });
      }
      throw err;
    });
  const qrCode = extractQrCode(json);
  const pairingCode = extractPairingCode(json);
  const state = extractConnectionState(json);
  const connected = isEvolutionConnected(state);
  await updateEvolutionRow(current, {
    status: connected ? "conectado" : "inativo",
    qr_status: connected ? "conectado" : "aguardando_qr",
    qr_code: qrCode || null,
    pairing_code: pairingCode || null,
    ultimo_erro: null,
    ultimo_teste_em: new Date().toISOString()
  });
  return {
    ok: true,
    instance: config.instance,
    status: connected ? "conectado" : "aguardando_qr",
    qrCode,
    pairingCode,
    state
  };
}

export async function checkEvolutionStatus(current: Current) {
  const config = await evolutionRequestConfig(current);
  try {
    const result = await fetchEvolutionJson(config, `/instance/connectionState/${encodeURIComponent(config.instance)}`, { method: "GET" });
    const state = extractConnectionState(result);
    const connected = isEvolutionConnected(state);
    await updateEvolutionRow(current, {
      status: connected ? "conectado" : "inativo",
      qr_status: connected ? "conectado" : "aguardando_qr",
      ultimo_erro: null,
      ultimo_teste_em: new Date().toISOString()
    });
    return { ok: true, instance: config.instance, status: connected ? "conectado" : "aguardando_qr", state };
  } catch (err) {
    const error = redactSensitiveText(err instanceof Error ? err.message : "Evolution API não respondeu ao teste.");
    await updateEvolutionRow(current, {
      status: "erro",
      qr_status: "erro",
      ultimo_erro: error,
      ultimo_teste_em: new Date().toISOString()
    }).catch(() => null);
    throw new Error(error);
  }
}

export async function disconnectEvolutionInstance(current: Current) {
  const config = await evolutionRequestConfig(current);
  await fetchEvolutionJson(config, `/instance/logout/${encodeURIComponent(config.instance)}`, { method: "DELETE" }).catch(() => null);
  await updateEvolutionRow(current, {
    status: "inativo",
    qr_status: "desconectado",
    qr_code: null,
    pairing_code: null,
    ultimo_erro: null
  });
  return { ok: true, instance: config.instance };
}

export async function reconnectEvolutionInstance(current: Current) {
  await disconnectEvolutionInstance(current).catch(() => null);
  return getEvolutionQrCode(current);
}

export async function sendEvolutionTextMessage(current: Current, params: { phone: string; message: string }) {
  const config = await evolutionRequestConfig(current);
  const json = await fetchEvolutionJson(config, `/message/sendText/${encodeURIComponent(config.instance)}`, {
    method: "POST",
    body: { number: params.phone, text: params.message }
  });
  return { ok: true, externalId: extractExternalId(json), response: json as Row };
}

export async function parseEvolutionError(response: Response) {
  const text = await response.text().catch(() => "");
  let detail = text;
  try {
    const json = JSON.parse(text);
    detail = json.error_description || json.error?.message || json.message || json.error || text;
  } catch {
    // Keep raw response text.
  }
  if (response.status === 401 || response.status === 403) {
    detail = `${detail || response.statusText}. Evolution recusou a API Key. Confira se ela é igual à AUTHENTICATION_API_KEY do Render.`;
  }
  return redactSensitiveText(`Evolution API erro ${response.status}: ${detail || response.statusText}`);
}

async function resolveEvolutionCreateConfig(current: Current): Promise<EvolutionRequestConfig> {
  const manager = getEvolutionManagerConfig();
  const instance = await buildCompanyInstanceName(current);
  if (manager.configured) {
    return {
      apiUrl: manager.apiUrl,
      apiKey: process.env.LAVAGESTOR_EVOLUTION_MANAGER_API_KEY?.trim() ?? "",
      instance
    };
  }

  const row = await getCompanyEvolutionIntegration(current);
  if (row?.api_url && row?.api_key_encrypted) {
    return {
      apiUrl: normalizeEvolutionBaseUrl(row.api_url),
      apiKey: decryptLavaSecret(String(row.api_key_encrypted), "whatsapp"),
      instance: String(row.instancia_id || instance).trim(),
      rowId: row.id ? String(row.id) : null
    };
  }

  throw new Error(evolutionMissingMessage(manager));
}

async function evolutionRequestConfig(current: Current): Promise<EvolutionRequestConfig> {
  if (!current.empresaId) throw new Error("Empresa não identificada.");
  const row = await getCompanyEvolutionIntegration(current);
  if (row?.api_url && row?.instancia_id && row?.api_key_encrypted) {
    return {
      apiUrl: normalizeEvolutionBaseUrl(row.api_url),
      apiKey: decryptLavaSecret(String(row.api_key_encrypted), "whatsapp"),
      instance: String(row.instancia_id).trim(),
      rowId: row.id ? String(row.id) : null
    };
  }

  await createOrGetEvolutionInstance(current);
  const created = await getCompanyEvolutionIntegration(current);
  if (!created?.api_url || !created?.instancia_id || !created?.api_key_encrypted) {
    throw new Error("Não foi possível preparar a instância do WhatsApp automático.");
  }
  return {
    apiUrl: normalizeEvolutionBaseUrl(created.api_url),
    apiKey: decryptLavaSecret(String(created.api_key_encrypted), "whatsapp"),
    instance: String(created.instancia_id).trim(),
    rowId: created.id ? String(created.id) : null
  };
}

async function fetchEvolutionJson(
  config: Pick<EvolutionRequestConfig, "apiUrl" | "apiKey">,
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; body?: Row } = {}
) {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      apikey: config.apiKey
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(await parseEvolutionError(response));
  return response.json().catch(() => ({}));
}

async function tryReadConnectionState(config: EvolutionRequestConfig) {
  try {
    const json = await fetchEvolutionJson(config, `/instance/connectionState/${encodeURIComponent(config.instance)}`, { method: "GET" });
    return { ok: true as const, state: extractConnectionState(json), raw: json };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Evolution API não respondeu." };
  }
}

async function updateEvolutionRow(current: Current, payload: Row) {
  if (!current.empresaId) return;
  const client = (await getSupabaseServer()) as DbClient;
  const { error } = await client
    .from("lava_whatsapp_integracoes")
    .update(payload)
    .eq("empresa_id", current.empresaId)
    .eq("provider", "evolution");
  if (error) throw new Error(error.message);
}

function extractQrCode(json: unknown): string {
  const row = json as any;
  const value =
    row?.base64 ||
    row?.qrcode ||
    row?.qr ||
    row?.code ||
    row?.data?.base64 ||
    row?.data?.qrcode ||
    row?.data?.qr ||
    row?.instance?.qrcode?.base64 ||
    row?.instance?.qrcode?.code ||
    "";
  return typeof value === "string" && value.length > 40 ? value : "";
}

function extractPairingCode(json: unknown): string {
  const row = json as any;
  const value = row?.pairingCode || row?.pairing_code || row?.data?.pairingCode || row?.data?.pairing_code || "";
  return typeof value === "string" ? value.trim() : "";
}

function extractConnectionState(json: unknown): string {
  const row = json as any;
  return String(
    row?.state ||
      row?.connectionState ||
      row?.status ||
      row?.instance?.state ||
      row?.instance?.connectionState ||
      row?.instance?.status ||
      row?.instance?.instance?.state ||
      "desconectado"
  ).toLowerCase();
}

function isEvolutionConnected(state: unknown) {
  const normalized = String(state ?? "").toLowerCase();
  return ["open", "connected", "conectado", "online"].includes(normalized);
}

function extractExternalId(json: unknown) {
  const row = json as Row;
  const key = row.key as Row | undefined;
  return String(row.keyId ?? row.id ?? key?.id ?? row.messageId ?? "");
}

function evolutionMissingMessage(manager: EvolutionManagerConfig) {
  if (manager.apiUrl && !manager.apiKeyConfigured) {
    return "A URL da Evolution foi encontrada, mas a API Key central não foi lida pelo app. Você pode colar a AUTHENTICATION_API_KEY no campo avançado Evolution API Key e salvar o modo do WhatsApp, ou conferir LAVAGESTOR_EVOLUTION_MANAGER_API_KEY na Vercel.";
  }
  if (!manager.apiUrl && manager.apiKeyConfigured) {
    return "A API Key da Evolution foi encontrada, mas a URL central não foi configurada. Configure LAVAGESTOR_EVOLUTION_MANAGER_URL na Vercel.";
  }
  return "O WhatsApp automático ainda não está disponível. Configure a Evolution central na Vercel ou preencha URL/API Key em Configurações avançadas.";
}

function slugPart(value: string) {
  return String(value || "lavagestor")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "lavagestor";
}
