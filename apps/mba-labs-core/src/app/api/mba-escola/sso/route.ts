import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";
import type { MbaEscolaSsoSuccess } from "@/lib/mba-escola/sso-contract";

const SCHOOL_URL = "https://ihcfhuxxjllmqypzuzce.supabase.co";
const ALLOWED_SCHOOL_ROLES = new Set(["admin_escola", "direcao", "coordenacao", "professor", "responsavel"]);
const ENABLED_SCHOOL_STATUSES = new Set(["ativa", "teste"]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const current = await requireAppAccess("mba-escola", "/mba-escola");
  const email = current.authUser.email?.trim().toLowerCase();

  if (current.usuario.status !== "ativo") {
    return response({ code: "MBA_ESCOLA_CORE_USER_INACTIVE", error: "Seu usuário da MBA Labs não está ativo." }, 403);
  }

  if (!email) {
    return response({ error: "Seu usuário da MBA Labs não possui e-mail válido para o MBA Escola." }, 400);
  }

  const adminKey =
    process.env.MBA_ESCOLA_SUPABASE_SECRET_KEY ||
    process.env.MBA_ESCOLA_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ESCOLA_SERVICE_ROLE_KEY;

  if (!adminKey) {
    return requestSchoolEdgeSso();
  }

  const admin = createClient(SCHOOL_URL, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  try {
    const schoolUser = current.isAdminMaster
      ? await ensureOwnerUser(admin, email, current.usuario.nome, current.authUser.id)
      : await requireActiveSchoolUser(admin, email);

    const generated = await admin.auth.admin.generateLink({
      type: "magiclink",
      email
    });

    if (generated.error) {
      return serverError("MBA_ESCOLA_LINK_FAILED", generated.error);
    }

    const tokenHash = generated.data.properties?.hashed_token;
    if (!tokenHash) {
      return serverError("MBA_ESCOLA_TOKEN_MISSING", new Error("generateLink não retornou hashed_token"));
    }

    const payload = { tokenHash, schoolUserId: schoolUser.id } satisfies MbaEscolaSsoSuccess;
    return response(payload, 200);
  } catch (error) {
    if (error instanceof SsoAccessError) {
      return response({ code: error.code, error: error.message }, error.status);
    }

    return serverError("MBA_ESCOLA_SSO_FAILED", error);
  }
}

async function requestSchoolEdgeSso() {
  const coreSupabase = await getSupabaseServer();
  const { data, error } = await coreSupabase.auth.getSession();
  const accessToken = data.session?.access_token;

  if (error || !accessToken) {
    return response({ code: "MBA_ESCOLA_CORE_SESSION_MISSING", error: "Sua sessão da MBA Labs expirou. Entre novamente." }, 401);
  }

  try {
    const edgeResponse = await fetch(`${SCHOOL_URL}/functions/v1/mba-escola-sso`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: "{}",
      cache: "no-store"
    });
    const payload = (await edgeResponse.json().catch(() => ({}))) as Record<string, unknown>;

    if (!edgeResponse.ok) {
      return response(
        {
          code: typeof payload.code === "string" ? payload.code : "MBA_ESCOLA_EDGE_UNAVAILABLE",
          error: typeof payload.error === "string" ? payload.error : "O serviço do MBA Escola está temporariamente indisponível."
        },
        edgeResponse.status >= 400 && edgeResponse.status < 600 ? edgeResponse.status : 503
      );
    }

    if (typeof payload.tokenHash !== "string" || typeof payload.schoolUserId !== "string") {
      return serverError("MBA_ESCOLA_EDGE_INVALID_RESPONSE", new Error("Resposta incompleta da função escolar"));
    }

    return response({ tokenHash: payload.tokenHash, schoolUserId: payload.schoolUserId }, 200);
  } catch (error) {
    return serverError("MBA_ESCOLA_EDGE_REQUEST_FAILED", error, 503);
  }
}

async function ensureOwnerUser(admin: SupabaseClient, email: string, nome: string, coreUserId: string) {
  let schoolUser = await findUserByEmail(admin, email);

  if (!schoolUser) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nome, origem: "mba-labs-sso" },
      app_metadata: { origem: "mba-labs-sso", core_user_id: coreUserId }
    });

    if (created.error || !created.data.user) {
      throw new Error(created.error?.message || "Não foi possível criar o vínculo do ADMIN MBA.");
    }

    schoolUser = created.data.user;
  }

  const { data: owner, error: ownerError } = await admin
    .from("escola_super_admins")
    .select("user_id,ativo")
    .eq("user_id", schoolUser.id)
    .maybeSingle();

  if (ownerError) throw ownerError;

  const ownerPayload = { nome, email, ativo: true };
  const ownerWrite = owner
    ? await admin.from("escola_super_admins").update(ownerPayload).eq("user_id", schoolUser.id)
    : await admin.from("escola_super_admins").insert({ user_id: schoolUser.id, ...ownerPayload });

  if (ownerWrite.error) throw ownerWrite.error;
  return schoolUser;
}

async function requireActiveSchoolUser(admin: SupabaseClient, email: string) {
  const schoolUser = await findUserByEmail(admin, email);

  if (!schoolUser) {
    throw new SsoAccessError(
      "MBA_ESCOLA_USER_NOT_LINKED",
      "Seu acesso existe na MBA Labs, mas ainda não foi vinculado a uma escola.",
      403
    );
  }

  const { data: profile, error } = await admin
    .from("escola_perfis")
    .select("id,papel,ativo,escola:escola_escolas(status)")
    .eq("id", schoolUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!profile || profile.ativo !== true) {
    throw new SsoAccessError(
      "MBA_ESCOLA_PROFILE_INACTIVE",
      "Seu usuário da MBA Labs ainda não possui um perfil escolar ativo.",
      403
    );
  }

  const role = String(profile.papel ?? "");
  if (!ALLOWED_SCHOOL_ROLES.has(role)) {
    throw new SsoAccessError(
      "MBA_ESCOLA_ROLE_NOT_ALLOWED",
      role === "aluno"
        ? "Aluno não possui login direto. O acompanhamento é feito pelo perfil Responsável."
        : "Seu perfil escolar não possui permissão para entrar no MBA Escola.",
      403
    );
  }

  const school = relationObject(profile.escola);
  const schoolStatus = String(school?.status ?? "");
  if (!ENABLED_SCHOOL_STATUSES.has(schoolStatus)) {
    throw new SsoAccessError(
      "MBA_ESCOLA_SCHOOL_INACTIVE",
      "A escola vinculada ao seu perfil não está ativa.",
      403
    );
  }

  return schoolUser;
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const perPage = 1000;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
  }

  throw new Error("Limite de busca de usuários do MBA Escola excedido.");
}

function relationObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  }

  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

class SsoAccessError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

function serverError(code: string, error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[mba-escola-sso] ${code}: ${message}`);
  return response({ code, error: "Não foi possível criar a sessão automática do MBA Escola." }, status);
}

function response(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Vary: "Cookie"
    }
  });
}
