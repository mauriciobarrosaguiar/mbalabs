import { NextRequest, NextResponse } from "next/server";
import {
  canUsePublicResponseRepository,
  savePublicSellerResponse,
} from "@/modules/cotacoes/lib/data/public-response-repository";

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
    const message = error instanceof Error ? error.message : "Erro ao salvar resposta.";
    return NextResponse.json(
      { error: isControlledPublicResponseError(message) ? message : "Não foi possível salvar a resposta. Tente novamente." },
      { status: getPublicResponseErrorStatus(message) },
    );
  }
}

function getPublicResponseErrorStatus(message: string) {
  if (message.includes("não encontrada") || message.includes("link inválido")) return 404;
  if (
    message.includes("já foi enviada") ||
    message.includes("expirou") ||
    message.includes("revogado") ||
    message.includes("cancelada") ||
    message.includes("finalizada")
  ) return 409;
  if (isControlledPublicResponseError(message)) return 400;
  return 500;
}

function isControlledPublicResponseError(message: string) {
  return [
    "Cotação não encontrada",
    "Esta resposta já foi enviada",
    "Esta cotação expirou",
    "Este link foi revogado",
    "Esta cotação foi cancelada",
    "Cotação finalizada",
    "Responda pelo menos um item",
    "Informe o preço de pelo menos um item",
  ].some((prefix) => message.startsWith(prefix));
}
