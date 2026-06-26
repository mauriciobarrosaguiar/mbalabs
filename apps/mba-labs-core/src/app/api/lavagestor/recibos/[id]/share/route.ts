import { NextResponse } from "next/server";
import { getLavaRecibo } from "@/lib/lavagestor-recibo-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recibo, error } = await getLavaRecibo(id);
  const origin = new URL(request.url).origin;

  if (error || !recibo) return NextResponse.redirect(`${origin}/lavagestor/fila?error=Recibo%20n%C3%A3o%20encontrado`);
  if (recibo.status_pagamento !== "pago") return NextResponse.redirect(`${origin}/lavagestor/recibos/${id}`);

  const pdfLink = `${origin}/api/lavagestor/recibos/${id}/share-link`;
  const phone = String(recibo.whatsapp ?? "").replace(/\D/g, "");
  const text = [
    `Olá, ${recibo.cliente}! Segue o link para baixar o recibo da lavagem.`,
    `Recibo: ${recibo.numero}`,
    `Veículo/item: ${recibo.veiculo}`,
    `Total pago: ${money(recibo.valor_final)}`,
    `PDF: ${pdfLink}`,
    "Obrigado pela preferência!"
  ].join("\n\n");

  return NextResponse.redirect(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`);
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
