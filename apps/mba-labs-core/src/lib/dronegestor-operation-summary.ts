/** Labels describe the persisted OS status; navigation never implies execution. */
export function droneOperationStatusLabel(status: unknown, closure?: unknown): string {
  switch (status) {
    case "aberta": return "OS aberta — aplicação não iniciada";
    case "preparacao":
    case "em_preparacao": return "Em preparação — aplicação não iniciada";
    case "em_execucao": return "Operação em andamento";
    case "suspensa": return "Operação suspensa";
    case "campo_concluido": return closure === "pronto" ? "Pronta para encerrar" : "Campo concluído - regularização";
    case "concluida": return "OS encerrada";
    case "cancelada": return "OS cancelada — somente consulta";
    default: return "Situação não informada";
  }
}

/** Planned area is never evidence of application. Explicit zero stays zero. */
export function droneAppliedArea(progress: unknown, archivedProgress?: unknown): number {
  const value = progress === undefined || progress === null ? archivedProgress : progress;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
