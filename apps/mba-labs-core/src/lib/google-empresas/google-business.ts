import "server-only";
import { randomUUID } from "node:crypto";
import type { GoogleEmpresa } from "./data";
import { googleRequest } from "./google-client";
import { buildGoogleLocationPayload } from "./google-location-payload";

export async function listGoogleBusinessAccounts(accessToken: string) {
  const result = await googleRequest<{ accounts?: Array<Record<string, unknown>> }>(
    "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
    accessToken
  );
  return result.accounts ?? [];
}

export async function listGoogleBusinessLocations(accessToken: string, accountName: string) {
  const params = new URLSearchParams({
    readMask: "name,title,storeCode,storefrontAddress,phoneNumbers,categories,websiteUri,metadata,profile,serviceArea,regularHours",
    pageSize: "100"
  });
  const result = await googleRequest<{ locations?: Array<Record<string, any>> }>(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?${params.toString()}`,
    accessToken
  );
  return result.locations ?? [];
}

export async function searchGoogleBusinessLocations(accessToken: string, empresa: GoogleEmpresa) {
  const location = buildGoogleLocationPayload(empresa, empresa.google_categoria_id ?? undefined, false);
  const result = await googleRequest<{ googleLocations?: Array<Record<string, any>> }>(
    "https://mybusinessbusinessinformation.googleapis.com/v1/googleLocations:search",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ location, pageSize: 10 })
    }
  );
  return result.googleLocations ?? [];
}

export async function resolveGoogleBusinessCategory(accessToken: string, query: string) {
  const params = new URLSearchParams({
    regionCode: "BR",
    languageCode: "pt-BR",
    view: "FULL",
    pageSize: "20",
    filter: `displayName=${query}`
  });
  const result = await googleRequest<{ categories?: Array<Record<string, any>> }>(
    `https://mybusinessbusinessinformation.googleapis.com/v1/categories?${params.toString()}`,
    accessToken
  );
  const categories = result.categories ?? [];
  const normalizedQuery = normalizeText(query);
  return (
    categories.find((item) => normalizeText(String(item.displayName ?? "")) === normalizedQuery) ??
    categories[0] ??
    null
  );
}

export async function createGoogleBusinessLocation({
  accessToken,
  accountName,
  empresa,
  categoryId
}: {
  accessToken: string;
  accountName: string;
  empresa: GoogleEmpresa;
  categoryId: string;
}) {
  const requestId = randomUUID();
  const payload = buildGoogleLocationPayload(empresa, categoryId, true);
  return googleRequest<Record<string, any>>(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?requestId=${requestId}`,
    accessToken,
    { method: "POST", body: JSON.stringify(payload) }
  );
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
