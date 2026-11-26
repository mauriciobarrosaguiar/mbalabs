export type AgroVooBoardOrder = {
  stage: string;
  numero: string;
  cliente: string;
  fazenda: string;
  talhao: string;
  pilotName: string;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function filterAgroVooOrders<T extends AgroVooBoardOrder>(orders: T[], query: string, stageFilter: string): T[] {
  const text = normalize(query);
  return orders.filter(os => {
    const matchesStage = stageFilter === "todas" || (stageFilter === "ativas" ? !["encerrada", "cancelada"].includes(os.stage) : os.stage === stageFilter);
    const matchesText = !text || [os.numero, os.cliente, os.fazenda, os.talhao, os.pilotName].some(value => normalize(String(value || "")).includes(text));
    return matchesStage && matchesText;
  });
}

export function paginateAgroVooOrders<T>(items: T[], page: number, pageSize: number) {
  const size = [10, 25, 50].includes(pageSize) ? pageSize : 10;
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const currentPage = Math.max(0, Math.min(Number.isFinite(page) ? Math.floor(page) : 0, totalPages - 1));
  return { totalPages, currentPage, visibleOrders: items.slice(currentPage * size, (currentPage + 1) * size) };
}
