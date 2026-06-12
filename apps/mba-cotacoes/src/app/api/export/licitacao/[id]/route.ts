import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getBiddingAnalysis, getQuotationBundle } from "@/lib/data/repository";

export async function GET(
  _request: Request,
  {
    params,
  }: {
  params: Promise<{ id: string }>;
  },
) {
  const { id } = await params;
  const [analysis, { items }] = await Promise.all([
    getBiddingAnalysis(id),
    getQuotationBundle(id),
  ]);
  const item = items[0];
  const rankingRows = analysis.ranking.map((response) => ({
    Produto: item?.productName,
    Fornecedor: response.supplierId,
    "Produto ofertado": response.offeredProductName,
    Marca: response.offeredLaboratory,
    "Preço embalagem": response.packagePrice,
    "Qtd embalagem": response.packageQuantity,
    "Preço unitário convertido": response.convertedUnitPrice,
    "Qtd disponível": response.hasFullQuantity ? "Total" : response.availableQuantity,
    Status: response.alertStatus ?? "Válida",
  }));
  const awardRows = analysis.awards.map((award) => ({
    Produto: item?.productName,
    Ordem: award.rankingPosition,
    Fornecedor: award.supplierName,
    "Preço unitário": award.unitPrice,
    "Qtd recomendada": award.awardedQuantity,
    Embalagens: award.awardedPackages,
    "Valor total": award.totalPrice,
    "Saldo após compra": award.remainingBalanceAfter,
  }));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MBA Cotações";
  workbook.created = new Date();

  appendWorksheet(workbook, "Mapa comparativo", rankingRows);
  appendWorksheet(workbook, "Sugestão compra", awardRows);

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mba-cotacoes-licitacao-${id}.xlsx"`,
    },
  });
}

function appendWorksheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: Record<string, string | number | undefined>[],
) {
  const worksheet = workbook.addWorksheet(name);
  const headers = Object.keys(rows[0] ?? { Resultado: "Sem dados" });
  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(14, header.length + 4),
  }));
  worksheet.addRows(rows.length > 0 ? rows : [{ Resultado: "Sem dados" }]);
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0F2FE" },
  };
}
