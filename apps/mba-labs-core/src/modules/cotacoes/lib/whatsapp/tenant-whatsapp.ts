import "server-only";
import * as QRCode from "qrcode";

import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";
import { isTenantSuspended } from "@/modules/cotacoes/lib/auth/session";

type EvolutionConfig = {
  api_url: string | null;
  api_token: string | null;
  provider: string;
  ativo: boolean;
};
type SessionRow = { tenant_id: string; instance_name: string; status: string };
type Result = { connected: boolean; status: string; instanceName: string; qr?: string; message?: string };

function db() { return createSupabaseAdminClient(); }

async function getInfrastructure() {
  const supabase = db();
  const { data, error } = await supabase.from("cot_whatsapp_global_config")
    .select("provider,api_url,api_token,ativo")
    .eq("ativo", true).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const config = data as EvolutionConfig | null;
  if (config?.provider !== "evolution_api" || !config.api_url || !config.api_token || !config.ativo) {
    throw new Error("Infraestrutura Evolution API não configurada pelo administrador. Não será utilizado o WhatsApp central.");
  }
  const url = new URL(config.api_url.trim());
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("A URL da infraestrutura WhatsApp precisa utilizar HTTPS.");
  }
  // A infraestrutura global é gerenciada apenas no servidor; clientes não podem trocar seu endereço nem ler a chave.
  const cleanPath = url.pathname.replace(/\/message\/sendText.*$/, "").replace(/\/+$/, "");
  return { base: url.origin + cleanPath, key: config.api_token };
}

async function evolution(path: string, init: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {}) {
  const config = await getInfrastructure();
  const response = await fetch(config.base + path, {
    method: init.method ?? "GET",
    headers: { apikey: config.key, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  const content = await response.text();
  let payload: Record<string, any> = {};
  try { payload = JSON.parse(content); } catch {}
  if (!response.ok) {
    // Erros da API externa podem conter tokens/detalhes sensíveis; nunca incluí-los na resposta.
    throw new Error(`WhatsApp não concluiu operação (HTTP ${response.status}). Verifique instância e infraestrutura.`);
  }
  return payload;
}

function connectionState(payload: any) {
  return String(payload?.instance?.state ?? payload?.instance?.connectionStatus ??
    payload?.state ?? payload?.status ?? payload?.connectionState ?? "desconectado").toLowerCase();
}
function connected(state: string) { return ["open", "connected", "online", "conectado"].includes(state); }

async function getTenant(tenantId: string) {
  const { data, error } = await db().from("tenants").select("id,status").eq("id", tenantId).maybeSingle();
  if (error) throw error;
  if (!data || isTenantSuspended(data.status)) throw new Error("Empresa inexistente ou suspensa.");
}

async function sessionFor(tenantId: string) {
  const { data, error } = await db().from("cot_whatsapp_tenant_sessions")
    .select("tenant_id,instance_name,status").eq("tenant_id", tenantId).maybeSingle();
  if (error) throw error;
  return data as SessionRow | null;
}

async function updateState(tenantId: string, status: string, message?: string | null) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status, last_checked_at: now, updated_at: now, last_error: message ?? null,
  };
  if (status === "conectado") payload.last_connected_at = now;
  const { error } = await db().from("cot_whatsapp_tenant_sessions").update(payload).eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function getTenantWhatsAppStatus(tenantId: string): Promise<Result> {
  await getTenant(tenantId);
  const existing = await sessionFor(tenantId);
  if (!existing) return { connected: false, status: "nao_configurado", instanceName: "" };
  try {
    const state = connectionState(await evolution(`/instance/connectionState/${encodeURIComponent(existing.instance_name)}`));
    const ok = connected(state);
    await updateState(tenantId, ok ? "conectado" : "desconectado");
    return { connected: ok, status: ok ? "conectado" : "desconectado", instanceName: existing.instance_name };
  } catch {
    // Nunca transformar erros em "conectado"; não há fallback para o número central.
    await updateState(tenantId, "erro", "Não foi possível verificar a instância.");
    return { connected: false, status: "erro", instanceName: existing.instance_name };
  }
}

export async function connectTenantWhatsApp(tenantId: string): Promise<Result> {
  await getTenant(tenantId);
  const previous = await sessionFor(tenantId);
  const instanceName = previous?.instance_name ?? `mbacot_${tenantId.replace(/-/g, "").slice(0,28)}`;
  if (!previous) {
    try {
      await evolution("/instance/create", {
        method: "POST",
        body: { instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true },
      });
    } catch (error) {
      // Nunca associar instância que já existe a outro tenant. O nome é determinístico por UUID.
      throw new Error(error instanceof Error ? error.message : "Não foi possível criar a instância WhatsApp.");
    }
    const { error } = await db().from("cot_whatsapp_tenant_sessions").insert({
      tenant_id: tenantId, instance_name: instanceName, status: "aguardando_qr",
    });
    if (error) throw error;
  }

  const state = await getTenantWhatsAppStatus(tenantId);
  if (state.connected) return state;
  const payload = await evolution(`/instance/connect/${encodeURIComponent(instanceName)}`);
  const base64 = [payload?.base64, payload?.qrcode?.base64, payload?.qrcode?.image]
    .find((value) => typeof value === "string" && value.length > 100);
  const directQr = base64 && (base64.startsWith("data:image/png;base64,") ||
    /^[A-Za-z0-9+/=]+$/.test(base64))
      ? (base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`)
      : undefined;
  // Alguns provedores enviam somente o texto do QR, não a imagem pronta.
  const rawQrCode = [payload?.code, payload?.qrcode?.code, payload?.qrcode]
    .find((value) => typeof value === "string" && value.startsWith("2@"));
  const qr = directQr ?? (rawQrCode ? await QRCode.toDataURL(rawQrCode, { width: 320, margin: 2 }) : undefined);
  await updateState(tenantId, "aguardando_qr");
  return {
    connected: false, status: "aguardando_qr", instanceName,
    qr, message: qr ? "Escaneie o QR Code usando Aparelhos conectados do seu WhatsApp." :
      "Instância criada, mas o provedor não disponibilizou imagem de QR Code. Verifique a configuração da Evolution API.",
  };
}

export async function disconnectTenantWhatsApp(tenantId: string) {
  await getTenant(tenantId);
  const row = await sessionFor(tenantId);
  if (!row) throw new Error("Nenhuma conexão WhatsApp cadastrada.");
  await evolution(`/instance/logout/${encodeURIComponent(row.instance_name)}`, { method: "DELETE" });
  await updateState(tenantId, "desconectado");
  return { ok: true };
}

export async function getTenantWhatsAppSendingConfig(tenantId: string) {
  const row = await sessionFor(tenantId);
  if (!row) throw new Error("Conecte o WhatsApp desta empresa em Configurações. O número central não será utilizado.");
  const status = await getTenantWhatsAppStatus(tenantId);
  if (!status.connected) throw new Error("O WhatsApp da empresa está desconectado. Reconecte-o em Configurações.");
  const config = await getInfrastructure();
  return { base: config.base, key: config.key, instance: row.instance_name };
}
