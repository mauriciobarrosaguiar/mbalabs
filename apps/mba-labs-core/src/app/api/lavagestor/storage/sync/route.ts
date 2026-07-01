import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { syncPendingLavaPhotos } from "@/lib/lavagestor-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");

  try {
    const result = await syncPendingLavaPhotos(current);
    const message = result.connected === 0
      ? "Conecte Google Drive ou Dropbox antes de sincronizar."
      : `Sincronizacao concluida: ${result.synced} enviados, ${result.failed} com erro.`;
    const param = result.connected === 0 ? "error" : "ok";
    return NextResponse.redirect(new URL(`/lavagestor/configuracoes?${param}=${encodeURIComponent(message)}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/lavagestor/configuracoes?error=${encodeURIComponent(errorMessage(error))}`, request.url), 303);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao sincronizar arquivos.";
}
