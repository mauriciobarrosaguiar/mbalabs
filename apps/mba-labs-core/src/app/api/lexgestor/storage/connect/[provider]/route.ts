import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { getOAuthUrl, isStorageProvider } from "@/lib/lexgestor/storage";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { provider } = await params;
  if (!isStorageProvider(provider)) {
    return NextResponse.redirect(new URL("/lexgestor/configuracoes?erro=provedor-invalido", request.url));
  }

  await requireAppAccess("lexgestor", "/lexgestor/configuracoes");

  try {
    const state = crypto.randomUUID();
    const oauthUrl = getOAuthUrl(provider, state, new URL(request.url).origin);
    const response = NextResponse.redirect(oauthUrl);
    response.cookies.set("lexgestor_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 10 * 60,
      path: "/",
    });
    return response;
  } catch (error) {
    return NextResponse.redirect(
      new URL(`/lexgestor/configuracoes?erro=${encodeURIComponent(errorMessage(error))}`, request.url),
    );
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao iniciar OAuth.";
}
