import type { ChecklistTemplate } from "./checklist-types";
import { encontrarArea } from "./areas";

const documentosNecessarios = [
  "RG e CPF",
  "Carteira de trabalho",
  "Contrato de trabalho",
  "Holerites",
  "TRCT/rescisao",
  "Extrato FGTS",
  "Folha/cartao de ponto",
  "Escalas de trabalho",
  "Conversas de WhatsApp",
  "E-mails",
  "Atestados medicos",
  "CAT, se acidente",
  "Laudos",
  "Comprovante de pagamento",
  "Dados da empresa",
  "Procuracao",
  "Contrato de honorarios",
];

const subareas = encontrarArea("Trabalhista")?.subareas ?? [];

export const checklistTrabalhista: ChecklistTemplate[] = subareas.map(
  (subarea, index) => ({
    area: "Trabalhista",
    subarea,
    titulo: `Checklist trabalhista - ${subarea}`,
    descricao:
      "Provas de vinculo, jornada, pagamentos, saude ocupacional e comunicacoes de trabalho.",
    documentosNecessarios,
    obrigatorio: true,
    ordem: index + 1,
    statusInicial: "pendente",
  }),
);
