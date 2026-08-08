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
    urlPath: "/lavagestor/operacao",
    alternatePaths: [
      { label: "Entrada operacional - /lavagestor/operacao", value: "/lavagestor/operacao" },
      { label: "Dashboard de gestão - /lavagestor/dashboard", value: "/lavagestor/dashboard" },
      { label: "App direto - /lavagestor", value: "/lavagestor" },
      { label: "Entrada compatível - /apps/lavagestor", value: "/apps/lavagestor" }
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
    urlPath: "/bikecomanda",
    alternatePaths: [
      { label: "App direto - /bikecomanda", value: "/bikecomanda" },
      { label: "Entrada compatível - /apps/bikecomanda", value: "/apps/bikecomanda" },
      { label: "Entrada compatível - /apps/bike-comanda", value: "/apps/bike-comanda" }
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
  },
  {
    slug: "conteudo-ia",
    name: "MBA Conteúdo IA",
    description: "Planejamento e criação inteligente de conteúdo para redes sociais, iniciando pelo TikTok.",
    urlPath: "/conteudo-ia",
    alternatePaths: [
      { label: "Entrada do portal - /apps/conteudo-ia", value: "/apps/conteudo-ia" },
      { label: "App direto - /conteudo-ia", value: "/conteudo-ia" }
    ],
    profileOptions: [
      { label: "Admin da empresa", value: "admin_empresa" },
      { label: "Estrategista", value: "estrategista" },
      { label: "Criador", value: "criador" },
      { label: "Aprovador", value: "aprovador" },
      { label: "Visualizador", value: "visualizador" }
    ]
  },
  {
    slug: "mba-escola",
    name: "MBA Escola",
    description: "Comunicação, atividades, reuniões e acompanhamento entre escola e famílias.",
    urlPath: "/mba-escola",
    alternatePaths: [{ label: "App direto - /mba-escola", value: "/mba-escola" }],
    profileOptions: [
      { label: "Admin da Escola", value: "admin_escola" },
      { label: "Direção", value: "direcao" },
      { label: "Coordenação", value: "coordenacao" },
      { label: "Professor", value: "professor" },
      { label: "Responsável", value: "responsavel" },
      { label: "Aluno", value: "aluno" }
    ]
  },
  {
    slug: "dronegestor",
    name: "DroneGestor Agro",
    description: "Copiloto de campo para planejamento, cálculos de pulverização, segurança, operação e relatórios de drones agrícolas.",
    urlPath: "/apps/dronegestor",
    alternatePaths: [
      { label: "Entrada do portal - /apps/dronegestor", value: "/apps/dronegestor" },
      { label: "Copiloto de campo - /apps/dronegestor/campo", value: "/apps/dronegestor/campo" }
    ],
    profileOptions: [
      { label: "Admin da empresa", value: "admin_empresa" },
      { label: "Gestor operacional", value: "gestor_operacional" },
      { label: "Responsável técnico", value: "responsavel_tecnico" },
      { label: "Piloto", value: "piloto" },
      { label: "Aplicador CAAR", value: "aplicador_caar" },
      { label: "Visualizador", value: "visualizador" }
    ]
  },
  {
    slug: "google-empresas",
    name: "Google Empresas",
    description: "Painel privado para cadastrar, autorizar, criar e verificar Perfis da Empresa no Google.",
    urlPath: "/google-empresas",
    alternatePaths: [{ label: "Painel privado - /google-empresas", value: "/google-empresas" }],
    profileOptions: [{ label: "Admin Master", value: "admin_master" }]
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
