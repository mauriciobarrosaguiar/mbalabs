import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUserProfileFromSupabase, type SharedAppAccess, type SharedPermissao } from "@mba-labs/shared/auth/profile";
import { getSupabaseServer } from "./supabase";

export type CoreProfile = {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  status: string;
  empresa_id: string | null;
};

export type CurrentUserProfile = {
  authUser: {
    id: string;
    email?: string | null;
  };
  usuario: CoreProfile;
  empresaId: string | null;
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
  status: SharedAppAccess["status"];
  canAccess: boolean;
};

export const fallbackApps: SystemCard[] = [
  {
    slug: "mba-cotacoes",
    nome: "MBA Cotacoes",
    descricao: "Compras, cotacoes, respostas de vendedores e pedidos.",
    url_path: "/apps/mbacotacoes",
    status: "sem_assinatura",
    canAccess: false
  },
  {
    slug: "lavagestor",
    nome: "LavaGestor",
    descricao: "Lavagens, clientes, veiculos, funcionarios e comissoes.",
    url_path: "/apps/lavagestor",
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
      empresa: current.empresa,
      permissoes: current.permissoes,
      appsLiberados: current.appsLiberados,
      error: current.error
    };
  } catch (error) {
    return {
      user: null,
      profile: null,
      empresa: null,
      permissoes: [],
      appsLiberados: [],
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
    empresa: context.empresa,
    permissoes: context.permissoes ?? [],
    appsLiberados: context.appsLiberados ?? []
  };
}

export async function getCurrentUserProfile(nextPath?: string): Promise<CurrentUserProfile> {
  const { user, profile, permissoes, appsLiberados } = await requireSessionProfile(nextPath);
  const isAdminMaster = isSuperAdminType(profile.tipo);

  if (!profile.empresa_id && !isAdminMaster) {
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
    isAdminMaster,
    permissoes,
    appsLiberados
  };
}

export async function requireAppAccess(appSlug: string, nextPath?: string) {
  const current = await getCurrentUserProfile(nextPath);
  const canonicalSlug = normalizeAppSlug(appSlug);

  if (
    current.isAdminMaster ||
    current.appsLiberados.some((app) => normalizeAppSlug(app.slug) === canonicalSlug && app.canAccess)
  ) {
    return current;
  }

  const attemptedPath = await getRequestPath(nextPath);
  redirect(`/acesso-bloqueado?app=${encodeURIComponent(canonicalSlug)}&next=${encodeURIComponent(attemptedPath)}`);
}

export async function getLoginDestination(nextPath = "/dashboard") {
  const context = await getSessionProfile();
  const requestedPath = sanitizeInternalPath(nextPath);

  if (!context.user) {
    return `/login?next=${encodeURIComponent(requestedPath)}`;
  }

  if (!context.profile) {
    return "/setup-admin";
  }

  if (context.profile.status !== "ativo") {
    return "/acesso-bloqueado?motivo=usuario";
  }

  if (canAccessRequestedPath(requestedPath, context.profile, context.appsLiberados ?? [])) {
    return requestedPath;
  }

  return getFallbackDestination(context.profile, context.appsLiberados ?? []);
}

function getFallbackDestination(profile: CoreProfile, appsLiberados: SharedAppAccess[]) {
  if (isSuperAdminType(profile.tipo)) {
    return "/admin/dashboard";
  }

  if (profile.tipo === "admin_empresa") {
    return "/empresa/dashboard";
  }

  const availableApps = appsLiberados.filter((app) => app.canAccess);

  if (availableApps.length === 0) {
    return "/acesso-bloqueado?motivo=sem-app";
  }

  if (availableApps.length === 1) {
    return availableApps[0].urlPath;
  }

  return "/selecionar-app";
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
    .select("id,slug,nome,descricao,url_path,url_interna,status,ativo,ordem")
    .order("ordem", { ascending: true });

  if (appsError || !apps) {
    return {
      profile,
      apps: fallbackApps,
      error: appsError?.message ?? null
    };
  }

  if (current.isAdminMaster) {
    return {
      profile,
      apps: apps.filter(isActiveApp).map((app: any) => ({
        slug: app.slug,
        nome: app.nome,
        descricao: app.descricao ?? "Sistema MBA Labs.",
        url_path: app.url_interna ?? app.url_path ?? `/${app.slug}`,
        status: "ativo",
        canAccess: true
      })) as SystemCard[],
      error: null
    };
  }

  const accessBySlug = new Map(current.appsLiberados.map((app) => [normalizeAppSlug(app.slug), app]));

  return {
    profile,
    apps: apps.filter(isActiveApp).map((app: any) => {
      const access = accessBySlug.get(normalizeAppSlug(app.slug));
      return {
        slug: app.slug,
        nome: app.nome,
        descricao: app.descricao ?? "Sistema MBA Labs.",
        url_path: access?.urlPath ?? app.url_interna ?? app.url_path ?? `/${app.slug}`,
        status: access?.status ?? "sem_assinatura",
        canAccess: Boolean(access?.canAccess)
      };
    }) as SystemCard[],
    error: null
  };
}

export type AdminField = {
  name: string;
  label: string;
  type: "text" | "email" | "number" | "date" | "select" | "textarea" | "boolean" | "password";
  required?: boolean;
  optionSource?: "categorias" | "empresas" | "apps" | "planos" | "assinaturas";
  options?: Array<{ label: string; value: string }>;
  skipPayload?: boolean;
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
  "categorias-empresas": {
    table: "core_empresa_categorias",
    title: "Categorias de Empresas",
    select: "id,nome,slug,descricao,status,created_at,updated_at",
    inactiveField: "status",
    inactiveValue: "inativa",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "slug", label: "Slug" },
      { key: "status", label: "Status" },
      { key: "created_at", label: "Criado em" }
    ],
    fields: [
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "descricao", label: "Descricao", type: "textarea" },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { label: "Ativa", value: "ativa" },
          { label: "Inativa", value: "inativa" }
        ]
      }
    ]
  },
  empresas: {
    table: "core_empresas",
    title: "Empresas",
    select:
      "id,categoria_id,nome,nome_fantasia,razao_social,cnpj,telefone,whatsapp,email,cidade,estado,responsavel,status,observacoes,created_at,core_empresa_categorias(nome)",
    inactiveField: "status",
    inactiveValue: "bloqueada",
    columns: [
      { key: "nome_fantasia", label: "Nome fantasia" },
      { key: "categoria", label: "Categoria" },
      { key: "cnpj", label: "CNPJ" },
      { key: "cidade_uf", label: "Cidade/UF" },
      { key: "apps_contratados", label: "Apps contratados" },
      { key: "status", label: "Status" },
      { key: "responsavel", label: "Responsavel" }
    ],
    fields: [
      { name: "categoria_id", label: "Categoria", type: "select", required: true, optionSource: "categorias" },
      { name: "nome_fantasia", label: "Nome fantasia", type: "text", required: true },
      { name: "razao_social", label: "Razao social", type: "text" },
      { name: "cnpj", label: "CNPJ", type: "text" },
      { name: "telefone", label: "Telefone", type: "text" },
      { name: "whatsapp", label: "WhatsApp", type: "text" },
      { name: "email", label: "Email", type: "email" },
      { name: "cidade", label: "Cidade", type: "text" },
      { name: "estado", label: "Estado", type: "text" },
      { name: "responsavel", label: "Responsavel", type: "text" },
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
      { name: "observacoes", label: "Observacoes", type: "textarea" }
    ]
  },
  usuarios: {
    table: "core_usuarios",
    title: "Usuarios",
    select: "id,nome,email,telefone,empresa_id,tipo,tipo_global,status,created_at,core_empresas(nome,nome_fantasia)",
    companyScoped: true,
    inactiveField: "status",
    inactiveValue: "bloqueado",
    columns: [
      { key: "nome", label: "Nome" },
      { key: "email", label: "Email" },
      { key: "tipo", label: "Tipo global" },
      { key: "status", label: "Status" },
      { key: "empresa", label: "Empresa" },
      { key: "apps_permitidos", label: "Apps permitidos" }
    ],
    fields: [
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "telefone", label: "Telefone", type: "text" },
      { name: "senha_provisoria", label: "Senha provisoria", type: "password", skipPayload: true },
      { name: "empresa_id", label: "Empresa", type: "select", optionSource: "empresas" },
      {
        name: "tipo",
        label: "Tipo global",
        type: "select",
        required: true,
        options: [
          { label: "Super Admin MBA Labs", value: "super_admin" },
          { label: "Admin da empresa", value: "admin_empresa" },
          { label: "Operador", value: "operador" },
          { label: "Usuario", value: "usuario" }
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
          { label: "Bloqueado", value: "bloqueado" },
          { label: "Pendente", value: "pendente" }
        ]
      },
      { name: "app_id", label: "App permitido", type: "select", optionSource: "apps", skipPayload: true },
      {
        name: "perfil_app",
        label: "Perfil dentro do app",
        type: "select",
        skipPayload: true,
        options: [
          { label: "Admin da empresa", value: "admin_empresa" },
          { label: "Comprador", value: "comprador" },
          { label: "Vendedor", value: "vendedor" },
          { label: "Visualizador", value: "visualizador" },
          { label: "Dono", value: "dono" },
          { label: "Gerente", value: "gerente" },
          { label: "Lavador", value: "lavador" },
          { label: "Caixa", value: "caixa" }
        ]
      }
    ]
  },
  apps: {
    table: "core_apps",
    title: "Apps",
    select: "id,slug,nome,descricao,url_interna,url_externa,logo_icone,status,ordem,created_at,updated_at",
    inactiveField: "status",
    inactiveValue: "inativo",
    columns: [
      { key: "nome", label: "Nome do app" },
      { key: "slug", label: "Slug" },
      { key: "url_interna", label: "URL interna" },
      { key: "status", label: "Status" },
      { key: "empresas_vinculadas", label: "Empresas vinculadas" }
    ],
    fields: [
      { name: "slug", label: "Slug", type: "text", required: true },
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "descricao", label: "Descricao", type: "textarea" },
      { name: "url_interna", label: "URL interna", type: "text" },
      { name: "url_externa", label: "URL externa", type: "text" },
      { name: "logo_icone", label: "Logo/icone", type: "text" },
      { name: "ordem", label: "Ordem", type: "number" },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: true,
        options: [
          { label: "Ativo", value: "ativo" },
          { label: "Inativo", value: "inativo" }
        ]
      }
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
      { key: "limite_usuarios", label: "Usuarios" },
      { key: "ativo", label: "Ativo" },
      { key: "created_at", label: "Criado em" }
    ],
    fields: [
      { name: "app_id", label: "App", type: "select", required: true, optionSource: "apps" },
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "descricao", label: "Descricao", type: "textarea" },
      { name: "valor_mensal", label: "Valor mensal", type: "number" },
      { name: "limite_usuarios", label: "Limite de usuarios", type: "number" },
      { name: "limite_registros", label: "Limite de registros", type: "number" },
      { name: "ativo", label: "Ativo", type: "boolean" }
    ]
  },
  assinaturas: {
    table: "core_assinaturas",
    title: "Assinaturas",
    select: "id,empresa_id,app_id,plano_id,status,inicio,vencimento,created_at,core_empresas(nome,nome_fantasia),core_apps(nome),core_planos(nome)",
    companyScoped: true,
    inactiveField: "status",
    inactiveValue: "cancelada",
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "app", label: "App" },
      { key: "plano", label: "Plano" },
      { key: "status", label: "Status" },
      { key: "inicio", label: "Inicio" },
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
          { label: "Vencida", value: "vencida" },
          { label: "Bloqueada", value: "bloqueada" },
          { label: "Cancelada", value: "cancelada" }
        ]
      },
      { name: "inicio", label: "Inicio", type: "date", required: true },
      { name: "vencimento", label: "Vencimento", type: "date" }
    ]
  },
  pagamentos: {
    table: "core_pagamentos",
    title: "Pagamentos",
    select: "id,empresa_id,assinatura_id,valor,vencimento,pagamento_em,status,metodo,referencia_externa,created_at,core_empresas(nome,nome_fantasia)",
    companyScoped: true,
    inactiveField: "status",
    inactiveValue: "cancelado",
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "valor", label: "Valor" },
      { key: "vencimento", label: "Vencimento" },
      { key: "pagamento_em", label: "Pago em" },
      { key: "status", label: "Status" },
      { key: "metodo", label: "Metodo" }
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
          { label: "Pendente", value: "pendente" },
          { label: "Pago", value: "pago" },
          { label: "Vencido", value: "vencido" },
          { label: "Cancelado", value: "cancelado" }
        ]
      },
      { name: "metodo", label: "Metodo", type: "text" },
      { name: "referencia_externa", label: "Referencia externa", type: "text" }
    ]
  },
  logs: {
    table: "core_logs",
    title: "Logs",
    select: "id,empresa_id,usuario_id,app_slug,acao,detalhes,created_at,core_empresas(nome,nome_fantasia),core_usuarios(nome)",
    readOnly: true,
    companyScoped: true,
    columns: [
      { key: "empresa", label: "Empresa" },
      { key: "usuario", label: "Usuario" },
      { key: "app_slug", label: "App" },
      { key: "acao", label: "Acao" },
      { key: "created_at", label: "Criado em" }
    ],
    fields: []
  }
} satisfies Record<string, AdminResourceConfig>;

export type AdminResource = keyof typeof adminResources;

export type AdminFilters = {
  categoria?: string;
  status?: string;
  app?: string;
  cidade?: string;
  estado?: string;
  q?: string;
};

export function getAdminResource(resource: string): AdminResourceConfig | undefined {
  return adminResources[resource as AdminResource] as AdminResourceConfig | undefined;
}

export async function getAdminRows(resource: AdminResource, filters: AdminFilters = {}) {
  const { profile } = await requireSessionProfile();

  if (!isSuperAdminType(profile.tipo)) {
    redirect("/dashboard");
  }

  const config = adminResources[resource] as AdminResourceConfig;
  const supabase = await getSupabaseServer();
  let query = (supabase as any)
    .from(config.table)
    .select(config.select)
    .limit(200);

  if (config.companyScoped && !isSuperAdminType(profile.tipo) && profile.empresa_id) {
    query = query.eq("empresa_id", profile.empresa_id);
  }

  if (resource === "empresas") {
    query = await applyEmpresaFilters(supabase as any, query, filters);
  }

  if (resource === "logs") {
    query = query.order("created_at", { ascending: false });
  } else if (resource === "categorias-empresas") {
    query = query.order("nome", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  let rows = ((data ?? []) as Array<Record<string, unknown>>).map(normalizeAdminRow);

  if (resource === "empresas") {
    rows = await appendEmpresaApps(supabase as any, rows);
  }

  if (resource === "usuarios") {
    rows = await appendUsuarioPermissoes(supabase as any, rows);
  }

  if (resource === "apps") {
    rows = await appendAppCompanyCounts(supabase as any, rows);
  }

  return {
    profile,
    config,
    rows,
    error: error?.message ?? null
  };
}

export async function getAdminOptions() {
  const current = await getCurrentUserProfile();

  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServer();
  const client = supabase as any;

  let empresasQuery = client.from("core_empresas").select("id,nome,nome_fantasia").order("nome_fantasia");
  if (!current.isAdminMaster && current.empresaId) {
    empresasQuery = empresasQuery.eq("id", current.empresaId);
  }

  const [categorias, empresas, apps, planos, assinaturas] = await Promise.all([
    client.from("core_empresa_categorias").select("id,nome").order("nome"),
    empresasQuery,
    client.from("core_apps").select("id,nome,status,ordem").order("ordem"),
    client.from("core_planos").select("id,nome,core_apps(nome)").order("nome"),
    client
      .from("core_assinaturas")
      .select("id,status,core_empresas(nome,nome_fantasia),core_apps(nome)")
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  return {
    categorias: toOptions(categorias.data),
    empresas: toOptions(empresas.data),
    apps: toOptions((apps.data ?? []).filter((row: any) => String(row.status ?? "ativo") === "ativo")),
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

export async function getAdminDashboardData() {
  const current = await getCurrentUserProfile("/admin/dashboard");

  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServer();
  const client = supabase as any;
  const today = new Date();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 15);
  const todayIso = toDateInput(today);
  const soonIso = toDateInput(soon);

  const [
    totalEmpresas,
    empresasAtivas,
    empresasTeste,
    empresasBloqueadas,
    empresasCanceladas,
    totalUsuarios,
    totalApps,
    assinaturasAtivas,
    assinaturasVencidas,
    assinaturasProximas,
    empresasPorCategoria,
    empresasPorApp
  ] = await Promise.all([
    countRows(client, "core_empresas"),
    countRows(client, "core_empresas", { status: "ativa" }),
    countRows(client, "core_empresas", { status: "teste" }),
    countRows(client, "core_empresas", { status: "bloqueada" }),
    countRows(client, "core_empresas", { status: "cancelada" }),
    countRows(client, "core_usuarios"),
    countRows(client, "core_apps"),
    countRows(client, "core_empresa_apps", { status: "ativo" }),
    countRows(client, "core_empresa_apps", { status: "vencido" }),
    countContractExpiringSoon(client, todayIso, soonIso),
    client.from("core_empresas").select("id,core_empresa_categorias(nome)"),
    client.from("core_empresa_apps").select("id,status,core_apps(nome)")
  ]);

  return {
    stats: [
      { label: "Total de empresas", value: totalEmpresas },
      { label: "Empresas ativas", value: empresasAtivas },
      { label: "Empresas em teste", value: empresasTeste },
      { label: "Empresas bloqueadas", value: empresasBloqueadas },
      { label: "Empresas canceladas", value: empresasCanceladas },
      { label: "Total de usuarios", value: totalUsuarios },
      { label: "Apps cadastrados", value: totalApps },
      { label: "Assinaturas ativas", value: assinaturasAtivas },
      { label: "Assinaturas vencidas", value: assinaturasVencidas },
      { label: "Vencem em 15 dias", value: assinaturasProximas }
    ],
    porCategoria: countByRelation(empresasPorCategoria.data ?? [], "core_empresa_categorias"),
    porApp: countByRelation(empresasPorApp.data ?? [], "core_apps")
  };
}

export async function getEmpresaDashboardData(nextPath = "/empresa/dashboard") {
  const current = await getCurrentUserProfile(nextPath);

  if (!current.empresaId) {
    redirect(current.isAdminMaster ? "/admin/dashboard" : "/setup-admin");
  }

  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const [empresa, usuarios, apps] = await Promise.all([
    client
      .from("core_empresas")
      .select("id,nome,nome_fantasia,razao_social,cnpj,cidade,estado,status,responsavel,core_empresa_categorias(nome)")
      .eq("id", current.empresaId)
      .maybeSingle(),
    client
      .from("core_usuarios")
      .select("id,nome,email,tipo,status,created_at")
      .eq("empresa_id", current.empresaId)
      .order("nome"),
    client
      .from("core_empresa_apps")
      .select("id,status,data_inicio,data_vencimento,core_apps(nome,slug,url_interna,url_path,descricao),core_planos(nome)")
      .eq("empresa_id", current.empresaId)
      .order("created_at", { ascending: false })
  ]);

  return {
    current,
    empresa: normalizeAdminRow(empresa.data ?? {}),
    usuarios: usuarios.data ?? [],
    apps: ((apps.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      app: relationName(row.core_apps),
      plano: relationName(row.core_planos),
      url: relationObject(row.core_apps)?.url_interna ?? relationObject(row.core_apps)?.url_path ?? "#"
    })),
    error: empresa.error?.message ?? usuarios.error?.message ?? apps.error?.message ?? null
  };
}

export async function getEmpresaAppsAdminData(empresaId: string) {
  const current = await getCurrentUserProfile(`/admin/empresas/${empresaId}/apps`);

  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServer();
  const client = supabase as any;

  const [empresa, vinculos, apps, planos] = await Promise.all([
    client
      .from("core_empresas")
      .select("id,nome,nome_fantasia,status,core_empresa_categorias(nome)")
      .eq("id", empresaId)
      .maybeSingle(),
    client
      .from("core_empresa_apps")
      .select("id,empresa_id,app_id,plano_id,status,data_inicio,data_vencimento,observacoes,created_at,core_apps(nome,slug),core_planos(nome)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }),
    client.from("core_apps").select("id,nome,status,ordem").order("ordem"),
    client.from("core_planos").select("id,nome,app_id,core_apps(nome)").order("nome")
  ]);

  return {
    empresa: normalizeAdminRow(empresa.data ?? {}),
    vinculos: ((vinculos.data ?? []) as Array<Record<string, unknown>>).map(normalizeAdminRow),
    apps: toOptions((apps.data ?? []).filter((row: any) => String(row.status ?? "ativo") === "ativo")),
    planos: (planos.data ?? []).map((row: any) => ({
      value: row.id,
      label: `${relationName(row.core_apps) ? `${relationName(row.core_apps)} - ` : ""}${row.nome}`
    })),
    error: empresa.error?.message ?? vinculos.error?.message ?? apps.error?.message ?? planos.error?.message ?? null
  };
}

async function applyEmpresaFilters(client: any, query: any, filters: AdminFilters) {
  if (filters.categoria) {
    query = query.eq("categoria_id", filters.categoria);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.cidade) {
    query = query.ilike("cidade", `%${filters.cidade}%`);
  }

  if (filters.estado) {
    query = query.ilike("estado", `%${filters.estado}%`);
  }

  if (filters.q) {
    const search = filters.q.replaceAll("%", "").replaceAll(",", " ");
    query = query.or(`nome.ilike.%${search}%,nome_fantasia.ilike.%${search}%,cnpj.ilike.%${search}%,responsavel.ilike.%${search}%`);
  }

  if (filters.app) {
    const { data } = await client
      .from("core_empresa_apps")
      .select("empresa_id")
      .eq("app_id", filters.app);
    const ids = Array.from(new Set(((data ?? []) as Array<{ empresa_id: string }>).map((row) => row.empresa_id)));
    if (ids.length === 0) {
      return query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
    query = query.in("id", ids);
  }

  return query;
}

async function appendEmpresaApps(client: any, rows: Array<Record<string, unknown>>) {
  const ids = rows.map((row) => String(row.id ?? "")).filter(Boolean);
  if (ids.length === 0) return rows;

  const { data } = await client
    .from("core_empresa_apps")
    .select("empresa_id,status,core_apps(nome)")
    .in("empresa_id", ids);

  const byEmpresa = new Map<string, string[]>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const empresaId = String(row.empresa_id ?? "");
    const appName = relationName(row.core_apps);
    if (!empresaId || !appName) continue;
    const current = byEmpresa.get(empresaId) ?? [];
    current.push(`${appName} (${row.status})`);
    byEmpresa.set(empresaId, current);
  }

  return rows.map((row) => ({
    ...row,
    apps_contratados: (byEmpresa.get(String(row.id)) ?? []).join(", ") || "-"
  }));
}

async function appendUsuarioPermissoes(client: any, rows: Array<Record<string, unknown>>) {
  const ids = rows.map((row) => String(row.id ?? "")).filter(Boolean);
  if (ids.length === 0) return rows;

  const { data } = await client
    .from("core_usuario_app_permissoes")
    .select("usuario_id,status,perfil_app,core_apps(nome)")
    .in("usuario_id", ids);

  const byUsuario = new Map<string, string[]>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const usuarioId = String(row.usuario_id ?? "");
    const appName = relationName(row.core_apps);
    if (!usuarioId || !appName) continue;
    const current = byUsuario.get(usuarioId) ?? [];
    current.push(`${appName} - ${row.perfil_app} (${row.status})`);
    byUsuario.set(usuarioId, current);
  }

  return rows.map((row) => ({
    ...row,
    apps_permitidos: (byUsuario.get(String(row.id)) ?? []).join(", ") || "-"
  }));
}

async function appendAppCompanyCounts(client: any, rows: Array<Record<string, unknown>>) {
  const ids = rows.map((row) => String(row.id ?? "")).filter(Boolean);
  if (ids.length === 0) return rows;

  const { data } = await client
    .from("core_empresa_apps")
    .select("app_id")
    .in("app_id", ids);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const appId = String(row.app_id ?? "");
    counts.set(appId, (counts.get(appId) ?? 0) + 1);
  }

  return rows.map((row) => ({
    ...row,
    empresas_vinculadas: counts.get(String(row.id)) ?? 0
  }));
}

function normalizeAdminRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    categoria: relationName(row.core_empresa_categorias),
    empresa: relationName(row.core_empresas),
    usuario: relationName(row.core_usuarios),
    app: relationName(row.core_apps),
    plano: relationName(row.core_planos),
    cidade_uf: [row.cidade, row.estado].filter(Boolean).join("/") || "-"
  };
}

function relationObject(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === "object" ? (relation as Record<string, unknown>) : null;
}

function relationName(value: unknown) {
  const relation = relationObject(value);
  if (!relation) {
    return "";
  }

  if ("nome_fantasia" in relation && relation.nome_fantasia) {
    return String(relation.nome_fantasia);
  }

  if ("nome" in relation) {
    return String(relation.nome ?? "");
  }

  return "";
}

function toOptions(data: unknown) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((row: any) => ({
    value: row.id,
    label: row.nome_fantasia ?? row.nome
  }));
}

async function countRows(client: any, table: string, filters: Record<string, unknown> = {}) {
  let query = client.from(table).select("id", { count: "exact", head: true });
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { count } = await query;
  return count ?? 0;
}

async function countContractExpiringSoon(client: any, todayIso: string, soonIso: string) {
  const { count } = await client
    .from("core_empresa_apps")
    .select("id", { count: "exact", head: true })
    .in("status", ["ativo", "teste"])
    .gte("data_vencimento", todayIso)
    .lte("data_vencimento", soonIso);
  return count ?? 0;
}

function countByRelation(rows: unknown[], relationKey: string) {
  const counts = new Map<string, number>();
  for (const row of rows as Array<Record<string, unknown>>) {
    const name = relationName(row[relationKey]) || "Sem categoria";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([label, value]) => ({ label, value }));
}

function isActiveApp(app: Record<string, unknown>) {
  if ("status" in app) {
    return String(app.status ?? "ativo") === "ativo";
  }
  return app.ativo !== false;
}

export function isSuperAdminType(tipo: string) {
  return tipo === "super_admin" || tipo === "admin_master";
}

export function normalizeAppSlug(slug: string) {
  return slug === "mbacotacoes" ? "mba-cotacoes" : slug;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
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

function canAccessRequestedPath(path: string, profile: CoreProfile, appsLiberados: SharedAppAccess[]) {
  const pathname = path.split("?")[0] ?? path;

  if (pathname === "/" || pathname === "/login") {
    return false;
  }

  if (isSuperAdminType(profile.tipo)) {
    return (
      pathname === "/dashboard" ||
      pathname === "/selecionar-app" ||
      pathname === "/acesso-bloqueado" ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/apps") ||
      pathname.startsWith("/cotacoes") ||
      pathname.startsWith("/lavagestor")
    );
  }

  if (pathname === "/dashboard" || pathname === "/selecionar-app") {
    return true;
  }

  if (profile.tipo === "admin_empresa" && pathname.startsWith("/empresa")) {
    return true;
  }

  const requestedApp = getAppSlugFromPath(pathname);
  if (!requestedApp) {
    return false;
  }

  return appsLiberados.some((app) => normalizeAppSlug(app.slug) === requestedApp && app.canAccess);
}

function getAppSlugFromPath(path: string) {
  if (path === "/cotacoes" || path.startsWith("/cotacoes/")) {
    return "mba-cotacoes";
  }

  if (path === "/lavagestor" || path.startsWith("/lavagestor/")) {
    return "lavagestor";
  }

  if (path.startsWith("/apps/")) {
    return normalizeAppSlug(path.split("/")[2] ?? "");
  }

  return null;
}
