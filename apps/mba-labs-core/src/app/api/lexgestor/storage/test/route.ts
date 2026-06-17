import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { storageProviderLabel } from "@/lib/lexgestor/data";
import { testStorageConnection } from "@/lib/lexgestor/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const current = await requireAppAccess("lexgestor", "/lexgestor/configuracoes");

  try {
    const provider = await testStorageConnection(current);
    return NextResponse.redirect(
      new URL(`/lexgestor/configuracoes?status=${encodeURIComponent(`${storageProviderLabel(provider)} conectado`)}`, request.url),
      303,
    );
  } catch (error) {
    return NextResponse.redirect(
      new URL(`/lexgestor/configuracoes?erro=${encodeURIComponent(errorMessage(error))}`, request.url),
      303,
    );
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao testar armazenamento.";
}
