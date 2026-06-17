import { todosChecklists } from "@/data/lexgestor";
import type { ChecklistTemplate } from "@/data/lexgestor";
import { encontrarCategoria, normalizarCategoria } from "@/data/lexgestor/areas";

export function obterChecklistPorAreaSubarea(
  area: string,
  subarea?: string,
): ChecklistTemplate[] {
  const especificos = todosChecklists.filter((item) => {
    if (subarea) {
      return (
        normalizarCategoria(item.area) === normalizarCategoria(area) &&
        normalizarCategoria(item.subarea) === normalizarCategoria(subarea)
      );
    }

    return normalizarCategoria(item.area) === normalizarCategoria(area);
  });

  if (especificos.length > 0) {
    return especificos;
  }

  return montarChecklistPadrao(area, subarea);
}

export function calcularProgressoChecklist(
  total: number,
  concluidos: number,
) {
  if (total === 0) {
    return 0;
  }

  return Math.round((concluidos / total) * 100);
}

export function agruparChecklistsPorArea() {
  const grupos = todosChecklists.reduce<Record<string, ChecklistTemplate[]>>(
    (acc, item) => {
      acc[item.area] = acc[item.area] ? [...acc[item.area], item] : [item];
      return acc;
    },
    {},
  );

  return grupos;
}

export function montarChecklistPadrao(area: string, subarea?: string): ChecklistTemplate[] {
  const categoria = encontrarCategoria(area);
  const nomeArea = categoria?.nome ?? area;
  const nomeSubarea = subarea || categoria?.subareas[0] || "Atendimento inicial";

  return [
    {
      area: nomeArea,
      subarea: nomeSubarea,
      titulo: "Documentos pessoais",
      descricao: "Documento de identificacao, CPF/CNPJ e comprovante de endereco.",
      documentosNecessarios: ["Documento de identificacao", "CPF/CNPJ", "Comprovante de endereco"],
      obrigatorio: true,
      ordem: 1,
      statusInicial: "pendente",
    },
    {
      area: nomeArea,
      subarea: nomeSubarea,
      titulo: "Documentos do caso",
      descricao: "Contratos, decisoes, notificacoes, prints, fotos ou provas iniciais.",
      documentosNecessarios: ["Documento principal", "Provas iniciais", "Conversas ou prints"],
      obrigatorio: true,
      ordem: 2,
      statusInicial: "pendente",
    },
    {
      area: nomeArea,
      subarea: nomeSubarea,
      titulo: "Relato do cliente",
      descricao: "Resumo simples dos fatos, datas importantes e pedido do cliente.",
      documentosNecessarios: ["Relato assinado ou revisado", "Linha do tempo"],
      obrigatorio: true,
      ordem: 3,
      statusInicial: "pendente",
    },
  ];
}
