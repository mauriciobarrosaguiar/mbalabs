export function resolvePharmacyFilter(
  requested: string | null | undefined,
  pharmacies: ReadonlyArray<{ id: string; tenantId: string }>,
  tenantId?: string,
) {
  if (!requested) return { kind: "all" } as const;
  const unit = pharmacies.find((pharmacy) =>
    pharmacy.id === requested && (!tenantId || pharmacy.tenantId === tenantId),
  );
  return unit
    ? { kind: "unit", id: unit.id, tenantId: unit.tenantId } as const
    : { kind: "invalid" } as const;
}

export function matchesPharmacyFilter(
  quotation: { pharmacyId?: string; tenantId: string },
  filter: ReturnType<typeof resolvePharmacyFilter>,
) {
  return filter.kind === "all" || (filter.kind === "unit" &&
    quotation.pharmacyId === filter.id && quotation.tenantId === filter.tenantId);
}
