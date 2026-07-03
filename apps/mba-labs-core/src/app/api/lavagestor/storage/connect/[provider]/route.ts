import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { getLavaOAuthUrl, isLavaStorageProvider } from "@/lib/lavagestor-storage";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { provider } = await params;
  if (!isLavaStorageProvider(provider)) {
    return redirectConfig(request, "Provedor invalido.");
  }

  await requireAppAccess("lavagestor", "/lavagestor/configuracoes");

  try {
    const state = crypto.randomUUID();
    const oauthUrl = getLavaOAuthUrl(provider, state, new URL(request.url).origin);
    const response = NextResponse.redirect(oauthUrl);
    response.cookies.set("lavagestor_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 10 * 60,
      path: "/"
    });
    return response;
  } catch (error) {
    return redirectConfig(request, errorMessage(error));
  }
}

function redirectConfig(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/lavagestor/configuracoes?error=${encodeURIComponent(error)}`, request.url));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao iniciar OAuth.";
}
