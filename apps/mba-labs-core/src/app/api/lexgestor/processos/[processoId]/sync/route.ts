import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";
import { syncProcessoDataJud } from "@/lib/lexgestor/processos";

export const dynamic = "force-dynamic";

type SyncProcessoRouteProps = {
  params: Promise<{ processoId: string }>;
};

export async function POST(_request: Request, { params }: SyncProcessoRouteProps) {
  const { processoId } = await params;
  const current = await requireAppAccess("lexgestor", `/lexgestor/processos/${processoId}`);

  try {
    const result = await syncProcessoDataJud({ processoId, current });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao sincronizar processo.";
}
