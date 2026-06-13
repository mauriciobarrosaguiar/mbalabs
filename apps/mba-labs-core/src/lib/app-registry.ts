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
    name: "MBA Cotacoes",
    description: "Sistema de cotacoes, vendedores, respostas e pedidos.",
    urlPath: "/apps/mbacotacoes",
    alternatePaths: [
      { label: "Entrada do portal - /apps/mbacotacoes", value: "/apps/mbacotacoes" },
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
    description: "Sistema para gestao de lava-jatos, lavagens, vales e comissoes.",
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
  }
];

export const internalAppSlugOptions = internalApps.map((app) => ({
  label: `${app.name} (${app.slug})`,
  value: app.slug
}));

export const internalAppRouteOptions = internalApps.flatMap((app) => app.alternatePaths);

export function normalizeRegistrySlug(slug: string) {
  return slug === "mbacotacoes" ? "mba-cotacoes" : slug;
}

export function getInternalAppBySlug(slug: string) {
  const normalizedSlug = normalizeRegistrySlug(slug);
  return internalApps.find((app) => app.slug === normalizedSlug) ?? null;
}

export function getProfileOptionsForAppSlug(slug: string) {
  return getInternalAppBySlug(slug)?.profileOptions ?? [];
}
