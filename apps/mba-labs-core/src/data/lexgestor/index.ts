import { checklistCriminal } from "./checklist-criminal";
import { checklistFamilia } from "./checklist-familia";
import { checklistPrevidenciario } from "./checklist-previdenciario";
import { checklistTrabalhista } from "./checklist-trabalhista";
import { checklistTributario } from "./checklist-tributario";

export { areasJuridicas } from "./areas";
export type { AreaJuridica } from "./areas";
export type { ChecklistTemplate } from "./checklist-types";

export const todosChecklists = [
  ...checklistPrevidenciario,
  ...checklistCriminal,
  ...checklistFamilia,
  ...checklistTrabalhista,
  ...checklistTributario,
];
