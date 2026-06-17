export type AppRegistryOption = {
  label: string;
  value: string;
};

export type InternalAppDefinition = {
  slug: string;
  name: string;
  description: string;
  urlPath: string;
  alternatePaths: AppRegistryOption[];
  profileOptions: AppRegistryOption[];
};

export const internalApps: InternalAppDefinition[] = [
  {
    slug: "mba-cotacoes",
    name: "MBA Cotações",
    description: "Sistema para cotações, vendedores, respostas e pedidos.",
    urlPath: "/apps/mbacotacoes",
    alternatePaths: [
      { label: "Entrada do portal - /apps/mbacotacoes", value: "/apps/mbacotacoes" },
      { label: "Entrada do portal - /apps/mba-cotacoes", value: "/apps/mba-cotacoes" },
      { label: "App direto - /cotacoes", value: "/cotacoes" }
    ],
    profileOptions: [
      { label: "Admin da empresa", value: "admin_empresa" },
      { label: "Comprador", value: "comprador" },
      { label: "Vendedor", value: "vendedor" },
      { label: "Visualizador", value: "visualizador" }
    ]
  },
  {
    slug: "lavagestor",
    name: "LavaGestor",
    description: "Sistema para lava-jatos controlarem lavagens, clientes, funcionários, pagamentos e comissões.",
    urlPath: "/apps/lavagestor",
    alternatePaths: [
      { label: "Entrada do portal - /apps/lavagestor", value: "/apps/lavagestor" },
      { label: "App direto - /lavagestor", value: "/lavagestor" }
    ],
    profileOptions: [
      { label: "Admin da empresa", value: "admin_empresa" },
      { label: "Dono", value: "dono" },
      { label: "Gerente", value: "gerente" },
      { label: "Lavador", value: "lavador" },
      { label: "Caixa", value: "caixa" },
      { label: "Visualizador", value: "visualizador" }
    ]
  },
  {
    slug: "bikecomanda",
    name: "BikeComanda",
    description: "Sistema de comandas para bicicletarias, serviços, pagamentos e comissões.",
    urlPath: "/apps/bikecomanda",
    alternatePaths: [
      { label: "Entrada do portal - /apps/bikecomanda", value: "/apps/bikecomanda" },
      { label: "Entrada do portal - /apps/bike-comanda", value: "/apps/bike-comanda" },
      { label: "App direto - /bikecomanda", value: "/bikecomanda" }
    ],
    profileOptions: [
      { label: "Admin da empresa", value: "admin_empresa" },
      { label: "Dono", value: "dono" },
      { label: "Atendente", value: "atendente" },
      { label: "Mecânico", value: "mecanico" },
      { label: "Caixa", value: "caixa" },
      { label: "Visualizador", value: "visualizador" }
    ]
  },
  {
    slug: "lexgestor",
    name: "LexGestor",
    description: "Gestao juridica inteligente para escritorios de advocacia.",
    urlPath: "/lexgestor",
    alternatePaths: [
      { label: "Entrada do portal - /apps/lexgestor", value: "/apps/lexgestor" },
      { label: "App direto - /lexgestor", value: "/lexgestor" }
    ],
    profileOptions: [
      { label: "Admin da empresa", value: "admin_empresa" },
      { label: "Advogado responsavel", value: "advogado" },
      { label: "Assistente juridico", value: "assistente" },
      { label: "Visualizador", value: "visualizador" }
    ]
  }
];

export const internalAppSlugOptions = internalApps.map((app) => ({
  label: `${app.name} (${app.slug})`,
  value: app.slug
}));

export const internalAppRouteOptions = internalApps.flatMap((app) => app.alternatePaths);

export function normalizeRegistrySlug(slug: string) {
  if (slug === "mbacotacoes") return "mba-cotacoes";
  if (slug === "bike-comanda") return "bikecomanda";
  if (slug === "lex-gestor") return "lexgestor";
  return slug;
}

export function getInternalAppBySlug(slug: string) {
  const normalizedSlug = normalizeRegistrySlug(slug);
  return internalApps.find((app) => app.slug === normalizedSlug) ?? null;
}

export function getProfileOptionsForAppSlug(slug: string) {
  return getInternalAppBySlug(slug)?.profileOptions ?? [];
}
