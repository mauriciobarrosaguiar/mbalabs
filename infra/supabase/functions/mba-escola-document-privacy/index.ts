import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "mba-escola-documentos";
const DEFAULT_ORPHAN_GRACE_HOURS = 24;
const ALLOWED_ORIGINS = new Set([
  "https://mbalabs.com.br",
  "https://www.mbalabs.com.br",
  "https://mbalabs.vercel.app",
]);

const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

type DocumentRow = {
  id: string;
  escola_id: string;
  storage_path: string;
  nome_arquivo: string;
  criado_em: string;
  excluido_em: string | null;
};

type StoredFile = { path: string; createdAt: string | null };

function headers(origin: string | null) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    ...(origin && ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  };
}

function reply(origin: string | null, status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), { status, headers: headers(origin) });
}

function decodePayload(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1];
    if (!part) return {};
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    return JSON.parse(atob(normalized));
  } catch {
    return {};
  }
}

async function requireAdminMfa(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Response("unauthorized", { status: 401 });

  const { data, error } = await service.auth.getUser(token);
  if (error || !data.user) throw new Response("unauthorized", { status: 401 });

  const payload = decodePayload(token);
  if (payload.aal !== "aal2") throw new Response("mfa_required", { status: 403 });

  const { data: admin, error: adminError } = await service
    .from("escola_super_admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .eq("ativo", true)
    .maybeSingle();

  if (adminError || !admin) throw new Response("forbidden", { status: 403 });
  return data.user;
}

async function listAll(prefix = "", depth = 0, acc: StoredFile[] = []): Promise<StoredFile[]> {
  if (depth > 8 || acc.length > 20000) return acc;
  let offset = 0;
  while (true) {
    const { data, error } = await service.storage.from(BUCKET).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const rows = data ?? [];
    for (const item of rows) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) acc.push({ path, createdAt: item.created_at ?? null });
      else await listAll(path, depth + 1, acc);
    }
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return acc;
}

async function loadDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await service
    .from("escola_justificativa_arquivos")
    .select("id,escola_id,storage_path,nome_arquivo,criado_em,excluido_em")
    .limit(20000);
  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

async function privacyStatus() {
  const [documents, files] = await Promise.all([loadDocuments(), listAll()]);
  const storagePaths = new Set(files.map((item) => item.path));
  const metadataPaths = new Set(documents.map((item) => item.storage_path));
  return {
    metadataAtivos: documents.filter((item) => !item.excluido_em).length,
    metadataExcluidos: documents.filter((item) => Boolean(item.excluido_em)).length,
    storageTotal: files.length,
    storageOrfaos: files.filter((item) => !metadataPaths.has(item.path)).length,
    metadataSemArquivo: documents.filter((item) => !item.excluido_em && !storagePaths.has(item.storage_path)).length,
    exclusoesPendentesStorage: documents.filter((item) => item.excluido_em && storagePaths.has(item.storage_path)).length,
  };
}

async function audit(userId: string, doc: DocumentRow, action: string, details: Record<string, unknown>) {
  await service.from("escola_auditoria").insert({
    escola_id: doc.escola_id,
    ator_id: userId,
    ator_tipo: "admin_mba",
    acao: action,
    recurso: "escola_justificativa_arquivos",
    recurso_id: doc.id,
    detalhes: details,
  });
}

async function secureDelete(doc: DocumentRow, userId: string, reason: string) {
  const deletedAt = doc.excluido_em ?? new Date().toISOString();
  if (!doc.excluido_em) {
    const { error: markError } = await service
      .from("escola_justificativa_arquivos")
      .update({ excluido_em: deletedAt, excluido_por: userId, motivo_exclusao: reason })
      .eq("id", doc.id)
      .is("excluido_em", null);
    if (markError) throw markError;
  }

  const { error: removeError } = await service.storage.from(BUCKET).remove([doc.storage_path]);
  if (removeError) {
    await audit(userId, doc, "documento_exclusao_storage_pendente", { motivo: reason });
    throw removeError;
  }

  await audit(userId, doc, "documento_excluido_seguro", { motivo: reason, nome_arquivo: doc.nome_arquivo });
  return { id: doc.id, storagePath: doc.storage_path, excluidoEm: deletedAt };
}

async function cleanupOrphans(userId: string) {
  const [documents, files, policiesResult] = await Promise.all([
    loadDocuments(),
    listAll(),
    service.from("escola_documento_politicas").select("escola_id,orfao_grace_horas"),
  ]);
  if (policiesResult.error) throw policiesResult.error;

  const metadataPaths = new Set(documents.map((item) => item.storage_path));
  const graceBySchool = new Map<string, number>((policiesResult.data ?? []).map((p) => [p.escola_id, p.orfao_grace_horas]));
  const now = Date.now();
  const removed: string[] = [];

  for (const file of files) {
    if (metadataPaths.has(file.path)) continue;
    const schoolId = file.path.split("/")[0] ?? "";
    const graceHours = graceBySchool.get(schoolId) ?? DEFAULT_ORPHAN_GRACE_HOURS;
    const createdAt = file.createdAt ? Date.parse(file.createdAt) : now;
    if (Number.isFinite(createdAt) && now - createdAt < graceHours * 3600000) continue;
    const { error } = await service.storage.from(BUCKET).remove([file.path]);
    if (!error) removed.push(file.path);
  }

  if (removed.length) {
    await service.from("escola_auditoria").insert({
      ator_id: userId,
      ator_tipo: "admin_mba",
      acao: "documentos_orfaos_removidos",
      recurso: "mba-escola-documentos",
      detalhes: { quantidade: removed.length },
    });
  }
  return { removidos: removed.length };
}

async function cleanupRetention(userId: string, dryRun: boolean) {
  const { data: policies, error: policiesError } = await service
    .from("escola_documento_politicas")
    .select("escola_id,retencao_dias")
    .eq("exclusao_automatica", true)
    .not("retencao_dias", "is", null);
  if (policiesError) throw policiesError;

  const candidates: DocumentRow[] = [];
  for (const policy of policies ?? []) {
    const cutoff = new Date(Date.now() - Number(policy.retencao_dias) * 86400000).toISOString();
    const { data, error } = await service
      .from("escola_justificativa_arquivos")
      .select("id,escola_id,storage_path,nome_arquivo,criado_em,excluido_em")
      .eq("escola_id", policy.escola_id)
      .is("excluido_em", null)
      .lt("criado_em", cutoff)
      .limit(1000);
    if (error) throw error;
    candidates.push(...((data ?? []) as DocumentRow[]));
  }

  if (dryRun) return { candidatos: candidates.length, removidos: 0, dryRun: true };
  let removed = 0;
  for (const doc of candidates) {
    await secureDelete(doc, userId, "Retenção automática configurada pela instituição");
    removed += 1;
  }
  return { candidatos: candidates.length, removidos: removed, dryRun: false };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return reply(origin, 403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (req.method !== "POST") return reply(origin, 405, { error: "method_not_allowed" });

  try {
    const user = await requireAdminMfa(req);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "status");

    if (action === "status") return reply(origin, 200, { ok: true, ...(await privacyStatus()) });
    if (action === "cleanup_orphans") return reply(origin, 200, { ok: true, ...(await cleanupOrphans(user.id)) });
    if (action === "cleanup_retention") return reply(origin, 200, { ok: true, ...(await cleanupRetention(user.id, body.dryRun !== false)) });

    if (action === "delete_document") {
      const documentId = String(body.documentId ?? "");
      const reason = String(body.reason ?? "").trim();
      if (!documentId || reason.length < 5) return reply(origin, 400, { error: "document_id_and_reason_required" });
      const { data: doc, error } = await service
        .from("escola_justificativa_arquivos")
        .select("id,escola_id,storage_path,nome_arquivo,criado_em,excluido_em")
        .eq("id", documentId)
        .maybeSingle();
      if (error) throw error;
      if (!doc) return reply(origin, 404, { error: "document_not_found" });
      return reply(origin, 200, { ok: true, documento: await secureDelete(doc as DocumentRow, user.id, reason) });
    }

    return reply(origin, 400, { error: "unknown_action" });
  } catch (error) {
    if (error instanceof Response) {
      const text = await error.text();
      return reply(origin, error.status, { error: text || "request_denied" });
    }
    console.error(error);
    return reply(origin, 500, { error: error instanceof Error ? error.message : "internal_error" });
  }
});
