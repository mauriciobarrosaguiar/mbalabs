import "server-only";
import { randomUUID } from "node:crypto";
import type { GoogleEmpresa } from "./data";

const BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";

export type GoogleOAuthTokens = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export function getGoogleBusinessOAuthConfig() {
  const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_CORE_URL ??
    "https://www.mbalabs.com.br"
  ).replace(/\/$/, "");

  if (!clientId || !clientSecret) {
    throw new Error("Configure GOOGLE_BUSINESS_CLIENT_ID e GOOGLE_BUSINESS_CLIENT_SECRET na Vercel.");
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${baseUrl}/api/google-empresas/oauth/callback`
  };
}

export function buildGoogleBusinessAuthorizationUrl({ state, loginHint }: { state: string; loginHint?: string | null }) {
  const config = getGoogleBusinessOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    scope: ["openid", "email", "profile", BUSINESS_SCOPE].join(" "),
    state
  });

  if (loginHint) params.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleBusinessCode(code: string): Promise<GoogleOAuthTokens> {
  const config = getGoogleBusinessOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });

  return readGoogleResponse<GoogleOAuthTokens>(response, "Não foi possível concluir a autorização do Google.");
}

export async function refreshGoogleBusinessAccessToken(refreshToken: string): Promise<GoogleOAuthTokens> {
  const config = getGoogleBusinessOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token"
    }),
    cache: "no-store"
  });

  return readGoogleResponse<GoogleOAuthTokens>(response, "Não foi possível renovar a autorização do Google.");
}

export async function fetchGoogleUserInfo(accessToken: string) {
  return googleRequest<Record<string, unknown>>("https://openidconnect.googleapis.com/v1/userinfo", accessToken);
}

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

export async function fetchGoogleVerificationOptions(accessToken: string, locationName: string, empresa?: GoogleEmpresa) {
  const body: Record<string, unknown> = { languageCode: "pt-BR" };

  if (empresa?.tipo_atendimento === "area_servico" && empresa.endereco_linha1) {
    body.context = {
      address: buildPostalAddress(empresa)
    };
  }

  const result = await googleRequest<{ options?: Array<Record<string, any>> }>(
    `https://mybusinessverifications.googleapis.com/v1/${locationName}:fetchVerificationOptions`,
    accessToken,
    { method: "POST", body: JSON.stringify(body) }
  );
  return result.options ?? [];
}

export async function startGoogleBusinessVerification({
  accessToken,
  locationName,
  method,
  emailUserName,
  phoneNumber
}: {
  accessToken: string;
  locationName: string;
  method: string;
  emailUserName?: string;
  phoneNumber?: string;
}) {
  const body: Record<string, unknown> = { method, languageCode: "pt-BR" };
  if (emailUserName) body.emailInput = { emailAddress: emailUserName };
  if (phoneNumber) body.phoneInput = { phoneNumber };

  return googleRequest<Record<string, any>>(
    `https://mybusinessverifications.googleapis.com/v1/${locationName}:verify`,
    accessToken,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export async function completeGoogleBusinessVerification(accessToken: string, verificationName: string, pin: string) {
  return googleRequest<Record<string, any>>(
    `https://mybusinessverifications.googleapis.com/v1/${verificationName}:complete`,
    accessToken,
    { method: "POST", body: JSON.stringify({ pin }) }
  );
}

export async function listGoogleBusinessVerifications(accessToken: string, locationName: string) {
  const result = await googleRequest<{ verifications?: Array<Record<string, any>> }>(
    `https://mybusinessverifications.googleapis.com/v1/${locationName}/verifications`,
    accessToken
  );
  return result.verifications ?? [];
}

export function buildGoogleLocationPayload(empresa: GoogleEmpresa, categoryId?: string, includeRequiredProfile = true) {
  const location: Record<string, unknown> = {
    languageCode: "pt-BR",
    storeCode: `mba-${empresa.id.slice(0, 12)}`,
    title: empresa.nome.trim(),
    phoneNumbers: empresa.telefone ? { primaryPhone: empresa.telefone } : undefined,
    websiteUri: empresa.site || undefined,
    categories: categoryId ? { primaryCategory: { name: categoryId } } : undefined,
    profile: includeRequiredProfile && empresa.descricao ? { description: empresa.descricao.slice(0, 750) } : undefined,
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

function buildPostalAddress(empresa: GoogleEmpresa) {
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

async function googleRequest<T>(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });

  return readGoogleResponse<T>(response, "O Google recusou a operação solicitada.");
}

async function readGoogleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  let payload: any = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.error_description ?? payload?.message ?? fallbackMessage;
    throw new Error(`${message} (HTTP ${response.status})`);
  }

  return payload as T;
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
