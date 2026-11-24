import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export type CloudContext = {
  owner_type: "empresa" | "usuario";
  owner_id: string;
  user_id: string;
  can_manage: boolean;
};
export type CloudConnection = {
  id: string; owner_type: string; owner_id: string; provider: string;
  account_email: string | null; account_subject: string | null;
  access_token_encrypted: string | null; refresh_token_encrypted: string | null;
  token_expires_at: string | null; root_folder_id: string | null;
  status: string; last_error: string | null; last_tested_at: string | null;
};
export const cloudDb = () => createSupabaseAdminClient() as any;

export class CloudError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function cloudContext(): Promise<CloudContext> {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) throw new CloudError("Autenticação necessária.", 401);
  if (session.profile.status !== "ativo") throw new CloudError("Conta inativa: acesso bloqueado.", 403);
  const type = String(session.profile.tipo || "").toLowerCase();
  const master = ["super_admin", "admin_master"].includes(type);
  const allowed = (session.appsLiberados || []).some((a) => a.slug === "dronegestor" && a.canAccess);
  if (!master && !allowed) throw new CloudError("Acesso ao AgroDoc não liberado.", 403);
  return {
    owner_type: session.profile.empresa_id ? "empresa" : "usuario",
    owner_id: session.profile.empresa_id || session.profile.id,
    user_id: session.profile.id,
    can_manage: !session.profile.empresa_id || canManageDroneGestor({ tipo: session.profile.tipo, isAdminMaster: master, permissoes: session.permissoes })
  };
}
export function requireCloudManager(context: CloudContext) {
  if (!context.can_manage && context.owner_type !== "usuario") throw new CloudError("Somente a gestão pode alterar a conexão da empresa.", 403);
}
export function cloudScope(query: any, context: CloudContext) {
  return query.eq("owner_type", context.owner_type).eq("owner_id", context.owner_id);
}
export async function cloudConnection(context: CloudContext): Promise<CloudConnection | null> {
  const query = cloudScope(cloudDb().from("agrodoc_cloud_connections").select("*"), context);
  const { data, error } = await query.eq("provider", "google_drive").maybeSingle();
  if (error) throw error;
  return data as CloudConnection | null;
}
function secretKey() {
  const secret = process.env.AGRODOC_CLOUD_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new CloudError("Chave AGRODOC_CLOUD_ENCRYPTION_KEY não configurada.", 503);
  return createHash("sha256").update(secret).digest();
}
export function encryptCloud(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const payload = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), payload].map((part) => part.toString("base64url")).join(".");
}
export function decryptCloud(value: string) {
  const [iv, tag, payload] = value.split(".");
  if (!iv || !tag || !payload) throw new CloudError("Credencial inválida.", 500);
  const cipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([cipher.update(Buffer.from(payload, "base64url")), cipher.final()]).toString("utf8");
}
export function googleSettings() {
  const clientId = process.env.AGRODOC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.AGRODOC_GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.AGRODOC_GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri || !redirectUri.startsWith("https://"))
    throw new CloudError("Google Drive não configurado: informe CLIENT_ID, CLIENT_SECRET e REDIRECT_URI próprios do AgroDoc.", 503);
  return { clientId, clientSecret, redirectUri };
}
export async function googleTokens(values: Record<string,string>) {
  const config = googleSettings();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...values, client_id: config.clientId, client_secret: config.clientSecret })
  });
  const result = await response.json().catch(() => ({})) as Record<string,any>;
  if (!response.ok || !result.access_token) throw new CloudError("Autorização Google não concluída. Revise consentimento e credenciais.", 502);
  return result;
}
export async function googleAccessToken(context: CloudContext) {
  const connection = await cloudConnection(context);
  if (!connection || connection.status !== "connected") throw new CloudError("Google Drive da empresa não conectado.", 409);
  const expires = new Date(connection.token_expires_at || 0).getTime();
  if (connection.access_token_encrypted && expires > Date.now() + 90000)
    return { token: decryptCloud(connection.access_token_encrypted), connection };
  if (!connection.refresh_token_encrypted) throw new CloudError("Reconecte a conta Google para renovar a permissão.", 401);
  const refreshed = await googleTokens({ grant_type: "refresh_token", refresh_token: decryptCloud(connection.refresh_token_encrypted) });
  const { error } = await cloudDb().from("agrodoc_cloud_connections").update({
    access_token_encrypted: encryptCloud(String(refreshed.access_token)),
    token_expires_at: new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }).eq("id", connection.id).eq("owner_type", context.owner_type).eq("owner_id", context.owner_id);
  if (error) throw error;
  return { token: String(refreshed.access_token), connection };
}
export async function driveCall(token: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", "Bearer " + token);
  const response = await fetch("https://www.googleapis.com/drive/v3/" + path, {
    ...init, headers, cache: "no-store"
  });
  if (!response.ok) throw new CloudError("Google Drive respondeu com erro HTTP " + response.status + ".", response.status === 401 ? 401 : 502);
  return response;
}
function encodeDriveQuery(value: string) { return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
export function safeCloudName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._ -]/g, "-").trim().slice(0, 120) || "Sem nome";
}
export async function ensureDriveFolder(context: CloudContext, token: string, key: string, name: string, parentId?: string, accountSubject = "") {
  key = "account:" + (accountSubject || "unknown") + ":" + key;
  const q = cloudScope(cloudDb().from("agrodoc_cloud_folders").select("provider_folder_id"), context);
  const { data, error } = await q.eq("provider", "google_drive").eq("folder_key", key).maybeSingle();
  if (error) throw error;
  if (data?.provider_folder_id) return String(data.provider_folder_id);
  const query = "name = '" + encodeDriveQuery(name) + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false" +
    (parentId ? " and '" + encodeDriveQuery(parentId) + "' in parents" : " and 'root' in parents");
  const list = await driveCall(token, "files?fields=files(id,name),nextPageToken&pageSize=100&q=" + encodeURIComponent(query));
  const listBody = await list.json() as { files?: Array<{id:string}> };
  let id = listBody.files?.[0]?.id;
  if (!id) {
    const created = await driveCall(token, "files?fields=id", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? {parents:[parentId]} : {}) })
    });
    id = (await created.json() as {id:string}).id;
  }
  const { error: writeError } = await cloudDb().from("agrodoc_cloud_folders").upsert({
    owner_type: context.owner_type, owner_id: context.owner_id, provider:"google_drive",
    folder_key:key, provider_folder_id:id
  }, {onConflict:"owner_type,owner_id,provider,folder_key"});
  if (writeError) throw writeError;
  return id!;
}
export async function driveOperationFolder(context: CloudContext, token: string, osId: string, propertyId: string, propertyName: string, category: string, accountSubject = "") {
  const root = await ensureDriveFolder(context, token, "root", "MBA AgroDoc", undefined, accountSubject);
  const year = String(new Date().getFullYear());
  const yearId = await ensureDriveFolder(context, token, "year:" + year, year, root, accountSubject);
  const propertyKey = propertyId || "nao-informada";
  const propertyFolder = await ensureDriveFolder(context, token, "year:"+year+":property:"+propertyKey,
    safeCloudName(propertyName || "Propriedade") + " (" + safeCloudName(propertyKey).slice(0, 20) + ")", yearId, accountSubject);
  const os = await ensureDriveFolder(context, token, "year:"+year+":os:"+osId,
    "OS-" + safeCloudName(osId), propertyFolder, accountSubject);
  return ensureDriveFolder(context, token, "year:"+year+":os:"+osId+":category:"+category, category, os, accountSubject);
}
export async function cloudEvent(context:CloudContext, action:string, fileId?:string, details?:Record<string,unknown>) {
  await cloudDb().from("agrodoc_cloud_events").insert({
    owner_type:context.owner_type, owner_id:context.owner_id, actor_id:context.user_id,
    file_id:fileId || null, action, details:details || {}
  });
}
