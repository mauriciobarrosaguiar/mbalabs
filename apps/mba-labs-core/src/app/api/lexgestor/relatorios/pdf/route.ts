import { NextResponse } from "next/server";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";
import { createSimplePdf } from "@/lib/lexgestor/simple-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = await getLexWorkspaceData("/lexgestor/relatorios");
  const tipo = url.searchParams.get("tipo") || "geral";
  const casoId = url.searchParams.get("caso") || "";
  const caso = casoId ? data.casos.find((item) => item.id === casoId) : null;
  const escritorio = data.escritorio;
  const watermark = String(escritorio?.watermark_text ?? escritorio?.nome ?? "LexGestor");

  const lines = caso
    ? [
        { text: "Dossie do caso", size: 16 },
        { text: `Cliente: ${caso.cliente}` },
        { text: `Caso: ${caso.titulo}` },
        { text: `Categoria: ${caso.categoria} / ${caso.subcategoria}` },
        { text: `Processo: ${caso.numeroProcesso || "Nao informado"}` },
        { text: `Chave/eproc: ${caso.chaveProcesso || "Nao informada"}` },
        { text: `Status: ${caso.status}` },
        { text: `Proximo prazo: ${caso.proximoPrazo || "Sem prazo"}` },
        { text: `Relato: ${caso.relatoInicial || "Nao informado"}` },
      ]
    : [
        { text: tipo === "geral" ? "Relatorio geral do escritorio" : `Relatorio ${tipo}`, size: 16 },
        { text: `Clientes cadastrados: ${data.clientes.length}` },
        { text: `Casos abertos: ${data.casos.length}` },
        { text: `Documentos cadastrados: ${data.documentos.length}` },
        { text: `Prazos proximos: ${data.proximosPrazos.length}` },
        { text: "Casos por status:" },
        ...data.casosPorStatus.slice(0, 10).map((row) => ({ text: `- ${row.label}: ${row.value}` })),
      ];

  const pdf = createSimplePdf(lines, watermark);
  return new NextResponse(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${caso ? "lexgestor-dossie.pdf" : "lexgestor-relatorio.pdf"}"`,
    },
  });
}
