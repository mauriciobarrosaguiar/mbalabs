import { NextRequest, NextResponse } from "next/server";
import { encryptGoogleToken } from "@/lib/google-empresas/crypto";
import { getClientAuthorizationUrl } from "@/lib/google-empresas/data";
import {
  exchangeGoogleBusinessCode,
  fetchGoogleUserInfo,
  listGoogleBusinessAccounts
} from "@/lib/google-empresas/google-api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthError = request.nextUrl.searchParams.get("error");
  const supabase = getSupabaseAdmin() as any;

  if (!state) {
    return NextResponse.redirect(new URL("/login?error=Autorização Google inválida.", request.url));
  }

  const { data: autorizacao } = await supabase
    .from("gmb_autorizacoes")
    .select("*")
    .eq("oauth_state", state)
    .maybeSingle();

  if (!autorizacao) {
    return NextResponse.redirect(new URL("/login?error=Autorização Google não encontrada.", request.url));
  }

  const publicUrl = getClientAuthorizationUrl(String(autorizacao.public_token));
  const stateExpired = !autorizacao.oauth_state_expires_at || new Date(autorizacao.oauth_state_expires_at).getTime() < Date.now();

  if (stateExpired) {
    await saveOAuthError(autorizacao.id, autorizacao.empresa_id, "A autorização expirou antes de ser concluída.");
    return NextResponse.redirect(`${publicUrl}?error=${encodeURIComponent("A autorização expirou. Abra o link novamente.")}`);
  }

  if (oauthError || !code) {
    const message = oauthError === "access_denied" ? "A autorização foi cancelada." : "O Google não concluiu a autorização.";
    await saveOAuthError(autorizacao.id, autorizacao.empresa_id, message);
    return NextResponse.redirect(`${publicUrl}?error=${encodeURIComponent(message)}`);
  }

  try {
    const tokens = await exchangeGoogleBusinessCode(code);
    const [userInfo, accounts] = await Promise.all([
      fetchGoogleUserInfo(tokens.access_token),
      listGoogleBusinessAccounts(tokens.access_token)
    ]);
    const tokenExpiresAt = new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString();
    const googleEmail = String(userInfo.email ?? "");
    const googleSubject = String(userInfo.sub ?? "");

    const { error: authError } = await supabase
      .from("gmb_autorizacoes")
      .update({
        status: "autorizado",
        autorizado_em: new Date().toISOString(),
        google_email: googleEmail || null,
        google_subject: googleSubject || null,
        google_accounts: accounts,
        access_token_encrypted: encryptGoogleToken(tokens.access_token),
        refresh_token_encrypted: encryptGoogleToken(tokens.refresh_token),
        token_expires_at: tokenExpiresAt,
        oauth_state: null,
        oauth_state_expires_at: null,
        ultimo_erro: null
      })
      .eq("id", autorizacao.id);

    if (authError) throw new Error(authError.message);

    const firstAccountName = String(accounts[0]?.name ?? "") || null;
    const { error: empresaError } = await supabase
      .from("gmb_empresas")
      .update({
        status: "autorizado",
        google_account_name: firstAccountName,
        ultimo_erro: null
      })
      .eq("id", autorizacao.empresa_id);

    if (empresaError) throw new Error(empresaError.message);

    await supabase.from("gmb_operacoes").insert({
      empresa_id: autorizacao.empresa_id,
      autorizacao_id: autorizacao.id,
      tipo: "cliente_autorizou_google",
      status: "sucesso",
      detalhes: {
        google_email: googleEmail,
        quantidade_contas: accounts.length,
        conta_inicial: firstAccountName
      }
    });

    return NextResponse.redirect(`${publicUrl}?ok=${encodeURIComponent("Conta Google autorizada com sucesso.")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar a autorização do Google.";
    await saveOAuthError(autorizacao.id, autorizacao.empresa_id, message);
    return NextResponse.redirect(`${publicUrl}?error=${encodeURIComponent(message)}`);
  }
}

async function saveOAuthError(autorizacaoId: string, empresaId: string, message: string) {
  const supabase = getSupabaseAdmin() as any;
  await Promise.all([
    supabase.from("gmb_autorizacoes").update({ status: "erro", ultimo_erro: message }).eq("id", autorizacaoId),
    supabase.from("gmb_empresas").update({ status: "erro", ultimo_erro: message }).eq("id", empresaId),
    supabase.from("gmb_operacoes").insert({
      empresa_id: empresaId,
      autorizacao_id: autorizacaoId,
      tipo: "cliente_autorizou_google",
      status: "erro",
      detalhes: { erro: message }
    })
  ]);
}
