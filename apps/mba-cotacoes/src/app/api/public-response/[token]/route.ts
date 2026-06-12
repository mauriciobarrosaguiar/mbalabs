import { NextRequest, NextResponse } from "next/server";
import {
  canUsePublicResponseRepository,
  savePublicSellerResponse,
} from "@/lib/data/public-response-repository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!canUsePublicResponseRepository()) {
    return NextResponse.json(
      { error: "Supabase não configurado para resposta real." },
      { status: 409 },
    );
  }

  try {
    const { token } = await params;
    const body = await request.json();
    const result = await savePublicSellerResponse(token, body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao salvar resposta." },
      { status: 500 },
    );
  }
}
