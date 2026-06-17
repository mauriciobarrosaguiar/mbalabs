import type { ChecklistTemplate } from "./checklist-types";
import { encontrarArea } from "./areas";

const documentosNecessarios = [
  "RG e CPF",
  "Certidao de casamento",
  "Certidao de nascimento dos filhos",
  "Comprovante de endereco",
  "Comprovante de renda",
  "Documentos dos bens",
  "Escritura de imovel",
  "Documento de veiculo",
  "Extratos bancarios, se necessario",
  "Comprovantes de despesas dos filhos",
  "Conversas/prints",
  "Boletim de ocorrencia, se houver",
  "Procuracao",
  "Contrato de honorarios",
];

const subareas = encontrarArea("Familia")?.subareas ?? [];

export const checklistFamilia: ChecklistTemplate[] = subareas.map(
  (subarea, index) => ({
    area: "Familia",
    subarea,
    titulo: `Checklist familia - ${subarea}`,
    descricao:
      "Documentos para confirmar vinculos familiares, renda, bens, despesas e provas sensiveis.",
    documentosNecessarios,
    obrigatorio: true,
    ordem: index + 1,
    statusInicial: "pendente",
  }),
);
