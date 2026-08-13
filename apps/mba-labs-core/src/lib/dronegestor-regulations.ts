export type RegulatoryLevel = "federal" | "estadual" | "interno" | "insight";
export type RegulatoryApplicability = "automatic" | "review" | "informational";

export type RegulatoryRule = {
  id: string;
  level: RegulatoryLevel;
  uf?: string;
  title: string;
  summary: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceArticle?: string;
  effectiveFrom?: string;
  verifiedAt: string;
  minimumDistanceM?: number;
  applicability: RegulatoryApplicability;
  blocksAutomatically: boolean;
  notes?: string[];
};

export const FEDERAL_ARP_RULES: RegulatoryRule[] = [
  {
    id: "mapa-298-2021-art9-i",
    level: "federal",
    title: "Distância mínima federal para ARP",
    summary: "Aplicações aeroagrícolas com ARP devem observar, como regra federal geral, distância mínima de 20 m das áreas protegidas listadas na Portaria, quando não forem alvo da aplicação.",
    sourceTitle: "Portaria MAPA nº 298, de 22/09/2021",
    sourceUrl: "https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola/legislacao/portaria-mapa-298-de-22-09-2021.pdf",
    sourceArticle: "Art. 9º, I",
    effectiveFrom: "2021-10-01",
    verifiedAt: "2026-08-12",
    minimumDistanceM: 20,
    applicability: "automatic",
    blocksAutomatically: true,
    notes: [
      "A Portaria também manda respeitar restrições maiores previstas na legislação específica e na recomendação do produto.",
      "A exceção do art. 9º, II, para certos agentes biológicos/produtos fitossanitários da agricultura orgânica depende das condições expressas no próprio dispositivo; não é aplicada automaticamente pelo DroneGestor."
    ]
  },
  {
    id: "mapa-298-2021-art10",
    level: "federal",
    title: "Registro obrigatório de cada aplicação",
    summary: "O operador deve manter os dados de cada aplicação, incluindo horários, coordenadas, cultura, área, atividade, produto, volume/dose, altura, clima, identificação da ARP e ponta/atomizador.",
    sourceTitle: "Portaria MAPA nº 298, de 22/09/2021",
    sourceUrl: "https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola/legislacao/portaria-mapa-298-de-22-09-2021.pdf",
    sourceArticle: "Art. 10",
    effectiveFrom: "2021-10-01",
    verifiedAt: "2026-08-12",
    applicability: "automatic",
    blocksAutomatically: false,
    notes: ["Mapa de aplicação e, quando cabível, receituário agronômico devem permanecer anexados aos registros da operação."]
  },
  {
    id: "mapa-298-2021-art11",
    level: "federal",
    title: "Relatório mensal ao MAPA",
    summary: "As atividades do mês devem ser consolidadas com município/UF, ARP, área e horas, tipo de atividade, marca comercial, volume e dosagem aplicada.",
    sourceTitle: "Portaria MAPA nº 298, de 22/09/2021",
    sourceUrl: "https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/aviacao-agricola/legislacao/portaria-mapa-298-de-22-09-2021.pdf",
    sourceArticle: "Art. 11",
    effectiveFrom: "2021-10-01",
    verifiedAt: "2026-08-12",
    applicability: "automatic",
    blocksAutomatically: false,
    notes: ["O portal do MAPA informa que, em 2026, a remessa é feita por processo SEI do tipo Relatório Mensal Aviação Agrícola e utiliza a planilha oficial versão 01-01-2026."]
  }
];

export const STATE_RULES: Record<string, RegulatoryRule[]> = {
  GO: [
    {
      id: "go-19423-art11-aerea",
      level: "estadual",
      uf: "GO",
      title: "Goiás — distâncias para pulverização aérea",
      summary: "A Lei estadual vigente prevê 500 m de povoações, cidades, vilas, bairros e captação de água para abastecimento; e 250 m de mananciais de água, moradias isoladas e agrupamentos de animais para pulverização aérea.",
      sourceTitle: "Lei Estadual GO nº 19.423/2016, atualizada pela Lei nº 24.389/2026",
      sourceUrl: "https://legisla.casacivil.go.gov.br/pesquisa_legislacao/98740/lei-19423",
      sourceArticle: "Art. 11, I",
      verifiedAt: "2026-08-12",
      minimumDistanceM: 250,
      applicability: "review",
      blocksAutomatically: false,
      notes: [
        "A própria Lei estadual define 'pulverização por via aérea' como realizada por aviões, hidroaviões e helicópteros. Por isso, o DroneGestor NÃO aplica automaticamente esses 250/500 m a ARP sem confirmação da Agrodefesa/RT para o caso.",
        "A Lei nº 24.389/2026 alterou a Lei nº 19.423/2016; a fonte acima já apresenta a redação atualizada."
      ]
    }
  ],
  TO: [
    {
      id: "to-agrotoxico-cadastro",
      level: "estadual",
      uf: "TO",
      title: "Tocantins — legislação estadual de agrotóxicos",
      summary: "O Tocantins exige observância da legislação estadual para uso de agrotóxicos. Na verificação oficial feita para esta versão, não foi localizada uma distância estadual específica para ARP que pudesse ser aplicada automaticamente pelo sistema.",
      sourceTitle: "Portal de Serviços TO / ADAPEC — Lei nº 224/1990 e Decreto nº 4.793/1991",
      sourceUrl: "https://servicos.to.gov.br/servico_detalhado.aspx?cod_assunto_documento_tipo=8384",
      verifiedAt: "2026-08-12",
      applicability: "informational",
      blocksAutomatically: false,
      notes: ["Enquanto não houver regra estadual específica de ARP validada e versionada, permanece o piso federal e as restrições da bula/receita/órgãos competentes."]
    }
  ],
  MS: [
    {
      id: "ms-2951-2004",
      level: "estadual",
      uf: "MS",
      title: "Mato Grosso do Sul — legislação estadual de agrotóxicos",
      summary: "A Lei estadual nº 2.951/2004 disciplina uso, fiscalização e cadastro de agrotóxicos no MS. Nesta verificação não foi localizada fonte oficial suficiente para afirmar uma distância específica de 90 m para ARP como regra geral vigente.",
      sourceTitle: "Lei Estadual MS nº 2.951/2004 (base oficial do Estado)",
      sourceUrl: "https://aacpdappls.net.ms.gov.br/appls/legislacao/secoge/govato.nsf/1b758e65922af3e904256b220050342a/ec6ae0908cf1765e04256f7000484a15",
      verifiedAt: "2026-08-12",
      applicability: "informational",
      blocksAutomatically: false,
      notes: ["O DroneGestor não transforma relatos de campo sobre 90 m em obrigação legal. O ADMIN/RT pode manter margem interna superior sem rotulá-la como lei."]
    }
  ]
};

export function normalizeUf(value: unknown) {
  return String(value ?? "").trim().toUpperCase().slice(0, 2);
}

export function getRulesForUf(ufValue: unknown) {
  const uf = normalizeUf(ufValue);
  return {
    uf,
    federal: FEDERAL_ARP_RULES,
    state: STATE_RULES[uf] ?? [],
    federalMinimumM: 20,
    lastVerifiedAt: "2026-08-12"
  };
}
