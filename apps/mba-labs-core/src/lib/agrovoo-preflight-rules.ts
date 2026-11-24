/** Não confunde ausência de anexos com falha de checklist operacional. */
export function agrovooSafetyChecklistReady(value: unknown): boolean {
  const checklist = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const safetyEntries = Object.entries(checklist).filter(([name]) => name !== "documentos");
  return safetyEntries.length > 0 && safetyEntries.every(([,checked]) => checked === true);
}
/** Documentos permanecem visíveis como pendências, mas não participam da regra de início. */
export function agrovooPreflightReady(items: ReadonlyArray<{id: string; ok: boolean}>): boolean {
  return items.length > 0 && items.filter((item) => item.id !== "documents").every((item) => item.ok);
}
export function agrovooNextBlockingStep(items: ReadonlyArray<{id: string; ok: boolean}>): string {
  return items.find((item) => item.id !== "documents" && !item.ok)?.id || "";
}
