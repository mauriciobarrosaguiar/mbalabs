import { NextResponse } from "next/server";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "excel" ? "excel" : "csv";
  const data = await getLexWorkspaceData("/lexgestor/relatorios");
  const rows = [
    ["Tipo", "Cliente", "Caso", "Categoria", "Status", "Processo", "Prazo"],
    ...data.casos.map((caso) => [
      "Caso",
      caso.cliente,
      caso.titulo,
      `${caso.categoria} / ${caso.subcategoria}`,
      caso.status,
      caso.numeroProcesso || "",
      caso.proximoPrazo || "",
    ]),
    ...data.documentos.map((documento) => [
      "Documento",
      documento.cliente,
      documento.caso,
      `${documento.categoria} / ${documento.subcategoria}`,
      documento.status,
      "",
      documento.criadoEm || "",
    ]),
  ];

  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  const fileName = format === "excel" ? "lexgestor-relatorio.xls" : "lexgestor-relatorio.csv";

  return new NextResponse(csv, {
    headers: {
      "content-type": format === "excel" ? "application/vnd.ms-excel; charset=utf-8" : "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
    },
  });
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
