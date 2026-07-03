import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { exchangeLavaOAuthCode, isLavaStorageProvider, saveLavaStorageConnection } from "@/lib/lavagestor-storage";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { provider } = await params;
  if (!isLavaStorageProvider(provider)) {
    return redirectConfig(request, "Provedor invalido.");
  }

  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("lavagestor_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectConfig(request, "OAuth invalido ou expirado.");
  }

  try {
    const tokens = await exchangeLavaOAuthCode(provider, code, url.origin);
    await saveLavaStorageConnection(current, provider, tokens);
    const response = NextResponse.redirect(new URL("/lavagestor/configuracoes?ok=Armazenamento%20conectado.", request.url));
    response.cookies.delete("lavagestor_oauth_state");
    return response;
  } catch (error) {
    return redirectConfig(request, errorMessage(error));
  }
}

function redirectConfig(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/lavagestor/configuracoes?error=${encodeURIComponent(error)}`, request.url));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao concluir OAuth.";
}
