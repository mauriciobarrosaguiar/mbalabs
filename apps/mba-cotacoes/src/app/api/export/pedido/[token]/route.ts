import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  getCollections,
  getPurchaseOrderByToken,
  getQuotationById,
} from "@/lib/data/repository";
import * as demoRepository from "@/lib/data/demo-repository";
import { formatDateBR } from "@/lib/formatters";
import { labelFrom, statusLabels } from "@/lib/labels";
import {
  getPurchaseOrderSupplierCompany,
  getPurchaseOrderSupplierContact,
} from "@/lib/purchase-order-display";
import { stripLegacyPurchaseOrderReview } from "@/lib/purchase-order-review-legacy";
import type { PurchaseOrderItem } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const isDemoOrder = isDemoPurchaseOrderToken(token, request.url);
  const order = isDemoOrder
    ? await demoRepository.getPurchaseOrderByToken(token)
    : await getPurchaseOrderByToken(token);
  if (!order) {
    return NextResponse.json(
      { error: "Pedido não encontrado ou link expirado." },
      { status: 404 },
    );
  }
  const quotation = isDemoOrder
    ? await demoRepository.getQuotationById(order.quotationId)
    : await getQuotationById(order.quotationId);
  const collections = isDemoOrder
    ? await demoRepository.getCollections()
    : await getCollections();
  const tenant = collections.tenants.find((item) => item.id === order.tenantId);
  const pharmacy = collections.pharmacies.find((item) => item.id === quotation?.pharmacyId);
  const distributor = collections.distributors[0];
  const generatedAt = new Date();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MBA Cotações";
  workbook.created = generatedAt;

  const orderSheet = workbook.addWorksheet("Pedido");
  orderSheet.columns = [
    { header: "Produto", key: "produto", width: 34 },
    { header: "EAN", key: "ean", width: 18, style: { numFmt: "@" } },
    { header: "Laboratório", key: "laboratorio", width: 22 },
    { header: "Quantidade solicitada", key: "quantidade", width: 20 },
    { header: "Quantidade faturada", key: "quantidadeFaturada", width: 20 },
    { header: "Quantidade faltante", key: "quantidadeFaltante", width: 20 },
    { header: "Preço unitário", key: "precoUnitario", width: 18, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Total", key: "total", width: 18, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Observação", key: "observacao", width: 30 },
    { header: "Status faturamento", key: "statusFaturamento", width: 20 },
    { header: "Observacao do vendedor", key: "observacaoVendedor", width: 30 },
  ];

  order.items.forEach((item) => {
    const quotationItem = collections.quotationItems.find((quoteItem) => quoteItem.id === item.quotationItemId);
    const billedQuantity = getBilledQuantity(item);
    const missingQuantity = getMissingQuantity(item);
    orderSheet.addRow({
      produto: item.offeredProductName ?? item.productName,
      ean: quotationItem?.ean ? String(quotationItem.ean) : "",
      laboratorio: item.laboratory ?? quotationItem?.requestedLaboratory ?? "",
      quantidade: item.quantityToBuy,
      quantidadeFaturada: billedQuantity,
      quantidadeFaltante: missingQuantity,
      precoUnitario: item.unitPrice,
      total: item.totalPrice,
      observacao: stripLegacyPurchaseOrderReview(item.observation),
      statusFaturamento: labelFrom(statusLabels, billedQuantity > 0 && missingQuantity > 0 ? "falta_parcial" : item.fulfillmentStatus ?? "pendente"),
      observacaoVendedor: item.vendorObservation ?? "",
    });
  });
  styleWorksheet(orderSheet);
  orderSheet.getColumn("ean").eachCell((cell, rowNumber) => {
    if (rowNumber > 1) cell.value = String(cell.value ?? "");
  });

  const summarySheet = workbook.addWorksheet("Resumo");
  const totalUnits = order.items.reduce((total, item) => total + item.quantityToBuy, 0);
  const billedItems = order.items.filter((item) => getMissingQuantity(item) <= 0 && getBilledQuantity(item) > 0);
  const partialItems = order.items.filter((item) => getBilledQuantity(item) > 0 && getMissingQuantity(item) > 0);
  const notBilledItems = order.items.filter((item) => getBilledQuantity(item) <= 0 && getMissingQuantity(item) > 0);
  const totalMissing = order.items.reduce((total, item) => total + getMissingQuantity(item), 0);
  const confirmedAmount = order.confirmedAmount ?? order.items.reduce((total, item) => total + getBilledQuantity(item) * item.unitPrice, 0);
  const supplierCompany = getPurchaseOrderSupplierCompany(order);
  const supplierContact = getPurchaseOrderSupplierContact(order);
  const summaryRows = [
    ["Farmácia", pharmacy?.nomeFantasia ?? tenant?.nomeFantasia ?? "-"],
    ["Cotação", quotation?.name ?? "-"],
    ["Empresa vencedora", supplierCompany],
    ["Vendedor", supplierContact ?? "-"],
    ["WhatsApp", order.supplierWhatsapp ?? "-"],
    ["Data", formatDateBR(generatedAt.toISOString())],
    ["Total de itens", order.items.length],
    ["Itens faturados", billedItems.length],
    ["Itens parciais", partialItems.length],
    ["Itens não faturados", notBilledItems.length],
    ["Total de unidades", totalUnits],
    ["Quantidade faltante", totalMissing],
    ["Valor total", order.totalAmount],
    ["Valor faturado", confirmedAmount],
    ["Status do pedido", labelFrom(statusLabels, order.status)],
    ["Pedido mínimo", distributor?.pedidoMinimo ?? 0],
    ["Status do pedido mínimo", order.totalAmount >= (distributor?.pedidoMinimo ?? 0) ? "Atingiu" : "Não atingiu"],
  ];
  summarySheet.columns = [
    { header: "Campo", key: "campo", width: 26 },
    { header: "Valor", key: "valor", width: 42 },
  ];
  summaryRows.forEach(([campo, valor]) => summarySheet.addRow({ campo, valor }));
  styleWorksheet(summarySheet);
  summarySheet.getCell("B13").numFmt = '"R$" #,##0.00';
  summarySheet.getCell("B14").numFmt = '"R$" #,##0.00';
  summarySheet.getCell("B16").numFmt = '"R$" #,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `pedido_${sanitizeFileName(supplierCompany)}_${formatDateBR(generatedAt.toISOString()).replaceAll("/", "-")}.xlsx`;

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

function getBilledQuantity(item: PurchaseOrderItem) {
  if (item.fulfillmentStatus === "faturado") return item.quantityToBuy;
  if (item.fulfillmentStatus === "nao_faturado" || item.fulfillmentStatus === "pendente") return 0;
  const numeric = Number(item.billedQuantity ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), item.quantityToBuy);
}

function getMissingQuantity(item: PurchaseOrderItem) {
  const storedMissing = Number(item.missingQuantity);
  if (Number.isFinite(storedMissing)) return Math.max(0, storedMissing);
  return Math.max(0, item.quantityToBuy - getBilledQuantity(item));
}

function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0F2FE" },
  };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function isDemoPurchaseOrderToken(token: string, requestUrl: string) {
  const host = new URL(requestUrl).host;
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  return local && (
    token.includes("demo-token") ||
    token.startsWith("farmacia-pedido") ||
    token.startsWith("licitacao-pedido") ||
    token.startsWith("pedido-pharmacy") ||
    token.startsWith("pedido-bidding")
  );
}
