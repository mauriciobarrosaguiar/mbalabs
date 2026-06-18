import crypto from "node:crypto";
import type { CurrentUserProfile } from "@/lib/core-data";
import { ensureLexEscritorio, getLexSupabaseClient } from "./data";
import { slugSeguro } from "./formatters";

export type StorageProvider = "google_drive" | "dropbox";

export type UploadResult = {
  fileId: string;
  folderId?: string;
  path: string;
  url?: string;
};

export function isStorageProvider(value: string): value is StorageProvider {
  return value === "google_drive" || value === "dropbox";
}

export function getOAuthUrl(provider: StorageProvider, state: string, origin: string) {
  const redirectUri = `${origin}/api/lexgestor/storage/callback/${provider}`;

  if (provider === "google_drive") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("Configure GOOGLE_CLIENT_ID na Vercel.");
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

  const clientId = process.env.DROPBOX_APP_KEY;
  if (!clientId) throw new Error("Configure DROPBOX_APP_KEY na Vercel.");
  const url = new URL("https://www.dropbox.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("token_access_type", "offline");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeOAuthCode(provider: StorageProvider, code: string, origin: string) {
  const redirectUri = `${origin}/api/lexgestor/storage/callback/${provider}`;
  if (provider === "google_drive") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error_description || "Falha ao conectar Google Drive.");

    const profile = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${payload.access_token}` },
    }).then((res) => res.json()).catch(() => ({}));

    return {
      accessToken: String(payload.access_token),
      refreshToken: String(payload.refresh_token ?? ""),
      expiresAt: expiresAt(payload.expires_in),
      scopes: String(payload.scope ?? ""),
      accountEmail: String(profile.email ?? ""),
      accountId: String(profile.id ?? ""),
    };
  }

  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!appKey || !appSecret) throw new Error("Configure DROPBOX_APP_KEY e DROPBOX_APP_SECRET.");

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || "Falha ao conectar Dropbox.");

  const account = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: { authorization: `Bearer ${payload.access_token}` },
  }).then((res) => res.json()).catch(() => ({}));

  return {
    accessToken: String(payload.access_token),
    refreshToken: String(payload.refresh_token ?? ""),
    expiresAt: expiresAt(payload.expires_in),
    scopes: String(payload.scope ?? ""),
    accountEmail: String(account.email ?? ""),
    accountId: String(account.account_id ?? ""),
  };
}

export async function saveStorageConnection(
  current: CurrentUserProfile,
  provider: StorageProvider,
  tokens: Awaited<ReturnType<typeof exchangeOAuthCode>>,
) {
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");
  if (!escritorioId) throw new Error("Configure o escritório antes de conectar armazenamento.");

  const escritorioNome = text(escritorio?.nome) || "Escritorio";
  const rootFolderPath = montarPastaRaizEscritorio(escritorioNome);

  const payload = {
    escritorio_id: escritorioId,
    provider,
    status: "conectado",
    account_email: tokens.accountEmail,
    root_folder_path: rootFolderPath,
    access_token_encrypted: encrypt(tokens.accessToken),
    refresh_token_encrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    token_expires_at: tokens.expiresAt,
    scopes: tokens.scopes,
    updated_at: new Date().toISOString(),
  };

  const result = await client
    .from("lex_storage_connections")
    .upsert(payload, { onConflict: "escritorio_id,provider" });
  if (result.error) throw result.error;
}

export async function getConnectedStorage(current: CurrentUserProfile, provider: StorageProvider) {
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");
  if (!escritorioId) return null;

  const { data, error } = await client
    .from("lex_storage_connections")
    .select("*")
    .eq("escritorio_id", escritorioId)
    .eq("provider", provider)
    .eq("status", "conectado")
    .maybeSingle();

  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function uploadToConnectedStorage(params: {
  current: CurrentUserProfile;
  provider: StorageProvider;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  folderPath: string;
}) {
  const connection = await getConnectedStorage(params.current, params.provider);
  if (!connection) {
    return null;
  }

  const accessToken = await getFreshAccessToken(params.provider, connection);
  if (params.provider === "google_drive") {
    return uploadGoogleDrive({
      accessToken,
      fileName: params.fileName,
      mimeType: params.mimeType,
      bytes: params.bytes,
      folderPath: params.folderPath,
    });
  }

  return uploadDropbox({
    accessToken,
    fileName: params.fileName,
    mimeType: params.mimeType,
    bytes: params.bytes,
    folderPath: params.folderPath,
  });
}

export async function disconnectStorage(current: CurrentUserProfile, provider?: StorageProvider) {
  const client = await getLexSupabaseClient();
  const escritorio = await ensureLexEscritorio(client, current);
  const escritorioId = String(escritorio?.id ?? "");
  if (!escritorioId) return;

  let query = client
    .from("lex_storage_connections")
    .update({
      status: "nao_conectado",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("escritorio_id", escritorioId);

  if (provider) {
    query = query.eq("provider", provider);
  }

  await query;
}

export async function testStorageConnection(current: CurrentUserProfile, requestedProvider?: StorageProvider) {
  const providers = requestedProvider ? [requestedProvider] : (["google_drive", "dropbox"] as const);

  for (const provider of providers) {
    const connection = await getConnectedStorage(current, provider);
    if (!connection) continue;
    const accessToken = await getFreshAccessToken(provider, connection);

    if (provider === "google_drive") {
      const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error("Google Drive não respondeu ao teste.");
      return provider;
    }

    const response = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error("Dropbox não respondeu ao teste.");
    return provider;
  }

  throw new Error("Nenhum armazenamento conectado.");
}

export function montarPastaRaizEscritorio(nomeEscritorio: string) {
  return `/LexGestor/Escritorio - ${slugSeguro(nomeEscritorio || "Escritorio")}`;
}

async function getFreshAccessToken(provider: StorageProvider, connection: Record<string, unknown>) {
  const encrypted = text(connection.access_token_encrypted);
  const refreshToken = text(connection.refresh_token_encrypted) ? decrypt(text(connection.refresh_token_encrypted)) : "";
  const expiresAtValue = text(connection.token_expires_at);
  const expiresAtDate = expiresAtValue ? new Date(expiresAtValue) : null;

  if (encrypted && (!expiresAtDate || expiresAtDate.getTime() - Date.now() > 60_000)) {
    return decrypt(encrypted);
  }

  if (!refreshToken) {
    if (!encrypted) throw new Error("Conexão sem token de acesso.");
    return decrypt(encrypted);
  }

  if (provider === "google_drive") {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error_description || "Falha ao atualizar Google Drive.");
    await updateToken(connection, payload.access_token, payload.expires_in);
    return String(payload.access_token);
  }

  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  if (!appKey || !appSecret) throw new Error("Configure DROPBOX_APP_KEY e DROPBOX_APP_SECRET.");

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${appKey}:${appSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description || "Falha ao atualizar Dropbox.");
  await updateToken(connection, payload.access_token, payload.expires_in);
  return String(payload.access_token);
}

async function updateToken(connection: Record<string, unknown>, accessToken: string, expiresIn: unknown) {
  const client = await getLexSupabaseClient();
  await client
    .from("lex_storage_connections")
    .update({
      access_token_encrypted: encrypt(accessToken),
      token_expires_at: expiresAt(expiresIn),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);
}

async function uploadDropbox(params: {
  accessToken: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  folderPath: string;
}): Promise<UploadResult> {
  const folderPath = normalizeDropboxPath(params.folderPath);
  await ensureDropboxFolderPath(params.accessToken, folderPath);

  const path = `${folderPath}/${safeFileName(params.fileName)}`;
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
        strict_conflict: false,
      }),
    },
    body: toArrayBuffer(params.bytes),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_summary || "Falha ao enviar para Dropbox.");

  return {
    fileId: String(payload.id ?? ""),
    path: String(payload.path_display ?? path),
  };
}

async function ensureDropboxFolderPath(accessToken: string, folderPath: string) {
  const parts = normalizeDropboxPath(folderPath).split("/").filter(Boolean);
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
      "content-type": "application/json",
    },
    body: JSON.stringify({
      path,
      autorename: false,
    }),
  });

  if (response.ok) return;

  const payload = await response.json().catch(() => ({}));
  const summary = String(payload.error_summary ?? "");
  const tag = String(payload.error?.path?.[".tag"] ?? "");

  if (response.status === 409 && (summary.includes("conflict/folder") || tag === "conflict")) {
    return;
  }

  throw new Error(summary || `Falha ao criar pasta no Dropbox: ${path}`);
}

function normalizeDropboxPath(path: string) {
  const clean = path
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  return `/${clean}`;
}

async function uploadGoogleDrive(params: {
  accessToken: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  folderPath: string;
}): Promise<UploadResult> {
  const folderId = await ensureGoogleFolderPath(params.accessToken, params.folderPath);
  const boundary = `lexgestor-${crypto.randomUUID()}`;
  const metadata = {
    name: params.fileName,
    parents: folderId ? [folderId] : undefined,
  };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=utf-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\ncontent-type: ${params.mimeType || "application/octet-stream"}\r\n\r\n`),
    params.bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,parents", {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.accessToken}`,
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body: toArrayBuffer(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.message || "Falha ao enviar para Google Drive.");

  return {
    fileId: String(payload.id ?? ""),
    folderId,
    path: `${params.folderPath}/${params.fileName}`,
    url: String(payload.webViewLink ?? ""),
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
    parentId ? `'${parentId}' in parents` : "",
  ].filter(Boolean).join(" and ");
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", q);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "1");

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json();
  return String(payload.files?.[0]?.id ?? "");
}

async function createGoogleFolder(accessToken: string, name: string, parentId: string) {
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    }),
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
  if (!iv || !tag || !encrypted) throw new Error("Token de armazenamento inválido.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function tokenKey() {
  const secret = process.env.LEXGESTOR_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Configure LEXGESTOR_TOKEN_SECRET para criptografar tokens.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function expiresAt(expiresIn: unknown) {
  const seconds = Number(expiresIn ?? 3600);
  return new Date(Date.now() + Math.max(seconds - 60, 60) * 1000).toISOString();
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "documento";
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}
