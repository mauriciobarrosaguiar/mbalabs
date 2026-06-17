export type ChecklistStatusInicial = "pendente";

export type ChecklistTemplate = {
  area: string;
  subarea: string;
  titulo: string;
  descricao: string;
  documentosNecessarios: string[];
  obrigatorio: boolean;
  ordem: number;
  statusInicial: ChecklistStatusInicial;
};
