import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";
import { getPortalOAuthUrl, isPortalStorageProvider } from "@/lib/portal-associativo-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { provider } = await params;
  if (!isPortalStorageProvider(provider)) {
    return redirectConfig(request, "Provedor invalido.");
  }

  const context = await getPortalContext("/portal-associativo/configuracoes");
  if (!canPortalAccess(context.perfil, "configuracoes")) {
    return redirectConfig(request, "Seu perfil nao permite conectar armazenamento.");
  }

  try {
    const state = crypto.randomUUID();
    const oauthUrl = getPortalOAuthUrl(provider, state, new URL(request.url).origin);
    const response = NextResponse.redirect(oauthUrl);
    response.cookies.set("portal_assoc_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      maxAge: 10 * 60,
      path: "/"
    });
    return response;
  } catch (error) {
    return redirectConfig(request, error instanceof Error ? error.message : "Erro ao iniciar OAuth.");
  }
}

function redirectConfig(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/portal-associativo/configuracoes?error=${encodeURIComponent(error)}`, request.url));
}
