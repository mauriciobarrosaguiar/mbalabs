import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, UsuarioTipo } from "../types/database";

export type SharedCoreProfile = {
  id: string;
  nome: string;
  email: string;
  tipo: UsuarioTipo | string;
  status: string;
  empresa_id: string | null;
};

export type SharedEmpresa = {
  id: string;
  nome: string;
  categoria?: string | null;
  categoriaSlug?: string | null;
  status?: string | null;
};

export type SharedPermissao = {
  appSlug: string;
  appNome: string;
  perfil: string;
  podeAcessar: boolean;
  permissoesExtras: string[];
};

export type SharedAppAccess = {
  slug: string;
  nome: string;
  descricao: string | null;
  urlPath: string;
  status: "ativo" | "teste" | "vencido" | "bloqueado" | "cancelado" | "sem_assinatura";
  canAccess: boolean;
};

export type SharedCurrentUserProfile = {
  authUser: User | null;
  usuario: SharedCoreProfile | null;
  empresa: SharedEmpresa | null;
  empresaId: string | null;
  tipo: string | null;
  isAdminMaster: boolean;
  permissoes: SharedPermissao[];
  appsLiberados: SharedAppAccess[];
  error: string | null;
};

export async function getCurrentUserProfileFromSupabase(
  supabase: SupabaseClient<Database>
): Promise<SharedCurrentUserProfile> {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    return emptyProfile(userError.message);
  }

  if (!user) {
    return emptyProfile(null);
  }

  const { data: usuario, error: usuarioError } = await (supabase as any)
    .from("core_usuarios")
    .select(
      "id,nome,email,tipo,tipo_global,status,empresa_id,core_empresas(id,nome,nome_fantasia,status,categoria_id,core_empresa_categorias(nome,slug))"
    )
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (usuarioError) {
    return { ...emptyProfile(usuarioError.message), authUser: user };
  }

  if (!usuario) {
    return { ...emptyProfile(null), authUser: user };
  }

  const [appsResult, permissoesResult, assinaturasResult] = await Promise.all([
    (supabase as any)
      .from("core_apps")
      .select("id,slug,nome,descricao,url_path,url_interna,status,ativo,ordem")
      .order("ordem", { ascending: true }),
    (supabase as any)
      .from("core_usuario_app_permissoes")
      .select("status,perfil_app,permissoes_extras,empresa_id,core_apps(id,slug,nome,url_path,url_interna,descricao,status,ativo)")
      .eq("usuario_id", usuario.id),
    usuario.empresa_id
      ? (supabase as any)
          .from("core_empresa_apps")
          .select("status,data_vencimento,core_apps(id,slug,nome,url_path,url_interna,descricao,status,ativo)")
          .eq("empresa_id", usuario.empresa_id)
      : Promise.resolve({ data: [], error: null })
  ]);

  const apps = ((appsResult.data ?? []) as Array<Record<string, unknown>>).filter(isActiveApp);
  const permissoes = await getUserPermissions(supabase, usuario.id, permissoesResult);
  const contractsBySlug = await getCompanyContracts(supabase, usuario.empresa_id, assinaturasResult);
  const tipo = String(usuario.tipo_global ?? usuario.tipo ?? "usuario");
  const userIsActive = String(usuario.status ?? "ativo") === "ativo";
  const empresa = normalizeEmpresa(usuario.core_empresas);
  const empresaIsActive = isCompanyEnabled(empresa?.status);
  const isAdminMaster = tipo === "super_admin" || tipo === "admin_master";
  const isCompanyAdmin = tipo === "admin_empresa";

  const appsLiberados = apps.map((app) => {
    const slug = String(app.slug ?? "");
    const contract = contractsBySlug.get(slug);
    const hasPermission = permissoes.some((permissao) => permissao.appSlug === slug && permissao.podeAcessar);
    const canAccess =
      isAdminMaster ||
      Boolean(
        userIsActive &&
          empresaIsActive &&
          contract &&
          isContractEnabled(contract) &&
          (isCompanyAdmin || hasPermission)
      );

    return {
      slug,
      nome: String(app.nome ?? slug),
      descricao: typeof app.descricao === "string" ? app.descricao : null,
      urlPath: resolveInternalAppPath(app),
      status: isAdminMaster ? "ativo" : contract?.status ?? "sem_assinatura",
      canAccess
    } satisfies SharedAppAccess;
  });

  return {
    authUser: user,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo,
      status: String(usuario.status ?? "ativo"),
      empresa_id: usuario.empresa_id
    },
    empresa,
    empresaId: usuario.empresa_id,
    tipo,
    isAdminMaster,
    permissoes,
    appsLiberados,
    error: appsResult.error?.message ?? permissoesResult.error?.message ?? assinaturasResult.error?.message ?? null
  };
}

async function getUserPermissions(
  supabase: SupabaseClient<Database>,
  usuarioId: string,
  result: { data?: unknown; error?: { message?: string } | null }
) {
  if (!result.error) {
    return ((result.data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const app = relationObject(row.core_apps);
      return {
        appSlug: String(app?.slug ?? ""),
        appNome: String(app?.nome ?? ""),
        perfil: String(row.perfil_app ?? "usuario"),
        podeAcessar: String(row.status ?? "ativo") === "ativo",
        permissoesExtras: normalizeStringArray(row.permissoes_extras)
      };
    });
  }

  const fallback = await (supabase as any)
    .from("core_permissoes")
    .select("pode_acessar,perfil,core_apps(slug,nome,url_path,descricao,ativo)")
    .eq("usuario_id", usuarioId);

  return ((fallback.data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const app = relationObject(row.core_apps);
    return {
      appSlug: String(app?.slug ?? ""),
      appNome: String(app?.nome ?? ""),
      perfil: String(row.perfil ?? "usuario"),
      podeAcessar: row.pode_acessar !== false,
      permissoesExtras: []
    };
  });
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function getCompanyContracts(
  supabase: SupabaseClient<Database>,
  empresaId: string | null,
  result: { data?: unknown; error?: { message?: string } | null }
) {
  const contracts = new Map<string, { status: SharedAppAccess["status"] }>();

  if (!empresaId) {
    return contracts;
  }

  if (!result.error) {
    for (const contract of (result.data ?? []) as Array<Record<string, unknown>>) {
      const app = relationObject(contract.core_apps);
      const slug = String(app?.slug ?? "");
      if (!slug) continue;
      contracts.set(slug, { status: normalizeContractStatus(contract.status, contract.data_vencimento) });
    }
    return contracts;
  }

  const fallback = await (supabase as any)
    .from("core_assinaturas")
    .select("status,vencimento,core_apps(slug,nome,url_path,descricao,ativo)")
    .eq("empresa_id", empresaId);

  for (const assinatura of (fallback.data ?? []) as Array<Record<string, unknown>>) {
    const app = relationObject(assinatura.core_apps);
    const slug = String(app?.slug ?? "");
    if (!slug) continue;
    contracts.set(slug, { status: normalizeContractStatus(assinatura.status, assinatura.vencimento) });
  }

  return contracts;
}

function normalizeContractStatus(status: unknown, vencimento: unknown): SharedAppAccess["status"] {
  const raw = String(status ?? "");
  const normalized =
    raw === "ativa" ? "ativo" :
    raw === "vencida" ? "vencido" :
    raw === "bloqueada" ? "bloqueado" :
    raw === "cancelada" ? "cancelado" :
    raw;

  if ((normalized === "ativo" || normalized === "teste") && vencimento) {
    const expiration = new Date(String(vencimento));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isFinite(expiration.getTime()) && expiration < today) {
      return "vencido";
    }
  }

  if (normalized === "ativo" || normalized === "teste" || normalized === "vencido" || normalized === "bloqueado" || normalized === "cancelado") {
    return normalized;
  }

  return "bloqueado";
}

function isContractEnabled(contract: { status: SharedAppAccess["status"] }) {
  return contract.status === "ativo" || contract.status === "teste";
}

function isActiveApp(app: Record<string, unknown>) {
  if ("status" in app) {
    return String(app.status ?? "ativo") === "ativo";
  }

  return app.ativo !== false;
}

function isCompanyEnabled(status?: string | null) {
  return status === "ativa" || status === "teste";
}

function resolveInternalAppPath(app: Record<string, unknown>) {
  const slug = normalizeAppSlug(String(app.slug ?? ""));

  if (slug === "mba-cotacoes") {
    return "/apps/mbacotacoes";
  }

  if (slug === "lavagestor") {
    return "/apps/lavagestor";
  }

  if (slug === "bikecomanda") {
    return "/apps/bikecomanda";
  }

  return String(app.url_interna ?? app.url_path ?? `/${slug}`);
}

function normalizeAppSlug(slug: string) {
  if (slug === "mbacotacoes") return "mba-cotacoes";
  if (slug === "bike-comanda") return "bikecomanda";
  return slug;
}

function emptyProfile(error: string | null): SharedCurrentUserProfile {
  return {
    authUser: null,
    usuario: null,
    empresa: null,
    empresaId: null,
    tipo: null,
    isAdminMaster: false,
    permissoes: [],
    appsLiberados: [],
    error
  };
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}

function normalizeEmpresa(value: unknown): SharedEmpresa | null {
  const empresa = relationObject(value);
  if (!empresa) {
    return null;
  }

  return {
    id: String(empresa.id ?? ""),
    nome: String(empresa.nome_fantasia ?? empresa.nome ?? ""),
    categoria: relationObject(empresa.core_empresa_categorias)?.nome as string | null | undefined,
    categoriaSlug: relationObject(empresa.core_empresa_categorias)?.slug as string | null | undefined,
    status: typeof empresa.status === "string" ? empresa.status : null
  };
}
