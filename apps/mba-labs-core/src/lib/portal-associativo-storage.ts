import crypto from "node:crypto";
import type { CurrentUserProfile } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";

export type PortalStorageProvider = "dropbox" | "google_drive";

export type PortalUploadResult = {
  fileId: string;
  folderId?: string;
  path: string;
  url?: string;
};

type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string;
  accountEmail: string;
  accountId: string;
};

export function isPortalStorageProvider(value: string): value is PortalStorageProvider {
  return value === "dropbox" || value === "google_drive";
}

export function portalStorageProviderLabel(provider: string) {
  if (provider === "dropbox") return "Dropbox";
  if (provider === "google_drive") return "Google Drive";
  if (provider === "manual") return "Manual";
  return "Nenhum";
}

export function getPortalOAuthUrl(provider: PortalStorageProvider, state: string, origin: string) {
  const redirectUri = `${publicOrigin(origin)}/api/portal-associativo/storage/callback/${provider}`;

  if (provider === "google_drive") {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    if (!clientId) throw new Error("Configure GOOGLE_DRIVE_CLIENT_ID.");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  const clientId = process.env.DROPBOX_CLIENT_ID;
  if (!clientId) throw new Error("Configure DROPBOX_CLIENT_ID.");
  const url = new URL("https://www.dropbox.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("token_access_type", "offline");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangePortalOAuthCode(provider: PortalStorageProvider, code: string, origin: string): Promise<OAuthTokens> {
  const redirectUri = `${publicOrigin(origin)}/api/portal-associativo/storage/callback/${provider}`;

  if (provider === "google_drive") {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Configure GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET.");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error_description || "Falha ao conectar Google Drive.");

    const profile = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${payload.access_token}` }
    }).then((res) => res.json()).catch(() => ({}));

    return {
      accessToken: String(payload.access_token),
      refreshToken: String(payload.refresh_token ?? ""),
      expiresAt: expiresAt(payload.expires_in),
      scopes: String(payload.scope ?? ""),
      accountEmail: String(profile.email ?? ""),
      accountId: String(profile.id ?? "")
    };
  }

  const clientId = process.env.DROPBOX_CLIENT_ID;
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Configure DROPBOX_CLIENT_ID e DROPBOX_CLIENT_SECRET.");

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || "Falha ao conectar Dropbox.");

  const account = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: { authorization: `Bearer ${payload.access_token}` }
  }).then((res) => res.json()).catch(() => ({}));

  return {
    accessToken: String(payload.access_token),
    refreshToken: String(payload.refresh_token ?? ""),
    expiresAt: expiresAt(payload.expires_in),
    scopes: String(payload.scope ?? ""),
    accountEmail: String(account.email ?? ""),
    accountId: String(account.account_id ?? "")
  };
}

export async function savePortalStorageConnection(
  current: CurrentUserProfile,
  provider: PortalStorageProvider,
  tokens: OAuthTokens
) {
  const empresaId = requireEmpresaId(current);
  const client = (await getSupabaseServer()) as any;
  const rootFolderPath = "/Portal Associativo";

  const result = await client.from("assoc_storage_integracoes").upsert(
    {
      empresa_id: empresaId,
      provedor: provider,
      status: "conectado",
      account_email: tokens.accountEmail || null,
      account_id: tokens.accountId || null,
      root_folder_path: rootFolderPath,
      access_token_encrypted: encrypt(tokens.accessToken),
      refresh_token_encrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      token_expires_at: tokens.expiresAt,
      scopes: tokens.scopes || null,
      conectado_por: current.usuario.id,
      atualizado_por: current.usuario.id,
      atualizado_em: new Date().toISOString()
    },
    { onConflict: "empresa_id,provedor" }
  );
  if (result.error) throw result.error;

  const existingConfig = await client.from("assoc_configuracoes").select("id").eq("empresa_id", empresaId).maybeSingle();
  if (existingConfig.data?.id) {
    await client
      .from("assoc_configuracoes")
      .update({ storage_provider_ativo: provider, atualizado_em: new Date().toISOString() })
      .eq("empresa_id", empresaId);
  } else {
    await client.from("assoc_configuracoes").insert({
      empresa_id: empresaId,
      nome_publico_entidade: "Portal Associativo",
      storage_provider_ativo: provider,
      atualizado_em: new Date().toISOString()
    });
  }
}

export async function getPortalStorageConnection(current: CurrentUserProfile, provider?: PortalStorageProvider): Promise<Record<string, unknown> | null> {
  const empresaId = current.empresaId;
  if (!empresaId) return null;
  const client = (await getSupabaseServer()) as any;

  if (provider) {
    const { data, error } = await client
      .from("assoc_storage_integracoes")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provedor", provider)
      .eq("status", "conectado")
      .maybeSingle();
    if (error || !data) return null;
    return data as Record<string, unknown>;
  }

  const config = await client
    .from("assoc_configuracoes")
    .select("storage_provider_ativo")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const configuredProvider = text(config.data?.storage_provider_ativo);
  if (isPortalStorageProvider(configuredProvider)) {
    const configured: Record<string, unknown> | null = await getPortalStorageConnection(current, configuredProvider);
    if (configured) return configured;
  }

  const { data, error } = await client
    .from("assoc_storage_integracoes")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("status", "conectado")
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function uploadToPortalStorage(params: {
  current: CurrentUserProfile;
  provider?: PortalStorageProvider;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  folderPath: string;
}) {
  const connection = await getPortalStorageConnection(params.current, params.provider);
  if (!connection) return null;
  const provider = text(connection.provedor);
  if (!isPortalStorageProvider(provider)) return null;

  const accessToken = await getFreshAccessToken(provider, connection);
  if (provider === "google_drive") {
    return uploadGoogleDrive({
      accessToken,
      fileName: params.fileName,
      mimeType: params.mimeType,
      bytes: params.bytes,
      folderPath: params.folderPath
    });
  }

  return uploadDropbox({
    accessToken,
    fileName: params.fileName,
    bytes: params.bytes,
    folderPath: params.folderPath
  });
}

export async function deleteFromPortalStorage(params: {
  current: CurrentUserProfile;
  provider: PortalStorageProvider;
  path?: string;
  fileId?: string;
}) {
  const connection = await getPortalStorageConnection(params.current, params.provider);
  if (!connection) throw new Error("Nenhum armazenamento conectado para esta empresa.");
  const accessToken = await getFreshAccessToken(params.provider, connection);

  if (params.provider === "google_drive") {
    if (!params.fileId) return;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(params.fileId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok && response.status !== 404) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error?.message || "Falha ao excluir arquivo no Google Drive.");
    }
    return;
  }

  if (!params.path) return;
  const response = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ path: params.path })
  });
  if (!response.ok && response.status !== 409) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error_summary || "Falha ao excluir arquivo no Dropbox.");
  }
}

export async function getPortalStorageAccessToken(current: CurrentUserProfile, provider: PortalStorageProvider) {
  const connection = await getPortalStorageConnection(current, provider);
  if (!connection) throw new Error("Nenhum armazenamento conectado para esta empresa.");
  return getFreshAccessToken(provider, connection);
}

export async function createDropboxTemporaryLink(current: CurrentUserProfile, path: string) {
  const accessToken = await getPortalStorageAccessToken(current, "dropbox");
  const response = await fetch("https://api.dropboxapi.com/2/files/get_temporary_link", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ path })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_summary || "Falha ao gerar link temporario no Dropbox.");
  return String(payload.link ?? "");
}

export async function testPortalStorageConnection(current: CurrentUserProfile, requestedProvider?: PortalStorageProvider) {
  const connection = await getPortalStorageConnection(current, requestedProvider);
  if (!connection) throw new Error("Nenhum Dropbox ou Google Drive conectado.");

  const provider = text(connection.provedor);
  if (!isPortalStorageProvider(provider)) throw new Error("Provedor invalido.");
  const accessToken = await getFreshAccessToken(provider, connection);

  if (provider === "google_drive") {
    const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error("Google Drive nao respondeu ao teste.");
    return provider;
  }

  const response = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error("Dropbox nao respondeu ao teste.");
  return provider;
}

export async function disconnectPortalStorage(current: CurrentUserProfile, provider?: PortalStorageProvider) {
  const empresaId = requireEmpresaId(current);
  const client = (await getSupabaseServer()) as any;
  let query = client
    .from("assoc_storage_integracoes")
    .update({
      status: "desconectado",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      atualizado_por: current.usuario.id,
      atualizado_em: new Date().toISOString()
    })
    .eq("empresa_id", empresaId);

  if (provider) query = query.eq("provedor", provider);
  const { error } = await query;
  if (error) throw error;

  await client.from("assoc_configuracoes").update({ storage_provider_ativo: "nenhum" }).eq("empresa_id", empresaId);
}

export function buildPortalStorageFolder(params: {
  root?: string;
  area: "pessoa" | "unidade" | "financeiro" | "reuniao" | "projeto" | "relatorio" | "notificacao";
  pessoaNome?: string;
  pessoaDocumento?: string;
  unidadeCodigo?: string;
  cobrancaAno?: number;
  cobrancaMes?: number;
  reuniaoTitulo?: string;
  reuniaoData?: string;
  projetoNome?: string;
  categoria?: string;
  date?: Date;
}) {
  const root = normalizeFolderPath(params.root || "/Portal Associativo");
  const now = params.date ?? new Date();
  const year = String(params.cobrancaAno || now.getFullYear());
  const month = String(params.cobrancaMes || now.getMonth() + 1).padStart(2, "0");
  const category = safePathPart(params.categoria || "Documentos");

  if (params.area === "pessoa") {
    return joinPath(root, "Pessoas", `${safePathPart(params.pessoaNome || "Pessoa")}_${safePathPart(params.pessoaDocumento || "sem-documento")}`, category);
  }
  if (params.area === "unidade") {
    return joinPath(root, "Unidades", safePathPart(params.unidadeCodigo || "Unidade"), category);
  }
  if (params.area === "financeiro") {
    return joinPath(root, "Financeiro", year, month, category);
  }
  if (params.area === "reuniao") {
    const title = `${safePathPart(params.reuniaoData || toDateInput(now))}_${safePathPart(params.reuniaoTitulo || "Reuniao")}`;
    return joinPath(root, "Reunioes", year, title, category);
  }
  if (params.area === "projeto") {
    return joinPath(root, "Projetos", safePathPart(params.projetoNome || "Projeto"), category);
  }
  if (params.area === "relatorio") {
    return joinPath(root, "Relatorios", year, month);
  }
  return joinPath(root, "Notificacoes", year, month);
}

async function getFreshAccessToken(provider: PortalStorageProvider, connection: Record<string, unknown>) {
  const encrypted = text(connection.access_token_encrypted);
  const refreshToken = text(connection.refresh_token_encrypted) ? decrypt(text(connection.refresh_token_encrypted)) : "";
  const expiresAtValue = text(connection.token_expires_at);
  const expiresAtDate = expiresAtValue ? new Date(expiresAtValue) : null;

  if (encrypted && (!expiresAtDate || expiresAtDate.getTime() - Date.now() > 60_000)) {
    return decrypt(encrypted);
  }

  if (!refreshToken) {
    if (!encrypted) throw new Error("Conexao sem token de acesso.");
    return decrypt(encrypted);
  }

  if (provider === "google_drive") {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Configure GOOGLE_DRIVE_CLIENT_ID e GOOGLE_DRIVE_CLIENT_SECRET.");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error_description || "Falha ao atualizar Google Drive.");
    await updateConnectionToken(connection, payload.access_token, payload.expires_in);
    return String(payload.access_token);
  }

  const clientId = process.env.DROPBOX_CLIENT_ID;
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Configure DROPBOX_CLIENT_ID e DROPBOX_CLIENT_SECRET.");

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || "Falha ao atualizar Dropbox.");
  await updateConnectionToken(connection, payload.access_token, payload.expires_in);
  return String(payload.access_token);
}

async function updateConnectionToken(connection: Record<string, unknown>, accessToken: string, expiresIn: unknown) {
  const client = (await getSupabaseServer()) as any;
  await client
    .from("assoc_storage_integracoes")
    .update({
      access_token_encrypted: encrypt(accessToken),
      token_expires_at: expiresAt(expiresIn),
      atualizado_em: new Date().toISOString()
    })
    .eq("id", connection.id);
}

async function uploadDropbox(params: {
  accessToken: string;
  fileName: string;
  bytes: Buffer;
  folderPath: string;
}): Promise<PortalUploadResult> {
  const folderPath = normalizeFolderPath(params.folderPath);
  await ensureDropboxFolderPath(params.accessToken, folderPath);
  const path = joinPath(folderPath, safeFileName(params.fileName));

  const response = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      "content-type": "application/octet-stream",
      "dropbox-api-arg": JSON.stringify({
        path,
        mode: "add",
        autorename: true,
        mute: false,
        strict_conflict: false
      })
    },
    body: toArrayBuffer(params.bytes)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_summary || "Falha ao enviar para Dropbox.");

  return {
    fileId: String(payload.id ?? ""),
    path: String(payload.path_display ?? path)
  };
}

async function ensureDropboxFolderPath(accessToken: string, folderPath: string) {
  const parts = normalizeFolderPath(folderPath).split("/").filter(Boolean);
  let currentPath = "";
  for (const part of parts) {
    currentPath = `${currentPath}/${part}`;
    await createDropboxFolderIfMissing(accessToken, currentPath);
  }
}

async function createDropboxFolderIfMissing(accessToken: string, path: string) {
  const response = await fetch("https://api.dropboxapi.com/2/files/create_folder_v2", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ path, autorename: false })
  });
  if (response.ok) return;

  const payload = await response.json().catch(() => ({}));
  const summary = String(payload.error_summary ?? "");
  const tag = String(payload.error?.path?.[".tag"] ?? "");
  if (response.status === 409 && (summary.includes("conflict/folder") || tag === "conflict")) return;
  throw new Error(summary || `Falha ao criar pasta no Dropbox: ${path}`);
}

async function uploadGoogleDrive(params: {
  accessToken: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  folderPath: string;
}): Promise<PortalUploadResult> {
  const folderId = await ensureGoogleFolderPath(params.accessToken, params.folderPath);
  const boundary = `portal-associativo-${crypto.randomUUID()}`;
  const metadata = {
    name: safeFileName(params.fileName),
    parents: folderId ? [folderId] : undefined
  };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=utf-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\ncontent-type: ${params.mimeType || "application/octet-stream"}\r\n\r\n`),
    params.bytes,
    Buffer.from(`\r\n--${boundary}--`)
  ]);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents", {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      "content-type": `multipart/related; boundary=${boundary}`
    },
    body: toArrayBuffer(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "Falha ao enviar para Google Drive.");

  return {
    fileId: String(payload.id ?? ""),
    folderId,
    path: joinPath(params.folderPath, safeFileName(params.fileName)),
    url: String(payload.webViewLink ?? "")
  };
}

async function ensureGoogleFolderPath(accessToken: string, folderPath: string) {
  const parts = folderPath.split("/").filter(Boolean);
  let parentId = "";
  for (const part of parts) {
    const found = await findGoogleFolder(accessToken, part, parentId);
    parentId = found || await createGoogleFolder(accessToken, part, parentId);
  }
  return parentId;
}

async function findGoogleFolder(accessToken: string, name: string, parentId: string) {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    parentId ? `'${parentId}' in parents` : ""
  ].filter(Boolean).join(" and ");
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "1");

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "Falha ao consultar pasta no Google Drive.");
  return String(payload.files?.[0]?.id ?? "");
}

async function createGoogleFolder(accessToken: string, name: string, parentId: string) {
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "Falha ao criar pasta no Google Drive.");
  return String(payload.id ?? "");
}

function encrypt(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Token de armazenamento invalido.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final()
  ]).toString("utf8");
}

function tokenKey() {
  const secret = process.env.STORAGE_ENCRYPTION_KEY;
  if (!secret) throw new Error("Configure STORAGE_ENCRYPTION_KEY para criptografar tokens de armazenamento.");
  return crypto.createHash("sha256").update(secret).digest();
}

function expiresAt(expiresIn: unknown) {
  const seconds = Number(expiresIn ?? 3600);
  return new Date(Date.now() + Math.max(seconds - 60, 60) * 1000).toISOString();
}

function publicOrigin(origin: string) {
  return process.env.NEXT_PUBLIC_APP_URL || origin;
}

function requireEmpresaId(current: CurrentUserProfile) {
  if (!current.empresaId) throw new Error("Selecione uma empresa antes de conectar armazenamento.");
  return current.empresaId;
}

function safeFileName(name: string) {
  return safePathPart(name).slice(0, 180) || "arquivo";
}

function safePathPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFolderPath(path: string) {
  return joinPath(...path.split("/"));
}

function joinPath(...parts: string[]) {
  const clean = parts
    .flatMap((part) => part.split("/"))
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  return `/${clean}`;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}
