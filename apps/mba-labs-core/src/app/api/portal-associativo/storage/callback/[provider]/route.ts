import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";
import { exchangePortalOAuthCode, isPortalStorageProvider, savePortalStorageConnection } from "@/lib/portal-associativo-storage";
import { ensurePortalStorageEnvAliases } from "../../../_storage-env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  ensurePortalStorageEnvAliases();
  const { provider } = await params;
  if (!isPortalStorageProvider(provider)) {
    return redirectConfig(request, "Provedor invalido.");
  }

  const context = await getPortalContext("/portal-associativo/configuracoes");
  if (!canPortalAccess(context.perfil, "configuracoes")) {
    return redirectConfig(request, "Seu perfil nao permite conectar armazenamento.");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("portal_assoc_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectConfig(request, "OAuth invalido. Tente conectar novamente.");
  }

  try {
    const tokens = await exchangePortalOAuthCode(provider, code, url.origin);
    await savePortalStorageConnection(context.current, provider, tokens);
    await context.client.from("assoc_auditoria_logs").insert({
      empresa_id: context.empresaId,
      usuario_id: context.current.usuario.id,
      acao: provider === "dropbox" ? "conectar_dropbox" : "conectar_google_drive",
      entidade: "assoc_storage_integracoes",
      dados_novos: { provedor: provider, conta: tokens.accountEmail || tokens.accountId || null }
    });
    const response = NextResponse.redirect(new URL("/portal-associativo/configuracoes?ok=Armazenamento conectado.", request.url));
    response.cookies.delete("portal_assoc_oauth_state");
    return response;
  } catch (error) {
    return redirectConfig(request, error instanceof Error ? error.message : "Erro ao concluir OAuth.");
  }
}

function redirectConfig(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/portal-associativo/configuracoes?error=${encodeURIComponent(error)}`, request.url));
}
