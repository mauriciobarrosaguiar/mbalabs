import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { isLavaStorageProvider, syncPendingLavaPhotos } from "@/lib/lavagestor-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");

  try {
    const formData = await request.formData().catch(() => null);
    const providerValue = String(formData?.get("provider") ?? "");
    const returnTo = safeReturnTo(String(formData?.get("return_to") ?? "")) || "/lavagestor/configuracoes";
    const result = await syncPendingLavaPhotos(current, {
      fotoId: String(formData?.get("foto_id") ?? "") || undefined,
      lavagemId: String(formData?.get("lavagem_id") ?? "") || undefined,
      provider: isLavaStorageProvider(providerValue) ? providerValue : undefined
    });
    const message = result.connected === 0
      ? "Conecte Google Drive ou Dropbox antes de sincronizar."
      : `${result.synced} sincronizados, ${result.failed} com erro, ${result.skipped} ignorados.`;
    const param = result.connected === 0 ? "error" : "ok";
    return NextResponse.redirect(redirectWithMessage(request.url, returnTo, param, message), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/lavagestor/configuracoes?error=${encodeURIComponent(errorMessage(error))}`, request.url), 303);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao sincronizar arquivos.";
}

function safeReturnTo(value: string) {
  if (!value.startsWith("/lavagestor")) return "";
  if (value.startsWith("//")) return "";
  return value;
}

function redirectWithMessage(baseUrl: string, returnTo: string, param: string, message: string) {
  const url = new URL(returnTo, baseUrl);
  url.searchParams.set(param, message);
  return url;
}
