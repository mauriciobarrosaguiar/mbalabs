import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, UsuarioTipo } from "../types/database";

export type SharedCoreProfile = {
  id: string;
  nome: string;
  email: string;
  tipo: UsuarioTipo | string;
  empresa_id: string | null;
};

export type SharedEmpresa = {
  id: string;
  nome: string;
  status?: string | null;
};

export type SharedPermissao = {
  appSlug: string;
  appNome: string;
  perfil: string;
  podeAcessar: boolean;
};

export type SharedAppAccess = {
  slug: string;
  nome: string;
  descricao: string | null;
  urlPath: string;
  status: "ativa" | "teste" | "bloqueada" | "sem_assinatura";
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
    .select("id,nome,email,tipo,empresa_id,core_empresas(id,nome,status)")
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
      .select("id,slug,nome,descricao,url_path,ativo,ordem")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
    (supabase as any)
      .from("core_permissoes")
      .select("pode_acessar,perfil,core_apps(slug,nome,url_path,descricao,ativo)")
      .eq("usuario_id", usuario.id),
    usuario.empresa_id
      ? (supabase as any)
          .from("core_assinaturas")
          .select("status,core_apps(slug,nome,url_path,descricao,ativo)")
          .eq("empresa_id", usuario.empresa_id)
      : Promise.resolve({ data: [], error: null })
  ]);

  const apps = (appsResult.data ?? []) as Array<Record<string, unknown>>;
  const permissoes = ((permissoesResult.data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const app = relationObject(row.core_apps);
    return {
      appSlug: String(app?.slug ?? ""),
      appNome: String(app?.nome ?? ""),
      perfil: String(row.perfil ?? "usuario"),
      podeAcessar: row.pode_acessar !== false
    };
  });

  const assinaturaBySlug = new Map<string, "ativa" | "teste" | "bloqueada">();
  for (const assinatura of (assinaturasResult.data ?? []) as Array<Record<string, unknown>>) {
    const app = relationObject(assinatura.core_apps);
    const slug = String(app?.slug ?? "");
    const status = String(assinatura.status ?? "");
    if (slug && (status === "ativa" || status === "teste")) {
      assinaturaBySlug.set(slug, status);
    } else if (slug && !assinaturaBySlug.has(slug)) {
      assinaturaBySlug.set(slug, "bloqueada");
    }
  }

  const isAdminMaster = usuario.tipo === "admin_master";
  const isCompanyAdmin = usuario.tipo === "admin_empresa";

  const appsLiberados = apps.map((app) => {
    const slug = String(app.slug ?? "");
    const assinaturaStatus = assinaturaBySlug.get(slug);
    const hasPermission = permissoes.some((permissao) => permissao.appSlug === slug && permissao.podeAcessar);
    const canAccess = isAdminMaster || Boolean(assinaturaStatus && assinaturaStatus !== "bloqueada" && (isCompanyAdmin || hasPermission));

    return {
      slug,
      nome: String(app.nome ?? slug),
      descricao: typeof app.descricao === "string" ? app.descricao : null,
      urlPath: String(app.url_path ?? `/${slug}`),
      status: isAdminMaster ? "ativa" : assinaturaStatus ?? "sem_assinatura",
      canAccess
    } satisfies SharedAppAccess;
  });

  return {
    authUser: user,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
      empresa_id: usuario.empresa_id
    },
    empresa: normalizeEmpresa(usuario.core_empresas),
    empresaId: usuario.empresa_id,
    tipo: usuario.tipo,
    isAdminMaster,
    permissoes,
    appsLiberados,
    error: appsResult.error?.message ?? permissoesResult.error?.message ?? assinaturasResult.error?.message ?? null
  };
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
    nome: String(empresa.nome ?? ""),
    status: typeof empresa.status === "string" ? empresa.status : null
  };
}
