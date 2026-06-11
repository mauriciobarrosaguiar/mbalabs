import { redirect } from "next/navigation";
import { getSupabaseServer } from "./supabase";

export type CoreProfile = {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  empresa_id: string | null;
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
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return { user: null, profile: null, error: null };
    }

    const { data: profile, error } = await supabase
      .from("core_usuarios")
      .select("id,nome,email,tipo,empresa_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) {
      return { user, profile: null, error: error.message };
    }

    return { user, profile: profile as CoreProfile | null, error: null };
  } catch (error) {
    return {
      user: null,
      profile: null,
      error: error instanceof Error ? error.message : "Erro ao conectar no Supabase."
    };
  }
}

export async function requireSessionProfile() {
  const context = await getSessionProfile();

  if (!context.user) {
    redirect("/login");
  }

  if (!context.profile) {
    redirect("/setup-admin");
  }

  return {
    user: context.user,
    profile: context.profile
  };
}

export async function getDashboardData() {
  const { profile } = await requireSessionProfile();
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

  const { data: assinaturas } = await client
    .from("core_assinaturas")
    .select("status,app_id,core_apps(slug)")
    .eq("empresa_id", profile.empresa_id)
    .in("status", ["ativa", "teste"]);

  const activeBySlug = new Map<string, string>();
  for (const assinatura of assinaturas ?? []) {
    const slug = assinatura.core_apps?.slug;
    if (slug) {
      activeBySlug.set(slug, assinatura.status);
    }
  }

  return {
    profile,
    apps: apps.map((app: any) => {
      const status = activeBySlug.get(app.slug);
      return {
        slug: app.slug,
        nome: app.nome,
        descricao: app.descricao ?? "Sistema MBA Labs.",
        url_path: app.url_path ?? `/${app.slug}`,
        status: (status ?? "bloqueada") as SystemCard["status"],
        canAccess: Boolean(status)
      };
    }) as SystemCard[],
    error: null
  };
}

const adminResources = {
  empresas: {
    table: "core_empresas",
    title: "Empresas",
    columns: ["nome", "nome_fantasia", "cnpj", "email", "status", "created_at"]
  },
  usuarios: {
    table: "core_usuarios",
    title: "Usuarios",
    columns: ["nome", "email", "tipo", "status", "empresa_id", "created_at"]
  },
  apps: {
    table: "core_apps",
    title: "Apps",
    columns: ["slug", "nome", "url_path", "ativo", "ordem", "created_at"]
  },
  planos: {
    table: "core_planos",
    title: "Planos",
    columns: ["nome", "valor_mensal", "limite_usuarios", "ativo", "created_at"]
  },
  assinaturas: {
    table: "core_assinaturas",
    title: "Assinaturas",
    columns: ["empresa_id", "app_id", "status", "inicio", "vencimento", "created_at"]
  },
  pagamentos: {
    table: "core_pagamentos",
    title: "Pagamentos",
    columns: ["empresa_id", "valor", "vencimento", "pagamento_em", "status", "created_at"]
  },
  logs: {
    table: "core_logs",
    title: "Logs",
    columns: ["empresa_id", "usuario_id", "app_slug", "acao", "created_at"]
  }
} as const;

export type AdminResource = keyof typeof adminResources;

export function getAdminResource(resource: string) {
  return adminResources[resource as AdminResource];
}

export async function getAdminRows(resource: AdminResource) {
  const { profile } = await requireSessionProfile();

  if (!["admin_master", "admin_empresa"].includes(profile.tipo)) {
    redirect("/dashboard");
  }

  const config = adminResources[resource];
  const supabase = await getSupabaseServer();
  const { data, error } = await (supabase as any)
    .from(config.table)
    .select(config.columns.join(","))
    .limit(50);

  return {
    profile,
    config,
    rows: (data ?? []) as Array<Record<string, unknown>>,
    error: error?.message ?? null
  };
}
