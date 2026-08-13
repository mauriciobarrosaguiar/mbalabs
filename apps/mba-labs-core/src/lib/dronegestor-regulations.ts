export type RegulatoryLevel = "federal" | "estadual" | "interno" | "insight";
export type RegulatoryApplicability = "automatic" | "review" | "informational";
export type RegulatoryDomain = "agro" | "anac" | "espaco_aereo" | "documental";

export type RegulatoryRule = {
  id: string;
  level: RegulatoryLevel;
  domain?: RegulatoryDomain;
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
    domain: "agro",
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
    domain: "documental",
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
    domain: "documental",
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
  },
  {
    id: "decea-ica-100-40-2026",
    level: "federal",
    domain: "espaco_aereo",
    title: "Acesso ao espaço aéreo — ICA 100-40 vigente",
    summary: "O acesso de aeronaves não tripuladas ao Espaço Aéreo Brasileiro deve observar a ICA 100-40 vigente do DECEA. A edição atual entrou em vigor em 01/07/2026 e substituiu a ICA 100-40/2023 e os antigos MCA 56-2/56-5.",
    sourceTitle: "DECEA — ICA 100-40, Aeronaves Não Tripuladas e o Acesso ao Espaço Aéreo Brasileiro",
    sourceUrl: "https://publicacoes.decea.mil.br/publicacao/ICA-100-40",
    effectiveFrom: "2026-07-01",
    verifiedAt: "2026-08-12",
    applicability: "review",
    blocksAutomatically: false,
    notes: ["O enquadramento e a necessidade/condições da solicitação dependem da operação pretendida. O DroneGestor não presume autorização apenas por existir cadastro."]
  },
  {
    id: "sarpas-sisant-precondition-2026",
    level: "federal",
    domain: "espaco_aereo",
    title: "SARPAS exige aeronave cadastrada com certificado SISANT",
    summary: "Para solicitar voos pelo SARPAS, o serviço oficial informa que a aeronave deve estar cadastrada no SARPAS com Certificado de Cadastro no SISANT da ANAC.",
    sourceTitle: "Gov.br / Comando da Aeronáutica — Solicitar autorização para voo de Aeronaves Remotamente Pilotadas",
    sourceUrl: "https://www.gov.br/pt-br/servicos/solicitar-autorizacao-para-voo-de-aeronaves-remotamente-pilotadas",
    verifiedAt: "2026-08-12",
    applicability: "review",
    blocksAutomatically: false,
    notes: ["O sistema mantém SISANT e SARPAS como documentos/estados separados para evitar confundir cadastro da aeronave com autorização de acesso ao espaço aéreo."]
  },
  {
    id: "anac-rbac100-10013b-exame",
    level: "federal",
    domain: "anac",
    title: "Exame teórico do piloto remoto",
    summary: "O RBAC 100 EMD 00 estabelece que todo piloto remoto de UA deve ter sido aprovado em exame de conhecimento teórico da ANAC.",
    sourceTitle: "ANAC — RBAC 100 EMD 00",
    sourceUrl: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/boletim-de-pessoal/2026/bps-v-21-no-24-15-a-19-06-2026/rbac-100-emd-00/visualizar_ato_normativo",
    sourceArticle: "100.13(b)",
    effectiveFrom: "2026-06-16",
    verifiedAt: "2026-08-12",
    applicability: "review",
    blocksAutomatically: false,
    notes: ["A Central de Documentos permite anexar o comprovante correspondente. A validação automática junto à ANAC ainda não está integrada."]
  },
  {
    id: "anac-rbac100-100301-cadastro",
    level: "federal",
    domain: "anac",
    title: "Cadastro/registro da aeronave não tripulada",
    summary: "Exceto UA de tipo certificado tratada pelo RAB, toda UA deve ser cadastrada junto à ANAC e vinculada a pessoa física ou jurídica. O cadastro previsto no RBAC 100 é válido por 24 meses.",
    sourceTitle: "ANAC — RBAC 100 EMD 00",
    sourceUrl: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/boletim-de-pessoal/2026/bps-v-21-no-24-15-a-19-06-2026/rbac-100-emd-00/visualizar_ato_normativo",
    sourceArticle: "100.301(b) e (c)",
    effectiveFrom: "2026-06-16",
    verifiedAt: "2026-08-12",
    applicability: "automatic",
    blocksAutomatically: false,
    notes: ["O DroneGestor registra a identificação ANAC e permite guardar a certidão SISANT, mas não renova cadastro automaticamente."]
  },
  {
    id: "anac-rbac100-1005-categorias",
    level: "federal",
    domain: "anac",
    title: "Categoria aberta depende das condições reais da operação",
    summary: "No RBAC 100, a categoria aberta exige UA com peso em voo de até 25 kg, VLOS/EVLOS, até 120 m AGL e área distante de terceiros. Fora dessas condições, a operação passa a exigir análise do enquadramento em categoria específica/certificada.",
    sourceTitle: "ANAC — RBAC 100 EMD 00",
    sourceUrl: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/boletim-de-pessoal/2026/bps-v-21-no-24-15-a-19-06-2026/rbac-100-emd-00/visualizar_ato_normativo",
    sourceArticle: "100.5(a)",
    effectiveFrom: "2026-06-16",
    verifiedAt: "2026-08-12",
    applicability: "review",
    blocksAutomatically: false,
    notes: [
      "Em área distante de terceiros, a UA não pode ficar a menos de 30 m horizontais de pessoa não envolvida e não anuente.",
      "Na categoria aberta, a avaliação de risco deve estar atualizada nos 12 meses prévios, salvo a hipótese em que a operação esteja a mais de 150 m horizontais de pessoas não envolvidas/não anuentes ou haja barreira mecânica suficientemente forte, caso em que a avaliação é facultativa."
    ]
  },
  {
    id: "anac-rbac100-10037-seguro",
    level: "federal",
    domain: "anac",
    title: "Seguro de danos a terceiros — verificar exceção agrícola",
    summary: "O RBAC 100 exige seguro com cobertura de danos a terceiros, mas prevê exceção para operações VLOS/EVLOS até 120 m AGL de aplicação de agrotóxicos e afins, adjuvantes, fertilizantes, inoculantes, corretivos e sementes sobre áreas desabitadas.",
    sourceTitle: "ANAC — RBAC 100 EMD 00",
    sourceUrl: "https://www.anac.gov.br/assuntos/legislacao/legislacao-1/boletim-de-pessoal/2026/bps-v-21-no-24-15-a-19-06-2026/rbac-100-emd-00/visualizar_ato_normativo",
    sourceArticle: "100.37",
    effectiveFrom: "2026-06-16",
    verifiedAt: "2026-08-12",
    applicability: "review",
    blocksAutomatically: false,
    notes: ["O DroneGestor não marca automaticamente a operação como isenta: a exceção depende de todas as condições do dispositivo estarem presentes."]
  }
];

export const STATE_RULES: Record<string, RegulatoryRule[]> = {
  GO: [
    {
      id: "go-19423-art11-aerea",
      level: "estadual",
      domain: "agro",
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
      domain: "agro",
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
      domain: "agro",
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
