import { NextResponse } from "next/server";
import { sendLavagemReceiptWhatsapp } from "@/lib/lavagestor-recibo-whatsapp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "").trim();

  if (!id) {
    return NextResponse.json({ ok: false, error: "Lavagem inválida." }, { status: 400 });
  }

  const result = await sendLavagemReceiptWhatsapp(id, "botao_recibo");

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
