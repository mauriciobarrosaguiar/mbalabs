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
    ? montarLinhasDossie(caso, data.documentos.filter((documento) => documento.casoId === caso.id))
    : [
        { text: tipo === "geral" ? "Relatório geral do escritório" : `Relatório ${tipo}`, size: 16 },
        { text: `Clientes cadastrados: ${data.clientes.length}` },
        { text: `Casos abertos: ${data.casos.length}` },
        { text: `Documentos cadastrados: ${data.documentos.length}` },
        { text: `Prazos próximos: ${data.proximosPrazos.length}` },
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

function montarLinhasDossie(caso: Awaited<ReturnType<typeof getLexWorkspaceData>>["casos"][number], documentos: Awaited<ReturnType<typeof getLexWorkspaceData>>["documentos"]) {
  const documentosOrdenados = [...documentos].sort((a, b) => ordemDocumento(a).localeCompare(ordemDocumento(b)));

  return [
    { text: "Dossiê do caso", size: 16 },
    { text: `Cliente: ${caso.cliente}` },
    { text: `Caso: ${caso.titulo}` },
    { text: `Categoria: ${caso.categoria} / ${caso.subcategoria}` },
    { text: `Processo: ${caso.numeroProcesso || "Não informado"}` },
    { text: `Chave/eproc: ${caso.chaveProcesso || "Não informada"}` },
    { text: `Status: ${caso.status}` },
    { text: `Próximo prazo: ${caso.proximoPrazo || "Sem prazo"}` },
    { text: `Relato: ${caso.relatoInicial || "Não informado"}` },
    { text: `Documentos anexados: ${documentosOrdenados.length}` },
    ...documentosOrdenados.slice(0, 28).flatMap((documento, index) => [
      { text: `${index + 1}. ${documento.tipo}: ${documento.nome}` },
      { text: `   ${documento.categoria} / ${documento.subcategoria} - ${documento.status}` },
    ]),
  ];
}

function ordemDocumento(documento: Awaited<ReturnType<typeof getLexWorkspaceData>>["documentos"][number]) {
  return [documento.categoria, documento.subcategoria, documento.tipo, documento.criadoEm, documento.nome]
    .map((item) => item || "")
    .join("|");
}
