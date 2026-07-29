import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPublicGoogleAuthorization } from "@/lib/google-empresas/data";
import { buildGoogleBusinessAuthorizationUrl } from "@/lib/google-empresas/google-api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const { autorizacao, empresa } = await getPublicGoogleAuthorization(token);

  if (!autorizacao || !empresa) {
    return NextResponse.redirect(new URL(`/google-empresas/autorizar/${token}?error=Link inválido ou expirado.`, request.url));
  }

  if (["expirado", "revogado"].includes(autorizacao.status)) {
    return NextResponse.redirect(new URL(`/google-empresas/autorizar/${token}?error=Este link não está mais ativo.`, request.url));
  }

  const state = randomUUID();
  const supabase = getSupabaseAdmin() as any;
  const { error } = await supabase
    .from("gmb_autorizacoes")
    .update({
      oauth_state: state,
      oauth_state_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      ultimo_erro: null
    })
    .eq("id", autorizacao.id);

  if (error) {
    return NextResponse.redirect(new URL(`/google-empresas/autorizar/${token}?error=${encodeURIComponent(error.message)}`, request.url));
  }

  try {
    const authorizationUrl = buildGoogleBusinessAuthorizationUrl({
      state,
      loginHint: autorizacao.email_cliente ?? empresa.email_cliente ?? null
    });
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar a autorização.";
    return NextResponse.redirect(new URL(`/google-empresas/autorizar/${token}?error=${encodeURIComponent(message)}`, request.url));
  }
}
