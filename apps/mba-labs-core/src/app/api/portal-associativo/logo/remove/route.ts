import { NextResponse } from "next/server";
import { canPortalAccess, getPortalContext } from "@/lib/portal-associativo-data";

export async function POST(request: Request) {
  const context = await getPortalContext("/portal-associativo/configuracoes");
  if (!context.empresaId || !canPortalAccess(context.perfil, "configuracoes")) return go(request, "error", "Seu perfil não permite remover a logo.");
  const result = await context.client.from("assoc_configuracoes").update({ logo_url: null, logo_arquivo_id: null, atualizado_em: new Date().toISOString() }).eq("empresa_id", context.empresaId);
  if (result.error) return go(request, "error", result.error.message);
  await context.client.from("assoc_auditoria_logs").insert({ empresa_id: context.empresaId, usuario_id: context.current.usuario.id, acao: "remover_logo", entidade: "assoc_configuracoes" });
  return go(request, "ok", "Logo removida. O arquivo original foi mantido no armazenamento da associação.");
}

function go(request: Request, kind: "ok" | "error", message: string) {
  return NextResponse.redirect(new URL(`/portal-associativo/configuracoes?${kind}=${encodeURIComponent(message)}`, request.url), 303);
}
