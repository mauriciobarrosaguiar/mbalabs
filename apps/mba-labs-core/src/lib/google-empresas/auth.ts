import "server-only";
import { decryptGoogleToken, encryptGoogleToken } from "./crypto";
import { refreshGoogleBusinessAccessToken } from "./google-api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { GoogleAutorizacao } from "./data";

export async function getActiveGoogleAuthorization(empresaId: string) {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("gmb_autorizacoes")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("status", "autorizado")
    .order("autorizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("O cliente ainda não autorizou uma conta Google para esta empresa.");
  }

  const autorizacao = data as GoogleAutorizacao;
  let accessToken = decryptGoogleToken(autorizacao.access_token_encrypted);
  const refreshToken = decryptGoogleToken(autorizacao.refresh_token_encrypted);
  const expiresAt = autorizacao.token_expires_at ? new Date(autorizacao.token_expires_at).getTime() : 0;
  const shouldRefresh = !accessToken || !expiresAt || expiresAt <= Date.now() + 60_000;

  if (shouldRefresh) {
    if (!refreshToken) {
      throw new Error("A autorização do Google expirou. Gere um novo link para o cliente autorizar novamente.");
    }

    const refreshed = await refreshGoogleBusinessAccessToken(refreshToken);
    accessToken = refreshed.access_token;
    const nextExpiresAt = new Date(Date.now() + Number(refreshed.expires_in ?? 3600) * 1000).toISOString();

    await supabase
      .from("gmb_autorizacoes")
      .update({
        access_token_encrypted: encryptGoogleToken(accessToken),
        token_expires_at: nextExpiresAt,
        ultimo_erro: null
      })
      .eq("id", autorizacao.id);

    autorizacao.access_token_encrypted = encryptGoogleToken(accessToken);
    autorizacao.token_expires_at = nextExpiresAt;
  }

  if (!accessToken) {
    throw new Error("Não foi possível recuperar o token autorizado do Google.");
  }

  return { autorizacao, accessToken };
}
