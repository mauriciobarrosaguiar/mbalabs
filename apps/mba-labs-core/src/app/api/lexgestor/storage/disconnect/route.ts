import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { disconnectStorage } from "@/lib/lexgestor/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/configuracoes");

  try {
    await disconnectStorage(current);
    return NextResponse.redirect(new URL("/lexgestor/configuracoes?status=armazenamento-desconectado", request.url), 303);
  } catch (error) {
    return NextResponse.redirect(
      new URL(`/lexgestor/configuracoes?erro=${encodeURIComponent(errorMessage(error))}`, request.url),
      303,
    );
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao desconectar armazenamento.";
}
