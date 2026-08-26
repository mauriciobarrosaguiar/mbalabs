import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "A configuração inicial foi desativada em produção." },
    { status: 410 }
  );
}
