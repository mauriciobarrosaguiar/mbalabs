import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";
import { portalStorageProviderLabel, testPortalStorageConnection } from "@/lib/portal-associativo-storage";
import { ensurePortalStorageEnvAliases } from "../../_storage-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  ensurePortalStorageEnvAliases();
  const context = await getPortalContext("/portal-associativo/configuracoes");
  if (!canPortalAccess(context.perfil, "configuracoes")) {
    return redirectConfig(request, "Seu perfil nao permite testar armazenamento.");
  }

  try {
    const provider = await testPortalStorageConnection(context.current);
    return NextResponse.redirect(
      new URL(`/portal-associativo/configuracoes?ok=${encodeURIComponent(`${portalStorageProviderLabel(provider)} conectado.`)}`, request.url),
      303
    );
  } catch (error) {
    return redirectConfig(request, error instanceof Error ? error.message : "Erro ao testar armazenamento.");
  }
}

function redirectConfig(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/portal-associativo/configuracoes?error=${encodeURIComponent(error)}`, request.url), 303);
}
