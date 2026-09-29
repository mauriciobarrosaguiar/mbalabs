const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function quotationDeadlineToIso(value?: string | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const date = DATE_ONLY.test(normalized)
    ? new Date(`${normalized}T23:59:59.999-03:00`)
    : new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error("Data limite da cotação inválida.");
  return date.toISOString();
}

export function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
