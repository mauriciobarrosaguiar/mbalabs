import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getLavaRecibo } from "@/lib/lavagestor-recibo-data";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Recibo = NonNullable<Awaited<ReturnType<typeof getLavaRecibo>>["recibo"]>;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recibo, error } = await getLavaRecibo(id);
  if (error || !recibo) return NextResponse.json({ error: error ?? "Recibo não encontrado." }, { status: 404 });
  if (recibo.status_pagamento !== "pago") return NextResponse.json({ error: "Registre o pagamento antes de gerar o recibo." }, { status: 400 });

  const supabase = await getSupabaseServer();
  const bytes = await makePdf(recibo);
  const path = `${recibo.id}/recibo-${recibo.numero}.pdf`;
  const { error: uploadError } = await supabase.storage.from("lavagestor-recibos").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const { data } = supabase.storage.from("lavagestor-recibos").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, numero: recibo.numero });
}

async function makePdf(recibo: Recibo) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.02, 0.48, 0.32);
  const dark = rgb(0.05, 0.12, 0.1);
  const gray = rgb(0.36, 0.43, 0.4);
  let y = 790;
  const draw = (value: string, x: number, size = 11, f = font, color = dark) => {
    page.drawText(String(value || "-").slice(0, 90), { x, y, size, font: f, color });
    y -= size + 8;
  };
  const section = (label: string) => { y -= 8; draw(label, 50, 10, bold, green); };

  draw("RECIBO DE SERVIÇO", 50, 11, bold, green);
  draw(recibo.empresa.nome, 50, 24, bold, dark);
  draw(`Nº ${recibo.numero}`, 50, 16, bold, dark);
  draw(String(recibo.empresa.telefone || ""), 50, 9, font, gray);
  y -= 12;
  section("CLIENTE");
  draw(recibo.cliente, 60, 13, bold);
  draw(`WhatsApp: ${recibo.whatsapp || "Não informado"}`, 60, 10, font, gray);
  section("VEÍCULO / ITEM");
  draw(recibo.veiculo, 60, 12, bold);
  draw(`Lavador: ${recibo.funcionario}`, 60, 10, font, gray);
  section("SERVIÇOS");
  recibo.servicos.forEach((item) => draw(`${item.descricao} - ${money(item.valor)}`, 60, 11, bold));
  section("VALORES");
  draw(`Total final: ${money(recibo.valor_final)}`, 60, 14, bold);
  draw(`Valor recebido: ${money(recibo.valor_recebido)}`, 60, 11, bold);
  draw(`Valor pendente: ${money(recibo.valor_pendente)}`, 60, 11, bold);
  section("PAGAMENTO E ENTREGA");
  draw(`Pagamento: Pago - ${recibo.forma_pagamento || "-"}`, 60, 11, bold);
  draw(`Entrega: ${deliveryLabel(recibo)}`, 60, 11, bold);
  y -= 22;
  draw("Obrigado pela preferência.", 50, 10, font, gray);
  draw("Recibo gerado pelo LavaGestor - MBA Labs", 50, 9, font, gray);
  return pdf.save();
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function deliveryLabel(recibo: Recibo) {
  if (recibo.entrega_tipo === "levar") return recibo.endereco_entrega ? `Levar ao cliente: ${recibo.endereco_entrega}` : "Levar ao cliente";
  return "Cliente retira";
}
