import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { lavaStorageProviderLabel, testLavaStorageConnection } from "@/lib/lavagestor-storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const current = await requireAppAccess("lavagestor", "/lavagestor/configuracoes");

  try {
    const provider = await testLavaStorageConnection(current);
    return NextResponse.redirect(new URL(`/lavagestor/configuracoes?ok=${encodeURIComponent(`${lavaStorageProviderLabel(provider)} conectado.`)}`, request.url), 303);
  } catch (error) {
    return NextResponse.redirect(new URL(`/lavagestor/configuracoes?error=${encodeURIComponent(errorMessage(error))}`, request.url), 303);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao testar armazenamento.";
}
