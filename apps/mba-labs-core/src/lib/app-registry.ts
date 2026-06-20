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
    slug: "portal-associativo",
    name: "Portal Associativo",
    description: "Gestao completa para associacoes, associados, unidades, cobrancas, reunioes, avisos, documentos e projetos.",
    urlPath: "/portal-associativo",
    alternatePaths: [
      { label: "Entrada do portal - /apps/portal-associativo", value: "/apps/portal-associativo" },
      { label: "App direto - /portal-associativo", value: "/portal-associativo" }
    ],
    profileOptions: [
      { label: "Administrador", value: "administrador" },
      { label: "Presidente", value: "presidente" },
      { label: "Tesoureiro", value: "tesoureiro" },
      { label: "Secretario", value: "secretario" },
      { label: "Conselho fiscal", value: "conselho_fiscal" },
      { label: "Associado", value: "associado" },
      { label: "Portaria", value: "portaria" }
    ]
  },
  {
    slug: "lexgestor",
    name: "LexGestor",
    description: "Gestão jurídica inteligente para escritórios de advocacia.",
    urlPath: "/lexgestor",
    alternatePaths: [
      { label: "Entrada do portal - /apps/lexgestor", value: "/apps/lexgestor" },
      { label: "App direto - /lexgestor", value: "/lexgestor" }
    ],
    profileOptions: [
      { label: "Dono do escritório", value: "dono" },
      { label: "Administrador", value: "administrador" },
      { label: "Advogado", value: "advogado" },
      { label: "Assistente", value: "assistente" },
      { label: "Financeiro/leitura", value: "financeiro_leitura" }
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
