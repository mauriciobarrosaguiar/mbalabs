/** Return false for missing ANAC IDs or explicit homologation placeholders.
 * A non-placeholder string is only a provided identifier, not proof of a
 * valid SISANT certificate or DECEA authorization.
 */
export function hasNonPlaceholderAnacId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  if (!normalized) return false;
  return !/(?:\bHOMOLOGACAO\b|\bFICTICIO\b|\bDEMONSTRACAO\b|\bNAO[-_ ]+UTILIZAR\b|\bSEM[-_ ]+REGISTRO[-_ ]+REAL\b)/.test(normalized);
}
