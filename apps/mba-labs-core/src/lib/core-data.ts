import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUserProfileFromSupabase, type SharedAppAccess, type SharedPermissao } from "@mba-labs/shared/auth/profile";
import { getSupabaseServer } from "./supabase";

export type CoreProfile = {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  empresa_id: string | null;
};

export type CurrentUserProfile = {
  authUser: {
    id: string;
    email?: string | null;
  };
  usuario: CoreProfile;
  empresaId: string;
  tipo: string;
  isAdminMaster: boolean;
  permissoes: SharedPermissao[];
  appsLiberados: SharedAppAccess[];
};

export type SystemCard = {
  slug: string;
  nome: string;
  descricao: string;
  url_path: string;
  status: "ativa" | "teste" | "bloqueada" | "sem_assinatura";
  canAccess: boolean;
};

export const fallbackApps: SystemCard[] = [
  {
    slug: "mba-cotacoes",
    nome: "MBA Cotacoes",
    descricao: "Compras, cotacoes, respostas de vendedores e pedidos.",
    url_path: "/cotacoes",
    status: "sem_assinatura",
    canAccess: false
  },
  {
    slug: "lavagestor",
    nome: "LavaGestor",
    descricao: "Lavagens, clientes, veiculos, funcionarios e comissoes.",
    url_path: "/lavagestor",
    status: "sem_assinatura",
    canAccess: false
  }
];

export async function getSessionProfile() {
  try {
    const supabase = await getSupabaseServer();
    const current = await getCurrentUserProfileFromSupabase(supabase);
    const user = current.authUser;

    if (!user) {
      return { user: null, profile: null, error: current.error };
    }

    return {
      user,
      profile: current.usuario as CoreProfile | null,
      permissoes: current.permissoes,
      appsLiberados: current.appsLiberados,
      error: current.error
    };
  } catch (error) {
    return {
      user: null,
      profile: null,
      error: error instanceof Error ? error.message : "Erro ao conectar no Supabase."
    };
  }
}

export async function requireSessionProfile(nextPath?: string) {
  const context = await getSessionProfile();

  if (!context.user) {
    redirect(`/login?next=${encodeURIComponent(await getRequestPath(nextPath))}`);
  }

  if (!context.profile) {
    redirect("/setup-admin");
  }

  return {
    user: context.user,
    profile: context.profile,
    permissoes: context.permissoes ?? [],
    appsLiberados: context.appsLiberados ?? []
  };
}

export async function getCurrentUserProfile(nextPath?: string): Promise<CurrentUserProfile> {
  const { user, profile, permissoes, appsLiberados } = await requireSessionProfile(nextPath);

  if (!profile.empresa_id) {
    redirect("/setup-admin");
  }

  return {
    authUser: {
      id: user.id,
      email: user.email
    },
    usuario: profile,
    empresaId: profile.empresa_id,
    tipo: profile.tipo,
    isAdminMaster: profile.tipo === "admin_master",
    permissoes,
    appsLiberados
  };
}

export async function requireAppAccess(appSlug: string, nextPath?: string) {
  const current = await getCurrentUserProfile(nextPath);

  if (current.isAdminMaster || current.appsLiberados.some((app) => app.slug === appSlug && app.canAccess)) {
    return current;
  }

  const attemptedPath = await getRequestPath(nextPath);
  redirect(`/acesso-bloqueado?app=${encodeURIComponent(appSlug)}&next=${encodeURIComponent(attemptedPath)}`);
}

export async function logAction({
  appSlug,
  acao,
  detalhes
}: {
  appSlug?: string;
  acao: string;
  detalhes?: Record<string, unknown>;
}) {
  try {
    const current = await getCurrentUserProfile();
    const supabase = await getSupabaseServer();
    await (supabase as any).from("core_logs").insert({
      empresa_id: current.empresaId,
      usuario_id: current.usuario.id,
      app_slug: appSlug ?? null,
      acao,
      detalhes: detalhes ?? null
    });
  } catch {
    // Logging should never block the user's main action.
  }
}

export async function getDashboardData() {
  const current = await getCurrentUserProfile("/dashboard");
  const profile = current.usuario;
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const { data: apps, error: appsError } = await client
    .from("core_apps")
    .select("id,slug,nome,descricao,url_path,ativo,ordem")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (appsError || !apps) {
    return {
      profile,
      apps: fallbackApps,
      error: appsError?.message ?? null
    };
  }

  if (profile.tipo === "admin_master") {
    return {
      profile,
      apps: apps.map((app: any) => ({
        slug: app.slug,
        nome: app.nome,
        descricao: app.descricao ?? "Sistema MBA Labs.",
        url_path: app.url_path ?? `/${app.slug}`,
        status: "ativa",
        canAccess: true
      })) as SystemCard[],
      error: null
    };
  }

  const accessBySlug = new Map(current.appsLiberados.map((app) => [app.slug, app]));

  return {
    profile,
    apps: apps.map((app: any) => {
      const access = accessBySlug.get(app.slug);
      return {
        slug: app.slug,
        nome: app.nome,
        descricao: app.descricao ?? "Sistema MBA Labs.",
        url_path: app.url_path ?? `/${app.slug}`,
        status: (access?.status ?? "bloqueada") as SystemCard["status"],
        canAccess: Boolean(access?.canAccess)
      };
    }) as SystemCard[],
    error: null
  };
}

async function getRequestPath(explicitPath?: string) {
  if (explicitPath) {
    return sanitizeInternalPath(explicitPath);
  }

  try {
    const requestHeaders = await headers();
    return sanitizeInternalPath(requestHeaders.get("x-mba-current-path") ?? "/dashboard");
  } catch {
    return "/dashboard";
  }
}

function sanitizeInternalPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }

  return path;
}

export type AdminField = {
  name: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "select" | "textarea" | "boolean";
  required?: boolean;
  optionSource?: "empresas" | "apps" | "planos" | "assinaturas";
  options?: Array<{ label: string; value: string }>;
};

export type AdminResourceConfig = {
  table: string;
  title: string;
  select: string;
  columns: Array<{ key: string; label: string }>;
  fields: AdminField[];
  companyScoped?: boolean;
  readOnly?: boolean;
  inactiveField?: "status" | "ativo";
  inactiveValue?: string | boolean;
};

export const adminResources = {
  empresas: {
    table: "core_empresas",
    title: "Empresas",
    select: "id,nome,nome_fantasia,cnpj,telefone,email,cidade,estado,status,created_at",
    inactiveField: "status",
    inactiveValue: "inativa",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "nome_fantasia", label: "Fantasia" },
      { key: "cnpj", label: "CNPJ" },
      { key: "email", label: "Email" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Criado em" }
    ],
    fields: [
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "nome_fantasia", label: "Nome fantasia", type: "text" },
      { name: "cnpj", label: "CNPJ", type: "text" },
      { name: "telefone", label: "Telefone", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "cidade", label: "Cidade", type: "text" },
      { name: "estado", label: "Estado", type: "text" },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { label: "Ativa", value: "ativa" },
          { label: "Inativa", value: "inativa" },
          { label: "Bloqueada", value: "bloqueada" }
        ]
      }
    ]
  },
  usuarios: {
    table: "core_usuarios",
    title: "Usuários",
    select: "id,nome,email,telefone,empresa_id,tipo,status,created_at,core_empresas(nome)",
    companyScoped: true,
    inactiveField: "status",
    inactiveValue: "inativo",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "email", label: "Email" },
      { key: "tipo", label: "Tipo" },
      { key: "status", label: "Status" },
      { key: "empresa", label: "Empresa" },
      { key: "created_at", label: "Criado em" }
    ],
    fields: [
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "telefone", label: "Telefone", type: "text" },
      { name: "empresa_id", label: "Empresa", type: "select", required: true, optionSource: "empresas" },
      {
        name: "tipo",
        label: "Tipo",
        type: "select",
        required: true,
        options: [
          { label: "Admin Master", value: "admin_master" },
          { label: "Admin da empresa", value: "admin_empresa" },
          { label: "Usuário", value: "usuario" },
          { label: "Vendedor", value: "vendedor" },
          { label: "Funcionário", value: "funcionario" }
        ]
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { label: "Ativo", value: "ativo" },
          { label: "Inativo", value: "inativo" },
          { label: "Bloqueado", value: "bloqueado" }
        ]
      }
    ]
  },
  apps: {
    table: "core_apps",
    title: "Apps",
    select: "id,slug,nome,descricao,url_path,ativo,ordem,created_at",
    inactiveField: "ativo",
    inactiveValue: false,
    columns: [
      { key: "slug", label: "Slug" },
      { key: "nome", label: "Nome" },
      { key: "url_path", label: "URL" },
      { key: "ativo", label: "Ativo" },
      { key: "ordem", label: "Ordem" },
      { key: "created_at", label: "Criado em" }
    ],
    fields: [
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "descricao", label: "Descrição", type: "textarea" },
      { name: "url_path", label: "Caminho no portal", type: "text" },
      { name: "ordem", label: "Ordem", type: "number" },
      { name: "ativo", label: "Ativo", type: "boolean" }
    ]
  },
  planos: {
    table: "core_planos",
    title: "Planos",
    select: "id,app_id,nome,descricao,valor_mensal,limite_usuarios,limite_registros,ativo,created_at,core_apps(nome)",
    inactiveField: "ativo",
    inactiveValue: false,
    columns: [
      { key: "app", label: "App" },
      { key: "nome", label: "Nome" },
      { key: "valor_mensal", label: "Mensalidade" },
      { key: "limite_usuarios", label: "Usuários" },
      { key: "ativo", label: "Ativo" },
      { key: "created_at", label: "Criado em" }
    ],
    fields: [
      { name: "app_id", label: "App", type: "select", required: true, optionSource: "apps" },
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "descricao", label: "Descrição", type: "textarea" },
      { name: "valor_mensal", label: "Valor mensal", type: "number" },
      { name: "limite_usuarios", label: "Limite de usuários", type: "number" },
      { name: "limite_registros", label: "Limite de registros", type: "number" },
      { name: "ativo", label: "Ativo", type: "boolean" }
    ]
  },
  assinaturas: {
    table: "core_assinaturas",
    title: "Assinaturas",
    select: "id,empresa_id,app_id,plano_id,status,inicio,vencimento,created_at,core_empresas(nome),core_apps(nome),core_planos(nome)",
    companyScoped: true,
    inactiveField: "status",
    inactiveValue: "cancelada",
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "app", label: "App" },
      { key: "plano", label: "Plano" },
      { key: "status", label: "Status" },
      { key: "inicio", label: "Início" },
      { key: "vencimento", label: "Vencimento" }
    ],
    fields: [
      { name: "empresa_id", label: "Empresa", type: "select", required: true, optionSource: "empresas" },
      { name: "app_id", label: "App", type: "select", required: true, optionSource: "apps" },
      { name: "plano_id", label: "Plano", type: "select", optionSource: "planos" },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { label: "Ativa", value: "ativa" },
          { label: "Teste", value: "teste" },
          { label: "Bloqueada", value: "bloqueada" },
          { label: "Cancelada", value: "cancelada" }
        ]
      },
      { name: "inicio", label: "Início", type: "date", required: true },
      { name: "vencimento", label: "Vencimento", type: "date" }
    ]
  },
  pagamentos: {
    table: "core_pagamentos",
    title: "Pagamentos",
    select: "id,empresa_id,assinatura_id,valor,vencimento,pagamento_em,status,metodo,referencia_externa,created_at,core_empresas(nome)",
    companyScoped: true,
    inactiveField: "status",
    inactiveValue: "cancelado",
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "valor", label: "Valor" },
      { key: "vencimento", label: "Vencimento" },
      { key: "pagamento_em", label: "Pago em" },
      { key: "status", label: "Status" },
      { key: "metodo", label: "Método" }
    ],
    fields: [
      { name: "empresa_id", label: "Empresa", type: "select", required: true, optionSource: "empresas" },
      { name: "assinatura_id", label: "Assinatura", type: "select", required: true, optionSource: "assinaturas" },
      { name: "valor", label: "Valor", type: "number", required: true },
      { name: "vencimento", label: "Vencimento", type: "date" },
      { name: "pagamento_em", label: "Pago em", type: "date" },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { label: "Aberto", value: "aberto" },
          { label: "Pago", value: "pago" },
          { label: "Atrasado", value: "atrasado" },
          { label: "Cancelado", value: "cancelado" }
        ]
      },
      { name: "metodo", label: "Método", type: "text" },
      { name: "referencia_externa", label: "Referência externa", type: "text" }
    ]
  },
  logs: {
    table: "core_logs",
    title: "Logs",
    select: "id,empresa_id,usuario_id,app_slug,acao,detalhes,created_at,core_empresas(nome),core_usuarios(nome)",
    readOnly: true,
    companyScoped: true,
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "usuario", label: "Usuário" },
      { key: "app_slug", label: "App" },
      { key: "acao", label: "Ação" },
      { key: "created_at", label: "Criado em" }
    ],
    fields: []
  }
} satisfies Record<string, AdminResourceConfig>;

export type AdminResource = keyof typeof adminResources;

export function getAdminResource(resource: string): AdminResourceConfig | undefined {
  return adminResources[resource as AdminResource] as AdminResourceConfig | undefined;
}

export async function getAdminRows(resource: AdminResource) {
  const { profile } = await requireSessionProfile();

  if (!["admin_master", "admin_empresa"].includes(profile.tipo)) {
    redirect("/dashboard");
  }

  const config = adminResources[resource] as AdminResourceConfig;
  const supabase = await getSupabaseServer();
  let query = (supabase as any)
    .from(config.table)
    .select(config.select)
    .limit(80);

  if (config.companyScoped && profile.tipo !== "admin_master" && profile.empresa_id) {
    query = query.eq("empresa_id", profile.empresa_id);
  }

  const { data, error } = await query;

  return {
    profile,
    config,
    rows: ((data ?? []) as Array<Record<string, unknown>>).map(normalizeAdminRow),
    error: error?.message ?? null
  };
}

export async function getAdminOptions() {
  const current = await getCurrentUserProfile();
  const supabase = await getSupabaseServer();
  const client = supabase as any;

  let empresasQuery = client.from("core_empresas").select("id,nome").order("nome");
  if (!current.isAdminMaster) {
    empresasQuery = empresasQuery.eq("id", current.empresaId);
  }

  const [empresas, apps, planos, assinaturas] = await Promise.all([
    empresasQuery,
    client.from("core_apps").select("id,nome").order("ordem"),
    client.from("core_planos").select("id,nome,core_apps(nome)").order("nome"),
    client
      .from("core_assinaturas")
      .select("id,status,core_empresas(nome),core_apps(nome)")
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  return {
    empresas: toOptions(empresas.data),
    apps: toOptions(apps.data),
    planos: (planos.data ?? []).map((row: any) => ({
      value: row.id,
      label: `${relationName(row.core_apps) ? `${relationName(row.core_apps)} - ` : ""}${row.nome}`
    })),
    assinaturas: (assinaturas.data ?? []).map((row: any) => ({
      value: row.id,
      label: `${relationName(row.core_empresas) || "Empresa"} - ${relationName(row.core_apps) || "App"} - ${row.status}`
    }))
  };
}

function normalizeAdminRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    empresa: relationName(row.core_empresas),
    usuario: relationName(row.core_usuarios),
    app: relationName(row.core_apps),
    plano: relationName(row.core_planos)
  };
}

function relationName(value: unknown) {
  if (!value) {
    return "";
  }

  const relation = Array.isArray(value) ? value[0] : value;
  if (relation && typeof relation === "object" && "nome" in relation) {
    return String((relation as { nome?: unknown }).nome ?? "");
  }

  return "";
}

function toOptions(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row: any) => ({
    value: row.id,
    label: row.nome
  }));
}
