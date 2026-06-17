import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { exchangeOAuthCode, isStorageProvider, saveStorageConnection } from "@/lib/lexgestor/storage";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { provider } = await params;
  if (!isStorageProvider(provider)) {
    return NextResponse.redirect(new URL("/lexgestor/configuracoes?erro=provedor-invalido", request.url));
  }

  const current = await requireAppAccess("lexgestor", "/lexgestor/configuracoes");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("lexgestor_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/lexgestor/configuracoes?erro=oauth-invalido", request.url));
  }

  try {
    const tokens = await exchangeOAuthCode(provider, code, url.origin);
    await saveStorageConnection(current, provider, tokens);
    const response = NextResponse.redirect(new URL("/lexgestor/configuracoes?status=armazenamento-conectado", request.url));
    response.cookies.delete("lexgestor_oauth_state");
    return response;
  } catch (error) {
    return NextResponse.redirect(
      new URL(`/lexgestor/configuracoes?erro=${encodeURIComponent(errorMessage(error))}`, request.url),
    );
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao concluir OAuth.";
}
