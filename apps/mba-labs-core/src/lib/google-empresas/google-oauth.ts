import "server-only";
import { googleRequest, readGoogleResponse } from "./google-client";

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
