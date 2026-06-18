import crypto from "node:crypto";
import type { CurrentUserProfile } from "@/lib/core-data";
import { ensureLexEscritorio, getLexSupabaseClient } from "./data";
import type { StorageProvider } from "./storage";

export type StorageDownloadResult = {
  bytes: Buffer;
  mimeType: string;
  fileName: string;
};

export async function downloadFromConnectedStorage(params: {
  current: CurrentUserProfile;
  provider: StorageProvider;
  path?: string;
  fileId?: string;
}): Promise<StorageDownloadResult> {
  const connection = await getConnection(params.current, params.provider);
  if (!connection) {
    throw new Error("Nenhum armazenamento conectado para este escritório.");
  }

  const accessToken = await getFreshAccessToken(params.provider, connection);

  if (params.provider === "dropbox") {
    return downloadDropbox(accessToken, params.path || "");
  }

  return downloadGoogleDrive(accessToken, params.fileId || "");
}

async function getConnection(current: CurrentUserProfile, provider: StorageProvider) {
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

async function downloadDropbox(accessToken: string, path: string): Promise<StorageDownloadResult> {
  if (!path) throw new Error("Arquivo sem caminho no Dropbox.");

  const response = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "dropbox-api-arg": JSON.stringify({ path }),
    },
  });

  const metaHeader = response.headers.get("dropbox-api-result") || "{}";
  const metadata = safeJson(metaHeader);
  const fileName = String(metadata.name ?? path.split("/").pop() ?? "documento");

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || "Falha ao baixar arquivo do Dropbox.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, fileName, mimeType: guessMimeType(fileName) };
}

async function downloadGoogleDrive(accessToken: string, fileId: string): Promise<StorageDownloadResult> {
  if (!fileId) throw new Error("Arquivo sem ID do Google Drive.");

  const metadataResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=name,mimeType`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  const metadata = await metadataResponse.json().catch(() => ({}));
  const fileName = String(metadata.name ?? "documento");

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || "Falha ao baixar arquivo do Google Drive.");
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, fileName, mimeType: String(metadata.mimeType ?? response.headers.get("content-type") ?? guessMimeType(fileName)) };
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

function guessMimeType(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

function safeJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}
