import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.108.1";

const CORE_URL = "https://jrbkojhnltqfqwpczwuw.supabase.co";
const CORE_PUBLISHABLE_KEY = "sb_publishable_fjnCq7J0sJVlpZ8e6NsiAg_6Jeqr8Ut";
const ALLOWED_SCHOOL_ROLES = new Set(["admin_escola", "direcao", "coordenacao", "professor", "responsavel"]);
const ENABLED_SCHOOL_STATUSES = new Set(["ativa", "teste"]);

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") {
    return json({ code: "METHOD_NOT_ALLOWED", error: "Método não permitido." }, 405);
  }

  const accessToken = bearerToken(request.headers.get("Authorization"));
  if (!accessToken) {
    return json({ code: "CORE_TOKEN_MISSING", error: "Sessão da MBA Labs não informada." }, 401);
  }

  try {
    const core = createClient(CORE_URL, CORE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { data: userResult, error: userError } = await core.auth.getUser(accessToken);

    if (userError || !userResult.user?.email) {
      return json({ code: "CORE_SESSION_INVALID", error: "Sua sessão da MBA Labs expirou. Entre novamente." }, 401);
    }

    const identity = await requireCoreAppAccess(core, userResult.user.id, userResult.user.email);
    const school = createSchoolAdminClient();
    const schoolUser = identity.isAdminMaster
      ? await ensureOwnerUser(school, identity.email, identity.nome, userResult.user.id)
      : await requireActiveSchoolUser(school, identity.email);

    const generated = await school.auth.admin.generateLink({ type: "magiclink", email: identity.email });
    if (generated.error) throw generated.error;

    const tokenHash = generated.data.properties?.hashed_token;
    if (!tokenHash) throw new Error("generateLink não retornou hashed_token");

    return json({ tokenHash, schoolUserId: schoolUser.id }, 200);
  } catch (error) {
    if (error instanceof AccessError) {
      return json({ code: error.code, error: error.message }, error.status);
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mba-escola-edge-sso] INTERNAL_ERROR: ${message}`);
    return json({ code: "MBA_ESCOLA_EDGE_FAILED", error: "Não foi possível criar a sessão automática do MBA Escola." }, 500);
  }
});

async function requireCoreAppAccess(core: SupabaseClient, authUserId: string, authEmail: string) {
  const { data: profile, error: profileError } = await core
    .from("core_usuarios")
    .select("id,nome,email,tipo,tipo_global,status,empresa_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile || profile.status !== "ativo") {
    throw new AccessError("CORE_USER_INACTIVE", "Seu usuário da MBA Labs não está ativo.", 403);
  }

  const email = authEmail.trim().toLowerCase();
  const type = String(profile.tipo_global ?? profile.tipo ?? "");
  const isAdminMaster = type === "super_admin" || type === "admin_master";
  if (isAdminMaster) {
    return { email, nome: String(profile.nome ?? email), isAdminMaster: true };
  }

  if (!profile.empresa_id) {
    throw new AccessError("CORE_COMPANY_MISSING", "Seu usuário não está vinculado a uma empresa ativa.", 403);
  }

  const { data: app, error: appError } = await core
    .from("core_apps")
    .select("id,status,ativo")
    .eq("slug", "mba-escola")
    .maybeSingle();

  if (appError) throw appError;
  if (!app || app.ativo === false || String(app.status ?? "ativo") !== "ativo") {
    throw new AccessError("CORE_APP_INACTIVE", "O MBA Escola não está ativo na MBA Labs.", 403);
  }

  const [companyResult, contractResult, permissionResult] = await Promise.all([
    core.from("core_empresas").select("status").eq("id", profile.empresa_id).maybeSingle(),
    core
      .from("core_empresa_apps")
      .select("status,data_vencimento")
      .eq("empresa_id", profile.empresa_id)
      .eq("app_id", app.id)
      .maybeSingle(),
    core
      .from("core_usuario_app_permissoes")
      .select("status")
      .eq("usuario_id", profile.id)
      .eq("app_id", app.id)
      .maybeSingle()
  ]);

  if (companyResult.error || contractResult.error || permissionResult.error) {
    throw companyResult.error || contractResult.error || permissionResult.error;
  }

  const companyEnabled = ["ativa", "teste"].includes(String(companyResult.data?.status ?? ""));
  const contractEnabled = isContractEnabled(contractResult.data);
  const permissionEnabled = type === "admin_empresa" || permissionResult.data?.status === "ativo";

  if (!companyEnabled || !contractEnabled || !permissionEnabled) {
    throw new AccessError("CORE_APP_ACCESS_DENIED", "Seu usuário não possui acesso ativo ao MBA Escola.", 403);
  }

  return { email, nome: String(profile.nome ?? email), isAdminMaster: false };
}

function isContractEnabled(contract: { status?: unknown; data_vencimento?: unknown } | null) {
  const status = String(contract?.status ?? "").replace("ativa", "ativo");
  if (status !== "ativo" && status !== "teste") return false;
  if (!contract?.data_vencimento) return true;

  const expiration = new Date(String(contract.data_vencimento));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Number.isFinite(expiration.getTime()) && expiration >= today;
}

function createSchoolAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const legacyServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const modernSecrets = Deno.env.get("SUPABASE_SECRET_KEYS");
  const modernSecret = modernSecrets ? (JSON.parse(modernSecrets) as Record<string, string>).default : null;
  const adminKey = modernSecret || legacyServiceRole;

  if (!url || !adminKey) throw new Error("Credencial administrativa padrão do Supabase indisponível");

  return createClient(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
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
    if (created.error || !created.data.user) throw created.error || new Error("Falha ao criar ADMIN MBA");
    schoolUser = created.data.user;
  }

  const { data: owner, error: ownerError } = await admin
    .from("escola_super_admins")
    .select("user_id")
    .eq("user_id", schoolUser.id)
    .maybeSingle();
  if (ownerError) throw ownerError;

  const ownerPayload = { nome, email, ativo: true };
  const write = owner
    ? await admin.from("escola_super_admins").update(ownerPayload).eq("user_id", schoolUser.id)
    : await admin.from("escola_super_admins").insert({ user_id: schoolUser.id, ...ownerPayload });
  if (write.error) throw write.error;

  return schoolUser;
}

async function requireActiveSchoolUser(admin: SupabaseClient, email: string) {
  const schoolUser = await findUserByEmail(admin, email);
  if (!schoolUser) {
    throw new AccessError("SCHOOL_USER_NOT_LINKED", "Seu acesso ainda não foi vinculado a uma escola.", 403);
  }

  const { data: profile, error } = await admin
    .from("escola_perfis")
    .select("id,papel,ativo,escola:escola_escolas(status)")
    .eq("id", schoolUser.id)
    .maybeSingle();
  if (error) throw error;

  if (!profile || profile.ativo !== true) {
    throw new AccessError("SCHOOL_PROFILE_INACTIVE", "Seu perfil escolar não está ativo.", 403);
  }

  const role = String(profile.papel ?? "");
  if (!ALLOWED_SCHOOL_ROLES.has(role)) {
    throw new AccessError(
      "SCHOOL_ROLE_NOT_ALLOWED",
      role === "aluno"
        ? "Aluno não possui login direto. O acompanhamento é feito pelo perfil Responsável."
        : "Seu perfil escolar não possui permissão para entrar.",
      403
    );
  }

  const school = relationObject(profile.escola);
  if (!ENABLED_SCHOOL_STATUSES.has(String(school?.status ?? ""))) {
    throw new AccessError("SCHOOL_INACTIVE", "A escola vinculada ao seu perfil não está ativa.", 403);
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
  throw new Error("Limite de busca de usuários excedido");
}

function bearerToken(header: string | null) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function relationObject(value: unknown): Record<string, unknown> | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}

class AccessError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
  }
}

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache"
    }
  });
}
