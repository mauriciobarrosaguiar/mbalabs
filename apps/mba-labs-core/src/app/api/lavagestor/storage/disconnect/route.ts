import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { disconnectLavaStorage, isLavaStorageProvider } from "@/lib/lavagestor-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");

  try {
    const formData = await request.formData().catch(() => null);
    const value = String(formData?.get("provider") ?? "");
    await disconnectLavaStorage(current, isLavaStorageProvider(value) ? value : undefined);
    return NextResponse.redirect(new URL("/lavagestor/configuracoes?ok=Armazenamento%20desconectado.", request.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/lavagestor/configuracoes?error=${encodeURIComponent(errorMessage(error))}`, request.url), 303);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao desconectar armazenamento.";
}
