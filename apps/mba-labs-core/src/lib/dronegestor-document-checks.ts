/** Detect explicit homologation/mock identifiers, never official evidence. */
export function isExplicitHomologationPlaceholder(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  return /(?:\bHOMOLOGACAO\b|\bFICTICIO\b|\bDEMONSTRACAO\b|\bNAO[-_ ]+UTILIZAR\b|\bSEM[-_ ]+REGISTRO[-_ ]+REAL\b)/.test(normalized);
}

/** A non-placeholder ANAC string is only a declaration, not official verification. */
export function hasNonPlaceholderAnacId(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 && !isExplicitHomologationPlaceholder(value);
}
