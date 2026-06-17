import type { ChecklistTemplate } from "./checklist-types";
import { encontrarArea } from "./areas";

const documentosNecessarios = [
  "RG e CPF",
  "Comprovante de endereco",
  "CNIS",
  "Carteira de trabalho",
  "Carnes/guias de contribuicao",
  "Extrato Meu INSS",
  "Carta de concessao",
  "Indeferimento do INSS",
  "Laudos medicos",
  "Exames",
  "PPP",
  "LTCAT",
  "Documentos rurais, se for rural",
];

const subareas = encontrarArea("Previdenciario")?.subareas ?? [];

export const checklistPrevidenciario: ChecklistTemplate[] = subareas.map(
  (subarea, index) => ({
    area: "Previdenciario",
    subarea,
    titulo: `Checklist previdenciario - ${subarea}`,
    descricao:
      "Documentos iniciais para triagem, prova de vinculos, beneficios e historico junto ao INSS.",
    documentosNecessarios,
    obrigatorio: true,
    ordem: index + 1,
    statusInicial: "pendente",
  }),
);
