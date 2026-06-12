import { NextResponse } from "next/server";
import { logAction } from "@/lib/core-data";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as { acao?: string; appSlug?: string };

  if (!payload.acao) {
    return NextResponse.json({ ok: false, error: "Informe a ação." }, { status: 400 });
  }

  await logAction({ acao: payload.acao, appSlug: payload.appSlug });
  return NextResponse.json({ ok: true });
}
