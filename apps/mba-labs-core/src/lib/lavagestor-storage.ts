import crypto from "node:crypto";
import type { CurrentUserProfile } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";
import { LAVA_CHECKLIST_BUCKET } from "./lavagestor-checklists-data";

export type LavaStorageProvider = "google_drive" | "dropbox";

type Row = Record<string, unknown>;

export type LavaStorageUploadResult = {
  fileId: string;
  folderId?: string;
  path: string;
  url?: string;
};

const STORAGE_PROVIDERS = ["google_drive", "dropbox"] as const;
const SYNCABLE_CONNECTION_STATUSES = ["conectado", "erro"] as const;

export function isLavaStorageProvider(value: string): value is LavaStorageProvider {
  return value === "google_drive" || value === "dropbox";
}

export function lavaStorageProviderLabel(provider: LavaStorageProvider) {
  return provider === "google_drive" ? "Google Drive" : "Dropbox";
}

function getProviderOAuthConfig(provider: LavaStorageProvider, origin: string) {
  if (provider === "google_drive") {
    const clientId = firstEnv([
      ["LAVAGESTOR_GOOGLE_CLIENT_ID", process.env.LAVAGESTOR_GOOGLE_CLIENT_ID],
      ["GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID]
    ]);
    const clientSecret = firstEnv([
      ["LAVAGESTOR_GOOGLE_CLIENT_SECRET", process.env.LAVAGESTOR_GOOGLE_CLIENT_SECRET],
      ["GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET]
    ]);
    const redirect = firstEnv([
      ["LAVAGESTOR_GOOGLE_REDIRECT_URI", process.env.LAVAGESTOR_GOOGLE_REDIRECT_URI],
      ["GOOGLE_REDIRECT_URI", process.env.GOOGLE_REDIRECT_URI]
    ]);
    return {
      clientId: clientId.value,
      clientIdSource: clientId.key,
      clientSecret: clientSecret.value,
      redirectUri: redirect.value || defaultOAuthRedirectUri(provider, origin),
      redirectSource: redirect.key || "request_origin"
    };
  }

  const clientId = firstEnv([
    ["LAVAGESTOR_DROPBOX_CLIENT_ID", process.env.LAVAGESTOR_DROPBOX_CLIENT_ID],
    ["LAVAGESTOR_DROPBOX_APP_KEY", process.env.LAVAGESTOR_DROPBOX_APP_KEY],
    ["DROPBOX_APP_KEY", process.env.DROPBOX_APP_KEY]
  ]);
  const clientSecret = firstEnv([
    ["LAVAGESTOR_DROPBOX_CLIENT_SECRET", process.env.LAVAGESTOR_DROPBOX_CLIENT_SECRET],
    ["LAVAGESTOR_DROPBOX_APP_SECRET", process.env.LAVAGESTOR_DROPBOX_APP_SECRET],
    ["DROPBOX_APP_SECRET", process.env.DROPBOX_APP_SECRET]
  ]);
  const redirect = firstEnv([
    ["LAVAGESTOR_DROPBOX_REDIRECT_URI", process.env.LAVAGESTOR_DROPBOX_REDIRECT_URI],
    ["DROPBOX_REDIRECT_URI", process.env.DROPBOX_REDIRECT_URI]
  ]);
  return {
    clientId: clientId.value,
    clientIdSource: clientId.key,
    clientSecret: clientSecret.value,
    redirectUri: redirect.value || defaultOAuthRedirectUri(provider, origin),
    redirectSource: redirect.key || "request_origin"
  };
}

function defaultOAuthRedirectUri(provider: LavaStorageProvider, origin: string) {
  const safeOrigin = origin.replace(/\/+$/, "");
  return `${safeOrigin}/api/lavagestor/storage/callback/${provider}`;
}

function firstEnv(entries: Array<[string, string | undefined]>) {
  const entry = entries.find(([, value]) => Boolean(value?.trim()));
  return { key: entry?.[0] ?? "", value: entry?.[1]?.trim() ?? "" };
}

export function getLavaOAuthRedirectUri(provider: LavaStorageProvider, origin: string) {
  const config = getProviderOAuthConfig(provider, origin);
  return config.redirectUri;
}

export function getLavaOAuthDisplayConfigs(origin: string) {
  return STORAGE_PROVIDERS.map((provider) => {
    const config = getProviderOAuthConfig(provider, origin);
    return {
      provider,
      label: lavaStorageProviderLabel(provider),
      redirectUri: config.redirectUri,
      redirectSource: config.redirectSource,
      clientIdSource: config.clientIdSource,
      clientIdConfigured: Boolean(config.clientId)
    };
  });
}

export function getLavaOAuthUrl(provider: LavaStorageProvider, state: string, origin: string) {
  const config = getProviderOAuthConfig(provider, origin);
  const redirectUri = config.redirectUri;

  if (provider === "google_drive") {
    if (!config.clientId) throw new Error("Configure LAVAGESTOR_GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_ID na Vercel.");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email");
    url.searchParams.set("state", state);
    return url.toString();
  }

  if (!config.clientId) throw new Error("Configure LAVAGESTOR_DROPBOX_APP_KEY ou DROPBOX_APP_KEY na Vercel.");
  const url = new URL("https://www.dropbox.com/oauth2/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("token_access_type", "offline");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeLavaOAuthCode(provider: LavaStorageProvider, code: string, origin: string) {
  const config = getProviderOAuthConfig(provider, origin);
  const redirectUri = config.redirectUri;

  if (provider === "google_drive") {
    if (!config.clientId || !config.clientSecret) throw new Error("Configure LAVAGESTOR_GOOGLE_CLIENT_ID/SECRET ou GOOGLE_CLIENT_ID/SECRET.");

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    const payload = await readJsonResponse(response, "Google Drive");

    const profile = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${payload.access_token}` }
    }).then((res) => res.json()).catch(() => ({}));

    return {
      accessToken: String(payload.access_token ?? ""),
      refreshToken: String(payload.refresh_token ?? ""),
      expiresAt: expiresAt(payload.expires_in),
      scopes: String(payload.scope ?? ""),
      accountEmail: String(profile.email ?? ""),
      accountId: String(profile.id ?? "")
    };
  }

  if (!config.clientId || !config.clientSecret) throw new Error("Configure LAVAGESTOR_DROPBOX_APP_KEY/SECRET ou DROPBOX_APP_KEY/SECRET.");

  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`
    },
    body: new URLSearchParams({
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });
  const payload = await readJsonResponse(response, "Dropbox");

  const account = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
    method: "POST",
    headers: { authorization: `Bearer ${payload.access_token}` }
  }).then((res) => res.json()).catch(() => ({}));

  return {
    accessToken: String(payload.access_token ?? ""),
    refreshToken: String(payload.refresh_token ?? ""),
    expiresAt: expiresAt(payload.expires_in),
    scopes: String(payload.scope ?? ""),
    accountEmail: String(account.email ?? ""),
    accountId: String(account.account_id ?? "")
  };
}

export async function saveLavaStorageConnection(
  current: CurrentUserProfile,
  provider: LavaStorageProvider,
  tokens: Awaited<ReturnType<typeof exchangeLavaOAuthCode>>
) {
  if (!current.empresaId) throw new Error("Empresa não identificada.");
  const client = await getLavaClient();
  const empresa = await getEmpresa(client, current.empresaId);
  const rootFolderPath = montarPastaRaizEmpresa(empresaName(empresa));
  const payload = {
    empresa_id: current.empresaId,
    provider,
    status: "conectado",
    account_email: tokens.accountEmail,
    account_id: tokens.accountId,
    root_folder_path: rootFolderPath,
    access_token_encrypted: encrypt(tokens.accessToken),
    refresh_token_encrypted: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    token_expires_at: tokens.expiresAt,
    scopes: tokens.scopes,
    last_error: null,
    last_test_at: null,
    updated_at: new Date().toISOString()
  };

  const result = await client.from("lava_storage_connections").upsert(payload, { onConflict: "empresa_id,provider" });
  if (result.error) throw result.error;
}

export async function getLavaStorageConnections(current: CurrentUserProfile) {
  if (!current.empresaId) return [];
  const client = await getLavaClient();
  const { data, error } = await client
    .from("lava_storage_connections")
    .select("id,provider,status,account_email,root_folder_path,last_error,last_test_at,created_at,updated_at")
    .eq("empresa_id", current.empresaId)
    .order("provider", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Row[];
}

export async function getLavaStorageOverview(current: CurrentUserProfile, origin = "") {
  if (!current.empresaId) {
    return { connections: [], pendingCount: 0, errorCount: 0, oauth: getLavaOAuthDisplayConfigs(origin) };
  }

  const client = await getLavaClient();
  const [connectionsResult, pendingResult, errorResult, lastErrorsResult] = await Promise.all([
    client
      .from("lava_storage_connections")
      .select("id,provider,status,account_email,root_folder_path,last_error,last_test_at,created_at,updated_at")
      .eq("empresa_id", current.empresaId)
      .order("provider", { ascending: true }),
    client
      .from("lava_file_sync")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", current.empresaId)
      .eq("status", "pendente"),
    client
      .from("lava_file_sync")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", current.empresaId)
      .eq("status", "erro"),
    client
      .from("lava_file_sync")
      .select("provider,erro,last_attempt_at,updated_at")
      .eq("empresa_id", current.empresaId)
      .eq("status", "erro")
      .order("last_attempt_at", { ascending: false, nullsFirst: false })
      .limit(20)
  ]);

  if (connectionsResult.error) throw connectionsResult.error;
  return {
    connections: (connectionsResult.data ?? []) as Row[],
    pendingCount: pendingResult.count ?? 0,
    errorCount: errorResult.count ?? 0,
    lastSyncErrors: latestErrorByProvider((lastErrorsResult.data ?? []) as Row[]),
    oauth: getLavaOAuthDisplayConfigs(origin)
  };
}

export async function disconnectLavaStorage(current: CurrentUserProfile, provider?: LavaStorageProvider) {
  if (!current.empresaId) return;
  const client = await getLavaClient();
  let query = client
    .from("lava_storage_connections")
    .update({
      status: "nao_conectado",
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      last_error: null,
      last_test_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("empresa_id", current.empresaId);

  if (provider) query = query.eq("provider", provider);
  await query;
}

export async function testLavaStorageConnection(current: CurrentUserProfile, requestedProvider?: LavaStorageProvider) {
  const providers = requestedProvider ? [requestedProvider] : STORAGE_PROVIDERS;

  for (const provider of providers) {
    const connection = await getConnectedLavaStorage(current, provider);
    if (!connection) continue;
    try {
      const accessToken = await getFreshAccessToken(provider, connection);

      if (provider === "google_drive") {
        const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
          headers: { authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error(await responseErrorMessage(response, "Google Drive"));
        await markStorageConnectionOk(connection);
        return provider;
      }

      const response = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) throw new Error(await responseErrorMessage(response, "Dropbox"));
      await markStorageConnectionOk(connection);
      return provider;
    } catch (error) {
      const message = providerGuidance(provider, errorMessage(error));
      await markStorageConnectionError(connection, provider, message);
      throw new Error(message);
    }
  }

  throw new Error("Nenhum armazenamento conectado.");
}

export async function ensurePendingSyncRowsForPhoto(current: CurrentUserProfile, foto: Row) {
  if (!current.empresaId) return { created: 0, skipped: 0, connected: 0 };
  const client = await getLavaClient();
  const connections = await getConnectedLavaStorages(current);
  if (connections.length === 0) return { created: 0, skipped: 0, connected: 0 };

  const fotoId = String(foto.id ?? "");
  const storagePath = String(foto.storage_path ?? "");
  if (!fotoId || !storagePath) return { created: 0, skipped: connections.length, connected: connections.length };

  let created = 0;
  let skipped = 0;
  for (const connection of connections) {
    const provider = String(connection.provider) as LavaStorageProvider;
    const existing = await getSyncRow(client, fotoId, provider, current.empresaId);
    if (existing?.status === "sincronizado") {
      skipped += 1;
      continue;
    }

    const result = await client.from("lava_file_sync").upsert({
      empresa_id: current.empresaId,
      lavagem_id: text(foto.lavagem_id) || null,
      checklist_id: text(foto.checklist_id) || null,
      foto_id: fotoId,
      provider,
      status: "pendente",
      local_storage_path: storagePath,
      erro: null,
      last_attempt_at: null,
      synced_at: null,
      updated_at: new Date().toISOString()
    }, { onConflict: "foto_id,provider" });

    if (!result.error) created += 1;
  }

  return { created, skipped, connected: connections.length };
}

export async function syncLavaPhotoToExternalStorage(params: {
  current: CurrentUserProfile;
  foto: Row;
  lavagem?: Row | null;
  bytes?: Buffer;
  mimeType?: string;
  fileName?: string;
  provider?: LavaStorageProvider;
}) {
  if (!params.current.empresaId) return { connected: 0, synced: 0, failed: 0, skipped: 0 };
  const client = await getLavaClient();
  const allConnections = await getConnectedLavaStorages(params.current);
  const connections = params.provider
    ? allConnections.filter((connection) => connection.provider === params.provider)
    : allConnections;
  if (connections.length === 0) return { connected: 0, synced: 0, failed: 0, skipped: 0 };

  const fotoId = String(params.foto.id ?? "");
  const lavagemId = String(params.foto.lavagem_id ?? params.lavagem?.id ?? "");
  const checklistId = String(params.foto.checklist_id ?? "");
  const storagePath = String(params.foto.storage_path ?? "");
  if (!fotoId || !storagePath) return { connected: connections.length, synced: 0, failed: 0, skipped: connections.length };

  const lavagem = params.lavagem ?? await getLavagemForPhoto(client, params.current.empresaId, lavagemId);
  const empresa = await getEmpresa(client, params.current.empresaId);
  const folderPath = montarPastaFoto({
    empresaNome: empresaName(empresa),
    lavagem,
    foto: params.foto
  });
  const fileName = params.fileName ?? externalFileName(params.foto, storagePath);
  const bytes = params.bytes ?? await downloadLocalPhoto(client, storagePath);
  const mimeType = params.mimeType || mimeTypeFromPath(storagePath);
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const connection of connections) {
    const provider = String(connection.provider) as LavaStorageProvider;
    const existing = await getSyncRow(client, fotoId, provider, params.current.empresaId);
    if (existing?.status === "sincronizado" && (existing.remote_file_id || existing.remote_path)) {
      skipped += 1;
      continue;
    }

    try {
      await markSyncAttempt(client, {
        empresaId: params.current.empresaId,
        lavagemId,
        checklistId,
        fotoId,
        provider,
        storagePath,
        attempt: Number(existing?.tentativas ?? 0) + 1
      });
      if (existing?.status === "erro") {
        await insertStorageHistory(client, params.current, lavagemId, "backup_retentativa", lavaStorageProviderLabel(provider));
      }
      const accessToken = await getFreshAccessToken(provider, connection);
      const result = provider === "google_drive"
        ? await uploadGoogleDrive({ accessToken, fileName, mimeType, bytes, folderPath })
        : await uploadDropbox({ accessToken, fileName, bytes, folderPath });

      await upsertSyncResult(client, {
        empresaId: params.current.empresaId,
        lavagemId,
        checklistId,
        fotoId,
        provider,
        storagePath,
        status: "sincronizado",
        remoteFileId: result.fileId,
        remoteFolderId: result.folderId,
        remotePath: result.path,
        remoteUrl: result.url,
        erro: null
      });
      await markStorageConnectionOk(connection);
      await insertStorageHistory(client, params.current, lavagemId, provider === "google_drive" ? "backup_sincronizado_drive" : "backup_sincronizado_dropbox", result.path);
      synced += 1;
    } catch (error) {
      failed += 1;
      const message = providerGuidance(provider, errorMessage(error));
      await markStorageConnectionError(connection, provider, message);
      await upsertSyncResult(client, {
        empresaId: params.current.empresaId,
        lavagemId,
        checklistId,
        fotoId,
        provider,
        storagePath,
        status: "erro",
        remoteFileId: null,
        remoteFolderId: null,
        remotePath: null,
        remoteUrl: null,
        erro: message
      });
      await insertStorageHistory(client, params.current, lavagemId, provider === "google_drive" ? "backup_erro_drive" : "backup_erro_dropbox", message);
    }
  }

  return { connected: connections.length, synced, failed, skipped };
}

export async function syncPendingLavaPhotos(current: CurrentUserProfile, options: string | {
  lavagemId?: string;
  fotoId?: string;
  provider?: LavaStorageProvider;
} = {}) {
  if (!current.empresaId) return { connected: 0, synced: 0, failed: 0, skipped: 0, photos: 0 };
  const client = await getLavaClient();
  const connections = await getConnectedLavaStorages(current);
  if (connections.length === 0) return { connected: 0, synced: 0, failed: 0, skipped: 0, photos: 0 };
  const normalized = typeof options === "string" ? { lavagemId: options } : options;
  await ensurePendingRowsForRecentPhotos(client, current, normalized);

  let syncQuery = client
    .from("lava_file_sync")
    .select("id,foto_id,provider,status")
    .eq("empresa_id", current.empresaId)
    .in("status", ["pendente", "erro"])
    .order("last_attempt_at", { ascending: true, nullsFirst: true })
    .limit(80);

  if (normalized.lavagemId) syncQuery = syncQuery.eq("lavagem_id", normalized.lavagemId);
  if (normalized.fotoId) syncQuery = syncQuery.eq("foto_id", normalized.fotoId);
  if (normalized.provider) syncQuery = syncQuery.eq("provider", normalized.provider);

  const { data: syncRows, error } = await syncQuery;
  if (error) throw error;
  const rows = (syncRows ?? []) as Row[];
  const fotoIds = Array.from(new Set(rows.map((row) => String(row.foto_id ?? "")).filter(Boolean)));
  const { data: fotosData, error: fotosError } = fotoIds.length
    ? await client
        .from("lava_checklist_fotos")
        .select("id,empresa_id,checklist_id,lavagem_id,tipo,momento,storage_path,legenda,created_at")
        .eq("empresa_id", current.empresaId)
        .in("id", fotoIds)
    : { data: [], error: null };
  if (fotosError) throw fotosError;

  const fotosById = new Map(((fotosData ?? []) as Row[]).map((foto) => [String(foto.id), foto]));
  const totals = { connected: connections.length, synced: 0, failed: 0, skipped: 0, photos: fotoIds.length };
  for (const row of rows) {
    const foto = fotosById.get(String(row.foto_id ?? ""));
    const provider = String(row.provider ?? "") as LavaStorageProvider;
    if (!foto || !isLavaStorageProvider(provider)) {
      totals.skipped += 1;
      continue;
    }
    const result = await syncLavaPhotoToExternalStorage({ current, foto, provider });
    totals.synced += result.synced;
    totals.failed += result.failed;
    totals.skipped += result.skipped;
  }
  return totals;
}

export function montarPastaRaizEmpresa(nomeEmpresa: string) {
  return `/MBA Labs/LavaGestor/${safeFolderName(nomeEmpresa || "Empresa")}`;
}

async function ensurePendingRowsForRecentPhotos(client: any, current: CurrentUserProfile, options: {
  lavagemId?: string;
  fotoId?: string;
  provider?: LavaStorageProvider;
}) {
  if (!current.empresaId) return;
  let query = client
    .from("lava_checklist_fotos")
    .select("id,empresa_id,checklist_id,lavagem_id,tipo,momento,storage_path,legenda,created_at")
    .eq("empresa_id", current.empresaId)
    .order("created_at", { ascending: false })
    .limit(options.fotoId ? 1 : 80);

  if (options.lavagemId) query = query.eq("lavagem_id", options.lavagemId);
  if (options.fotoId) query = query.eq("id", options.fotoId);

  const { data } = await query;
  for (const foto of (data ?? []) as Row[]) {
    await ensurePendingSyncRowsForPhoto(current, foto);
  }
}

function montarPastaFoto({ empresaNome, lavagem, foto }: { empresaNome: string; lavagem: Row | null; foto: Row }) {
  const date = new Date(String(lavagem?.data_entrada ?? lavagem?.data_lavagem ?? foto.created_at ?? Date.now()));
  const yearMonth = Number.isFinite(date.getTime())
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : "sem-data";
  const cliente = safeFolderName(relationName(lavagem?.lava_clientes) || "Cliente");
  const veiculo = safeFolderName(vehicleLabel(lavagem?.lava_veiculos) || "Veículo");
  const lavagemId = String(lavagem?.id ?? foto.lavagem_id ?? "").slice(0, 8).toUpperCase() || "Lavagem";
  const momento = String(foto.momento ?? "entrada") === "checkout" ? "Checkout - Depois" : "Entrada - Antes";
  return `${montarPastaRaizEmpresa(empresaNome)}/Lavagens/${yearMonth}/${cliente}/${veiculo}/${lavagemId}/${momento}`;
}

async function getConnectedLavaStorages(current: CurrentUserProfile) {
  if (!current.empresaId) return [];
  const client = await getLavaClient();
  const { data } = await client
    .from("lava_storage_connections")
    .select("*")
    .eq("empresa_id", current.empresaId)
    .in("status", SYNCABLE_CONNECTION_STATUSES as unknown as string[])
    .in("provider", STORAGE_PROVIDERS as unknown as string[]);
  return (data ?? []) as Row[];
}

async function getConnectedLavaStorage(current: CurrentUserProfile, provider: LavaStorageProvider) {
  if (!current.empresaId) return null;
  const client = await getLavaClient();
  const { data, error } = await client
    .from("lava_storage_connections")
    .select("*")
    .eq("empresa_id", current.empresaId)
    .eq("provider", provider)
    .in("status", SYNCABLE_CONNECTION_STATUSES as unknown as string[])
    .maybeSingle();
  if (error || !data) return null;
  return data as Row;
}

async function getLavaClient() {
  return (await getSupabaseServer()) as any;
}

async function getEmpresa(client: any, empresaId: string) {
  const { data } = await client
    .from("core_empresas")
    .select("id,nome,nome_fantasia,razao_social")
    .eq("id", empresaId)
    .maybeSingle();
  return (data ?? {}) as Row;
}

async function getLavagemForPhoto(client: any, empresaId: string, lavagemId: string) {
  if (!lavagemId) return null;
  const { data } = await client
    .from("lava_lavagens")
    .select("id,cliente_id,veiculo_id,data_entrada,data_lavagem,lava_clientes(nome),lava_veiculos(placa,marca,modelo,cor,tipo)")
    .eq("empresa_id", empresaId)
    .eq("id", lavagemId)
    .maybeSingle();
  return (data ?? null) as Row | null;
}

async function downloadLocalPhoto(client: any, storagePath: string) {
  const { data, error } = await client.storage.from(LAVA_CHECKLIST_BUCKET).download(storagePath);
  if (error || !data) throw new Error(error?.message ?? "Não foi possível baixar a foto local.");
  return Buffer.from(await data.arrayBuffer());
}

async function getSyncRow(client: any, fotoId: string, provider: LavaStorageProvider, empresaId: string) {
  const { data } = await client
    .from("lava_file_sync")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("foto_id", fotoId)
    .eq("provider", provider)
    .maybeSingle();
  return (data ?? null) as Row | null;
}

async function markSyncAttempt(client: any, params: {
  empresaId: string;
  lavagemId: string;
  checklistId: string;
  fotoId: string;
  provider: LavaStorageProvider;
  storagePath: string;
  attempt: number;
}) {
  await client.from("lava_file_sync").upsert({
    empresa_id: params.empresaId,
    lavagem_id: params.lavagemId || null,
    checklist_id: params.checklistId || null,
    foto_id: params.fotoId,
    provider: params.provider,
    status: "pendente",
    local_storage_path: params.storagePath,
    erro: null,
    tentativas: params.attempt,
    last_attempt_at: new Date().toISOString()
  }, { onConflict: "foto_id,provider" });
}

async function upsertSyncResult(client: any, params: {
  empresaId: string;
  lavagemId: string;
  checklistId: string;
  fotoId: string;
  provider: LavaStorageProvider;
  storagePath: string;
  status: "sincronizado" | "erro";
  remoteFileId: string | null;
  remoteFolderId: string | null | undefined;
  remotePath: string | null;
  remoteUrl: string | null | undefined;
  erro: string | null;
}) {
  await client.from("lava_file_sync").upsert({
    empresa_id: params.empresaId,
    lavagem_id: params.lavagemId || null,
    checklist_id: params.checklistId || null,
    foto_id: params.fotoId,
    provider: params.provider,
    status: params.status,
    local_storage_path: params.storagePath,
    remote_file_id: params.remoteFileId,
    remote_folder_id: params.remoteFolderId ?? null,
    remote_path: params.remotePath,
    remote_url: params.remoteUrl ?? null,
    erro: params.erro,
    last_attempt_at: new Date().toISOString(),
    synced_at: params.status === "sincronizado" ? new Date().toISOString() : null
  }, { onConflict: "foto_id,provider" });
}

async function insertStorageHistory(client: any, current: CurrentUserProfile, lavagemId: string, acao: string, observacao: string) {
  if (!lavagemId) return;
  await client.from("lava_historico").insert({
    empresa_id: current.empresaId,
    lavagem_id: lavagemId,
    usuario_id: current.usuario.id,
    acao,
    status_anterior: null,
    status_novo: null,
    observacao
  });
}

async function getFreshAccessToken(provider: LavaStorageProvider, connection: Row) {
  const encrypted = text(connection.access_token_encrypted);
  const refreshToken = text(connection.refresh_token_encrypted) ? decrypt(text(connection.refresh_token_encrypted)) : "";
  const expiresAtValue = text(connection.token_expires_at);
  const expiresAtDate = expiresAtValue ? new Date(expiresAtValue) : null;

  if (encrypted && (!expiresAtDate || expiresAtDate.getTime() - Date.now() > 60_000)) {
    return decrypt(encrypted);
  }

  if (!refreshToken) {
    const message = `${lavaStorageProviderLabel(provider)} precisa ser reconectado. Token expirado ou sem refresh token.`;
    await markStorageConnectionError(connection, provider, message);
    throw new Error(message);
  }

  if (provider === "google_drive") {
    const config = getProviderOAuthConfig(provider, "");
    if (!config.clientId || !config.clientSecret) throw new Error("Configure LAVAGESTOR_GOOGLE_CLIENT_ID/SECRET ou GOOGLE_CLIENT_ID/SECRET.");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });
    const payload = await readJsonResponse(response, "Google Drive");
    await updateToken(connection, String(payload.access_token ?? ""), payload.expires_in);
    return String(payload.access_token);
  }

  const config = getProviderOAuthConfig(provider, "");
  if (!config.clientId || !config.clientSecret) throw new Error("Configure LAVAGESTOR_DROPBOX_APP_KEY/SECRET ou DROPBOX_APP_KEY/SECRET.");
  const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const payload = await readJsonResponse(response, "Dropbox");
  await updateToken(connection, String(payload.access_token ?? ""), payload.expires_in);
  return String(payload.access_token);
}

async function updateToken(connection: Row, accessToken: string, expiresIn: unknown) {
  const client = await getLavaClient();
  await client
    .from("lava_storage_connections")
    .update({
      access_token_encrypted: encrypt(accessToken),
      token_expires_at: expiresAt(expiresIn),
      updated_at: new Date().toISOString()
    })
    .eq("id", connection.id);
}

async function uploadGoogleDrive(params: {
  accessToken: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  folderPath: string;
}): Promise<LavaStorageUploadResult> {
  const folderId = await ensureGoogleFolderPath(params.accessToken, params.folderPath);
  const boundary = `lavagestor-${crypto.randomUUID()}`;
  const metadata = {
    name: params.fileName,
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
  const payload = await readJsonResponse(response, "Google Drive");
  return {
    fileId: String(payload.id ?? ""),
    folderId,
    path: `${params.folderPath}/${params.fileName}`,
    url: String(payload.webViewLink ?? "")
  };
}

async function uploadDropbox(params: {
  accessToken: string;
  fileName: string;
  bytes: Buffer;
  folderPath: string;
}): Promise<LavaStorageUploadResult> {
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
        strict_conflict: false
      })
    },
    body: toArrayBuffer(params.bytes)
  });
  const payload = await readJsonResponse(response, "Dropbox");
  return {
    fileId: String(payload.id ?? ""),
    path: String(payload.path_display ?? path)
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
  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  const payload = await readJsonResponse(response, "Google Drive");
  const files = Array.isArray(payload.files) ? payload.files as Row[] : [];
  return String(files[0]?.id ?? "");
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
  const payload = await readJsonResponse(response, "Google Drive");
  return String(payload.id ?? "");
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
      "content-type": "application/json"
    },
    body: JSON.stringify({ path, autorename: false })
  });
  if (response.ok) return;
  const rawText = await response.text().catch(() => "");
  const payload = parseJson(rawText);
  const summary = String(payload.error_summary ?? "");
  const error = payload.error && typeof payload.error === "object" ? payload.error as Row : {};
  const pathError = error.path && typeof error.path === "object" ? error.path as Row : {};
  const tag = String(pathError[".tag"] ?? "");
  if (response.status === 409 && (summary.includes("conflict/folder") || tag === "conflict")) return;
  throw new Error(`${responseErrorMessageFromPayload(response, "Dropbox", payload, rawText)} (pasta: ${path})`);
}

function normalizeDropboxPath(path: string) {
  const clean = path.split("/").map((part) => part.trim()).filter(Boolean).join("/");
  return `/${clean}`;
}

async function readJsonResponse(response: Response, providerLabel: string) {
  const text = await response.text().catch(() => "");
  const payload = parseJson(text);
  if (!response.ok) {
    throw new Error(responseErrorMessageFromPayload(response, providerLabel, payload, text));
  }
  return payload;
}

export async function responseErrorMessage(response: Response, providerLabel: string) {
  const text = await response.text().catch(() => "");
  return responseErrorMessageFromPayload(response, providerLabel, parseJson(text), text);
}

function responseErrorMessageFromPayload(response: Response, providerLabel: string, payload: Row, rawText = "") {
  const detail = providerDetailMessage(providerLabel, payload, rawText || JSON.stringify(payload));
  return `${providerLabel} erro ${response.status}: ${sanitizeProviderError(detail || response.statusText)}`;
}

function providerDetailMessage(providerLabel: string, payload: Row, rawText: string) {
  const nestedError = payload.error;
  if (providerLabel === "Dropbox") {
    const summary = text(payload.error_summary);
    const requiredScope = nestedError && typeof nestedError === "object" ? text((nestedError as Row).required_scope) : "";
    if (summary.includes("missing_scope") || requiredScope) {
      return `missing_scope ${requiredScope || summary.replace(/^missing_scope\/?/, "").replace(/\/.*$/, "")}. Reconecte o Dropbox para atualizar permissões.`;
    }
    if (summary) return summary;
  }

  if (text(payload.error_description)) return text(payload.error_description);
  if (nestedError && typeof nestedError === "object" && text((nestedError as Row).message)) return text((nestedError as Row).message);
  if (text(nestedError)) return text(nestedError);
  if (text(payload.message)) return text(payload.message);
  return rawText;
}

function sanitizeProviderError(value: string) {
  return value
    .replace(/(access_token|refresh_token|client_secret|authorization)["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "$1: [removido]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [removido]")
    .slice(0, 700)
    .trim();
}

function parseJson(textValue: string): Row {
  if (!textValue) return {};
  try {
    const parsed = JSON.parse(textValue);
    return parsed && typeof parsed === "object" ? parsed as Row : { message: String(parsed) };
  } catch {
    return { message: textValue };
  }
}

async function markStorageConnectionOk(connection: Row) {
  const client = await getLavaClient();
  await client
    .from("lava_storage_connections")
    .update({
      status: "conectado",
      last_error: null,
      last_test_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", connection.id);
}

async function markStorageConnectionError(connection: Row, provider: LavaStorageProvider, message: string) {
  const client = await getLavaClient();
  await client
    .from("lava_storage_connections")
    .update({
      status: "erro",
      last_error: providerGuidance(provider, message),
      last_test_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", connection.id);
}

function providerGuidance(provider: LavaStorageProvider, message: string) {
  const lower = message.toLowerCase();
  if (provider === "google_drive" && (lower.includes("has not been used") || lower.includes("disabled") || lower.includes("drive api"))) {
    return `${message} Ative a Google Drive API no projeto Google Cloud usado por este Client ID.`;
  }
  if (provider === "dropbox" && lower.includes("missing_scope")) {
    return `${message} Ative as permissões no Dropbox App Console e reconecte o Dropbox.`;
  }
  if (lower.includes("invalid_grant") || lower.includes("invalid credentials") || lower.includes("refresh token")) {
    return `${lavaStorageProviderLabel(provider)} precisa ser reconectado. Token expirado ou sem refresh token.`;
  }
  return message;
}

function latestErrorByProvider(rows: Row[]) {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const provider = text(row.provider);
    if (provider && !map.has(provider)) map.set(provider, row);
  }
  return Array.from(map.entries()).map(([provider, row]) => ({
    provider,
    erro: row.erro,
    last_attempt_at: row.last_attempt_at ?? row.updated_at
  }));
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
  const secret = process.env.LAVAGESTOR_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Configure LAVAGESTOR_TOKEN_SECRET para criptografar tokens.");
  return crypto.createHash("sha256").update(secret).digest();
}

function expiresAt(expiresIn: unknown) {
  const seconds = Number(expiresIn ?? 3600);
  return new Date(Date.now() + Math.max(seconds - 60, 60) * 1000).toISOString();
}

function externalFileName(foto: Row, storagePath: string) {
  const original = storagePath.split("/").pop() || "foto.jpg";
  const extension = original.includes(".") ? `.${original.split(".").pop()}` : ".jpg";
  const momento = String(foto.momento ?? "entrada") === "checkout" ? "checkout" : "entrada";
  const tipo = safeFileName(String(foto.tipo ?? "foto")).toLowerCase().replace(/\s+/g, "-");
  const date = new Date(String(foto.created_at ?? Date.now()));
  const prefix = Number.isFinite(date.getTime())
    ? `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`
    : "foto";
  return safeFileName(`${prefix}-${momento}-${tipo}-${String(foto.id ?? "").slice(0, 8)}${extension}`);
}

function mimeTypeFromPath(path: string) {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return "image/jpeg";
}

function safeFolderName(value: string) {
  const clean = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return clean || "Sem nome";
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "foto";
}

function empresaName(row: Row) {
  return String(row.nome_fantasia ?? row.nome ?? row.razao_social ?? "Empresa");
}

function relationName(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) return String((relation as { nome?: unknown }).nome ?? "");
  return "";
}

function vehicleLabel(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") return "";
  const row = relation as { placa?: unknown; marca?: unknown; modelo?: unknown; cor?: unknown; tipo?: unknown };
  const model = [row.marca, row.modelo].filter(Boolean).join(" ");
  return [row.placa, model, row.cor].filter(Boolean).join(" - ") || String(row.tipo ?? "Veículo");
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido.";
}
