export const customerTypeLabels: Record<string, string> = {
  pharmacy: "Farmácia",
  distributor_bidding: "Distribuidora / Licitação",
  both: "Ambos",
};

export const statusLabels: Record<string, string> = {
  test: "Teste",
  teste: "Teste",
  active: "Ativo",
  ativo: "Ativo",
  suspended: "Suspenso",
  suspenso: "Suspenso",
  canceled: "Cancelado",
  cancelado: "Cancelado",
  inactive: "Inativo",
  inativo: "Inativo",
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  refunded: "Reembolsado",
  submitted: "Enviada",
  opened: "Aberta",
  draft: "Rascunho",
  open: "Aberta",
  waiting_responses: "Aguardando respostas",
  analyzing: "Em andamento",
  finished: "Finalizada",
  generated: "Gerado",
  pedido_gerado: "Gerado",
  excluida: "Excluída",
  deleted: "Excluída",
  sent: "Enviado",
  confirmed: "Faturado",
  winner: "Vencedor",
  partial: "Parcial",
  tie_manual: "Empate - decisão manual",
  gerado: "Gerado",
  enviado_ao_vendedor: "Enviado ao vendedor",
  enviado: "Enviado",
  aberto_pelo_vendedor: "Aberto pelo vendedor",
  em_conferencia: "Em conferência",
  finalizado_pelo_vendedor: "Faturado",
  parcialmente_faturado: "Parcial",
  nao_faturado: "Não faturado",
  a_faturar: "A faturar",
  faturado: "Faturado",
  parcial: "Parcial",
  pendente: "Pendente",
  enviado_para_proximo: "Reenviado para próximo",
  nova_cotacao_criada: "Nova cotação criada",
  resolvido: "Resolvido",
  atendido_total: "Atendido total",
  atendido_parcial: "Atendido parcial",
  falta_parcial: "Falta parcial",
  nao_atendido: "Não atendido",
  aguardando_respostas: "Aguardando respostas",
  sem_resposta: "Sem resposta",
  saldo_pendente: "Saldo pendente",
  marca_incompativel: "Marca incompatível",
  unidade_incompativel: "Unidade incompatível",
  preco_suspeito: "Preço suspeito",
  atingiu: "Atingiu",
  "não atingiu": "Não atingiu",
  "nao atingiu": "Não atingiu",
  atenção: "Atenção",
  atencao: "Atenção",
};

export const quotationStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  open: "Aberta",
  waiting_responses: "Aguardando respostas",
  analyzing: "Em andamento",
  finished: "Finalizada",
  gerado: "Gerado",
  generated: "Gerado",
  pedido_gerado: "Gerado",
  canceled: "Cancelada",
  excluida: "Excluída",
  deleted: "Excluída",
};

export const productTypeLabels: Record<string, string> = {
  generico: "Genérico",
  similar: "Similar",
  etico: "Ético",
  generico_similar: "Genérico/Similar",
  mip: "MIP",
  perfumaria: "Perfumaria",
  controlado: "Controlado",
  hospitalar: "Hospitalar",
  qualquer: "Qualquer",
  outros: "Outros",
};

export const judgmentTypeLabels: Record<string, string> = {
  by_item: "Por item",
  by_lot: "Por lote",
  global: "Global",
};

export const unitLabels: Record<string, string> = {
  CP: "Comprimido",
  CAP: "Cápsula",
  AMP: "Ampola",
  FR: "Frasco",
  BIS: "Bisnaga",
  SACHE: "Sachê",
  FLAC: "Flaconete",
  ML: "Mililitro",
  G: "Grama",
  KG: "Quilograma",
  DOSE: "Dose",
  UN: "Unidade",
  CX: "Caixa",
};

export const pharmaceuticalFormLabels: Record<string, string> = {
  comprimido: "Comprimido",
  capsula: "Cápsula",
  solucao_oral: "Solução oral",
  suspensao: "Suspensão",
  ampola: "Ampola",
  frasco: "Frasco",
  creme: "Creme",
  pomada: "Pomada",
  gel: "Gel",
  gotas: "Gotas",
  injetavel: "Injetável",
  outro: "Outro",
};

export const supplierTypeLabels: Record<string, string> = {
  vendedor: "Vendedor",
  distribuidora: "Distribuidora",
  laboratorio: "Laboratório",
  marketplace: "Marketplace",
  outro: "Outro",
};

export const laboratoryTypeLabels: Record<string, string> = {
  laboratorio: "Laboratório",
  marca: "Marca",
  fabricante: "Fabricante",
};

export const userRoleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN_EMPRESA: "Administrador da empresa",
  COMPRADOR: "Comprador",
  CONFERENTE: "Conferente",
  FINANCEIRO: "Financeiro",
  VENDEDOR_EXTERNO: "Vendedor externo",
  FARMACIA_ADMIN: "Administrador farmácia",
  LICITACAO_ADMIN: "Administrador licitação",
  DISTRIBUIDORA: "Distribuidora",
  VENDEDOR: "Vendedor",
};

export function labelFrom(map: Record<string, string>, value?: string | null) {
  if (!value) return "-";
  return map[value] ?? value;
}
