export type SubcategoriaJuridica = {
  nome: string;
  ordem: number;
};

export type AreaJuridica = {
  nome: string;
  resumo: string;
  cor: "azul" | "verde" | "grafite";
  subareas: string[];
};

export type CategoriaJuridica = AreaJuridica & {
  ordem: number;
  subcategorias: SubcategoriaJuridica[];
};

const categoriasBase = [
  {
    nome: "Previdenciario",
    resumo: "Beneficios, INSS, revisoes e acidente de trabalho.",
    cor: "azul" as const,
    subareas: [
      "Auxilio-doenca",
      "Aposentadoria por idade",
      "Aposentadoria por tempo de contribuicao",
      "Aposentadoria rural",
      "BPC/LOAS",
      "Pensao por morte",
      "Revisao de beneficio",
      "Salario-maternidade",
      "Beneficio negado",
      "Acidente de trabalho",
    ],
  },
  {
    nome: "Criminal",
    resumo: "Defesa, inquerito, custodia, execucao penal e medidas urgentes.",
    cor: "grafite" as const,
    subareas: [
      "Inquerito policial",
      "Prisao em flagrante",
      "Audiencia de custodia",
      "Medida protetiva",
      "Acao penal",
      "Execucao penal",
      "Habeas corpus",
      "Crimes contra a honra",
      "Violencia domestica",
      "Trafico/posse de drogas",
    ],
  },
  {
    nome: "Familia",
    resumo: "Divorcio, guarda, alimentos, inventario e acordos familiares.",
    cor: "azul" as const,
    subareas: [
      "Divorcio consensual",
      "Divorcio litigioso",
      "Guarda",
      "Pensao alimenticia",
      "Revisao de alimentos",
      "Inventario",
      "Partilha de bens",
      "Uniao estavel",
      "Alienacao parental",
      "Adocao",
    ],
  },
  {
    nome: "Trabalhista",
    resumo: "Verbas, vinculo, acidente de trabalho e defesa em reclamacao.",
    cor: "verde" as const,
    subareas: [
      "Rescisao indireta",
      "Verbas rescisorias",
      "Horas extras",
      "FGTS",
      "Acidente de trabalho",
      "Vinculo empregaticio",
      "Assedio moral",
      "Adicional de insalubridade",
      "Adicional de periculosidade",
      "Reclamacao trabalhista",
    ],
  },
  {
    nome: "Tributario",
    resumo: "Execucao fiscal, CDA, divida ativa e defesa administrativa.",
    cor: "grafite" as const,
    subareas: [
      "Execucao fiscal",
      "CDA",
      "Defesa administrativa",
      "Parcelamento",
      "Divida ativa",
      "Auto de infracao",
      "Revisao tributaria",
      "Exclusao de imposto",
      "Compensacao tributaria",
      "Regularizacao fiscal",
    ],
  },
  {
    nome: "Civil",
    resumo: "Cobranca, indenizacao, contratos, danos e obrigacoes.",
    cor: "azul" as const,
    subareas: [
      "Cobranca",
      "Indenizacao",
      "Contratos",
      "Responsabilidade civil",
      "Obrigacao de fazer",
      "Obrigacao de nao fazer",
      "Danos morais",
      "Danos materiais",
      "Usucapiao",
      "Acao monitoria",
    ],
  },
  {
    nome: "Consumidor",
    resumo: "Produtos, servicos, bancos, plano de saude e compras online.",
    cor: "verde" as const,
    subareas: [
      "Produto com defeito",
      "Servico nao prestado",
      "Negativacao indevida",
      "Cobranca indevida",
      "Banco/cartao",
      "Plano de saude",
      "Energia/agua/internet",
      "Golpe/fraude",
      "Compra online",
      "Cancelamento de contrato",
    ],
  },
  {
    nome: "Empresarial",
    resumo: "Contratos, sociedade, cobranca empresarial e compliance simples.",
    cor: "grafite" as const,
    subareas: [
      "Contrato social",
      "Alteracao contratual",
      "Cobranca empresarial",
      "Recuperacao de credito",
      "Dissolucao societaria",
      "Distrato",
      "Notificacao extrajudicial",
      "Defesa empresarial",
      "Analise contratual",
      "Compliance simples",
    ],
  },
  {
    nome: "Bancario",
    resumo: "Consignado, juros, financiamento, fraude e revisional.",
    cor: "azul" as const,
    subareas: [
      "Emprestimo consignado",
      "Juros abusivos",
      "Cartao de credito",
      "Financiamento",
      "Busca e apreensao",
      "Fraude bancaria",
      "Conta bloqueada",
      "Desconto indevido",
      "Revisional",
      "Superendividamento",
    ],
  },
  {
    nome: "Imobiliario",
    resumo: "Compra e venda, locacao, despejo, posse e regularizacao.",
    cor: "verde" as const,
    subareas: [
      "Compra e venda",
      "Locacao",
      "Despejo",
      "Usucapiao",
      "Condominio",
      "Atraso de obra",
      "Regularizacao de imovel",
      "Contrato de aluguel",
      "Reintegracao de posse",
      "Escritura/registro",
    ],
  },
  {
    nome: "Outros",
    resumo: "Atendimento inicial, consulta, analise e demanda avulsa.",
    cor: "grafite" as const,
    subareas: [
      "Atendimento inicial",
      "Consulta avulsa",
      "Notificacao extrajudicial",
      "Analise de documento",
      "Outro tipo de caso",
    ],
  },
] satisfies AreaJuridica[];

export const categoriasJuridicas: CategoriaJuridica[] = categoriasBase.map(
  (categoria, index) => ({
    ...categoria,
    ordem: index + 1,
    subcategorias: categoria.subareas.map((nome, subIndex) => ({
      nome,
      ordem: subIndex + 1,
    })),
  }),
);

export const areasJuridicas: AreaJuridica[] = categoriasJuridicas.map(
  ({ nome, resumo, cor, subareas }) => ({ nome, resumo, cor, subareas }),
);

export function encontrarArea(nome: string) {
  return areasJuridicas.find((area) => normalizarCategoria(area.nome) === normalizarCategoria(nome));
}

export function encontrarCategoria(nome: string) {
  return categoriasJuridicas.find(
    (categoria) => normalizarCategoria(categoria.nome) === normalizarCategoria(nome),
  );
}

export function obterSubcategorias(categoriaNome: string) {
  return encontrarCategoria(categoriaNome)?.subcategorias ?? [];
}

export function normalizarCategoria(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
