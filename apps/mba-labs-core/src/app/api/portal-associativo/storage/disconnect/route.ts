import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";
import { disconnectPortalStorage } from "@/lib/portal-associativo-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const context = await getPortalContext("/portal-associativo/configuracoes");
  if (!canPortalAccess(context.perfil, "configuracoes")) {
    return redirectConfig(request, "Seu perfil nao permite desconectar armazenamento.");
  }

  try {
    await disconnectPortalStorage(context.current);
    await context.client.from("assoc_auditoria_logs").insert({
      empresa_id: context.empresaId,
      usuario_id: context.current.usuario.id,
      acao: "desconectar_integracao_storage",
      entidade: "assoc_storage_integracoes"
    });
    return NextResponse.redirect(new URL("/portal-associativo/configuracoes?ok=Armazenamento desconectado.", request.url), 303);
  } catch (error) {
    return redirectConfig(request, error instanceof Error ? error.message : "Erro ao desconectar armazenamento.");
  }
}

function redirectConfig(request: Request, error: string) {
  return NextResponse.redirect(new URL(`/portal-associativo/configuracoes?error=${encodeURIComponent(error)}`, request.url), 303);
}
