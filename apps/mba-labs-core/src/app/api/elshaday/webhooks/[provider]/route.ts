import { NextRequest, NextResponse } from "next/server";
import {
  getElshadayPixProviderDefinition,
  parseElshadayPixProvider
} from "@/lib/elshaday-payment-providers";
import { processElshadayPagBankWebhook } from "@/lib/elshaday-pagbank";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: rawProvider } = await params;
    const provider = parseElshadayPixProvider(rawProvider);
    const definition = getElshadayPixProviderDefinition(provider);

    return NextResponse.json({
      ok: true,
      module: "elshaday-pix",
      provider,
      providerName: definition.name,
      adapterStatus: definition.adapterStatus,
      endpoint: "/api/elshaday/webhooks/" + provider
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Provedor PIX inválido." },
      { status: 404 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: rawProvider } = await params;
    const provider = parseElshadayPixProvider(rawProvider);
    const definition = getElshadayPixProviderDefinition(provider);

    if (definition.adapterStatus !== "operational") {
      return NextResponse.json(
        {
          ok: false,
          provider,
          error:
            "O endpoint está reservado, mas o adaptador transacional deste provedor ainda não está ativo."
        },
        { status: 503 }
      );
    }

    if (provider === "pagbank") {
      const payload = await request.json();
      const result = await processElshadayPagBankWebhook(payload);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      {
        ok: false,
        provider,
        error: "Use o endpoint específico do adaptador operacional."
      },
      { status: 409 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar webhook PIX.";
    const invalidProvider = message === "Provedor PIX inválido.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: invalidProvider ? 404 : 500 }
    );
  }
}
