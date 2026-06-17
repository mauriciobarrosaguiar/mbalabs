import type { ChecklistTemplate } from "./checklist-types";
import { encontrarArea } from "./areas";

const documentosNecessarios = [
  "CPF/CNPJ",
  "Contrato social",
  "Cartao CNPJ",
  "Inscricao estadual/municipal",
  "CDA",
  "Notificacao fiscal",
  "Auto de infracao",
  "Processo administrativo",
  "Comprovantes de pagamento",
  "Guias DARF/GNRE/DAS",
  "Notas fiscais",
  "SPED",
  "DCTF",
  "PGDAS",
  "Extratos da divida ativa",
  "Balancos/balancetes",
  "Procuracao",
  "Contrato de honorarios",
];

const subareas = encontrarArea("Tributario")?.subareas ?? [];

export const checklistTributario: ChecklistTemplate[] = subareas.map(
  (subarea, index) => ({
    area: "Tributario",
    subarea,
    titulo: `Checklist tributario - ${subarea}`,
    descricao:
      "Documentos fiscais, societarios, contabeis e processuais para analise tributaria.",
    documentosNecessarios,
    obrigatorio: true,
    ordem: index + 1,
    statusInicial: "pendente",
  }),
);
