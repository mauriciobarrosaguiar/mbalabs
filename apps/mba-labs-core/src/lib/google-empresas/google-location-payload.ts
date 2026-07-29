import type { GoogleEmpresa } from "./data";

export function buildGoogleLocationPayload(empresa: GoogleEmpresa, categoryId?: string, includeRequiredProfile = true) {
  const fallbackDescription = `${empresa.nome} oferece atendimento em ${empresa.cidade || "sua região"}.`;
  const description = (empresa.descricao?.trim() || fallbackDescription).slice(0, 750);
  const location: Record<string, unknown> = {
    languageCode: "pt-BR",
    storeCode: `mba-${empresa.id.slice(0, 12)}`,
    title: empresa.nome.trim(),
    phoneNumbers: empresa.telefone ? { primaryPhone: empresa.telefone } : undefined,
    websiteUri: empresa.site || undefined,
    categories: categoryId ? { primaryCategory: { name: categoryId } } : undefined,
    profile: includeRequiredProfile ? { description } : undefined,
    openInfo: empresa.data_abertura
      ? {
          status: "OPEN",
          openingDate: parseOpeningDate(empresa.data_abertura)
        }
      : undefined,
    regularHours: buildRegularHours(empresa.horario_regular)
  };

  if (empresa.tipo_atendimento !== "area_servico") {
    location.storefrontAddress = buildPostalAddress(empresa);
  }

  if (empresa.tipo_atendimento === "area_servico") {
    location.serviceArea = { businessType: "CUSTOMER_LOCATION_ONLY", regionCode: "BR" };
  }

  if (empresa.tipo_atendimento === "hibrido") {
    location.serviceArea = { businessType: "CUSTOMER_AND_BUSINESS_LOCATION", regionCode: "BR" };
  }

  return removeUndefined(location);
}

export function buildPostalAddress(empresa: GoogleEmpresa) {
  return removeUndefined({
    regionCode: empresa.pais || "BR",
    languageCode: "pt-BR",
    postalCode: empresa.cep || undefined,
    administrativeArea: empresa.estado || undefined,
    locality: empresa.cidade || undefined,
    addressLines: [empresa.endereco_linha1, empresa.endereco_linha2, empresa.bairro].filter(Boolean)
  });
}

function buildRegularHours(value: Record<string, unknown> | null | undefined) {
  if (!value || typeof value !== "object") return undefined;
  const periods: Array<Record<string, unknown>> = [];

  for (const [day, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (item.closed === true || !item.open || !item.close) continue;
    periods.push({
      openDay: day,
      openTime: parseTime(String(item.open)),
      closeDay: day,
      closeTime: parseTime(String(item.close))
    });
  }

  return periods.length ? { periods } : undefined;
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map((item) => Number(item));
  return { hours: Number.isFinite(hours) ? hours : 0, minutes: Number.isFinite(minutes) ? minutes : 0 };
}

function parseOpeningDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map((item) => Number(item));
  return removeUndefined({ year, month, day });
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}
