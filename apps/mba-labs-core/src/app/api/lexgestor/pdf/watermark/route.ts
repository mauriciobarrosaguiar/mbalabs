import { NextResponse } from "next/server";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";
import { createSimplePdf } from "@/lib/lexgestor/simple-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentoId = url.searchParams.get("documento") || "";
  const data = await getLexWorkspaceData("/lexgestor/documentos");
  const documento = data.documentos.find((item) => item.id === documentoId);

  if (!documento) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const watermark = String(data.escritorio?.watermark_text ?? data.escritorio?.nome ?? "LexGestor");
  const pdf = createSimplePdf(
    [
      { text: "PDF com marca d'água", size: 16 },
      { text: `Documento: ${documento.nome}` },
      { text: `Cliente: ${documento.cliente}` },
      { text: `Caso: ${documento.caso}` },
      { text: `Categoria: ${documento.categoria} / ${documento.subcategoria}` },
      { text: `Status: ${documento.status}` },
      { text: `Arquivo original: ${documento.storagePath || "pendente"}` },
    ],
    watermark,
  );

  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="lexgestor-${documento.id}.pdf"`,
    },
  });
}
