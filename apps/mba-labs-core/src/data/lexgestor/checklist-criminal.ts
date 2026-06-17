import type { ChecklistTemplate } from "./checklist-types";
import { encontrarArea } from "./areas";

const documentosNecessarios = [
  "BO",
  "Copia do inquerito",
  "Auto de prisao em flagrante",
  "Mandado de prisao, se houver",
  "Decisao judicial",
  "Denuncia",
  "Intimacoes",
  "Certidoes criminais",
  "Comprovante de residencia",
  "Documentos pessoais",
  "Nome e contato de testemunhas",
  "Prints",
  "Videos",
  "Fotos",
  "Audios",
  "Procuracao",
  "Contrato de honorarios",
];

const subareas = encontrarArea("Criminal")?.subareas ?? [];

export const checklistCriminal: ChecklistTemplate[] = subareas.map(
  (subarea, index) => ({
    area: "Criminal",
    subarea,
    titulo: `Checklist criminal - ${subarea}`,
    descricao:
      "Documentos e provas para analise de risco, estrategia defensiva e providencias urgentes.",
    documentosNecessarios,
    obrigatorio: true,
    ordem: index + 1,
    statusInicial: "pendente",
  }),
);
