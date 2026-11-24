/** Folder presentation for attachments. This does not change their stored type. */
export const agroDocFolders = [
  { label: "Todos", types: [] },
  { label: "Relatórios operacionais", types: ["relatorio_mapa", "relatorio_operacional"] },
  { label: "Comprovantes", types: ["sarpas_autorizacao", "sisant_certidao", "registro_mapa", "seguro", "exame_piloto_anac"] },
  { label: "Mapas de aplicação", types: ["mapa_aplicacao"] },
  { label: "Receituários agronômicos", types: ["receituario"] },
  { label: "Avaliações de risco", types: ["avaliacao_risco"] },
  { label: "Fotos e evidências", types: ["foto", "video"] },
  { label: "Histórico de voo", types: ["historico_voo"] },
  { label: "Outros documentos", types: ["outro"] },
] as const;

export function attachmentsInFolder<T extends { tipo: string }>(
  docs: readonly T[],
  folder: (typeof agroDocFolders)[number],
): T[] {
  return folder.label === "Todos" ? [...docs] : docs.filter((doc) => (folder.types as readonly string[]).includes(doc.tipo));
}
