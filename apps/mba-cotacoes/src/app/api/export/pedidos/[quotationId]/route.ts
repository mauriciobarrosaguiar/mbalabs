import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  getCollections,
  getPurchaseOrdersByQuotation,
  getQuotationById,
} from "@/lib/data/repository";
import * as demoRepository from "@/lib/data/demo-repository";
import { formatDateBR } from "@/lib/formatters";
import { labelFrom, statusLabels } from "@/lib/labels";
import {
  getPurchaseOrderSupplierCompany,
  getPurchaseOrderSupplierContact,
  getPurchaseOrderSupplierDisplay,
} from "@/lib/purchase-order-display";
import { stripLegacyPurchaseOrderReview } from "@/lib/purchase-order-review-legacy";
import type { PurchaseOrderItem } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ quotationId: string }> },
) {
  const { quotationId } = await params;
  const isDemoQuotation = isDemoQuotationId(quotationId, request.url);
  const orders = isDemoQuotation
    ? await demoRepository.getPurchaseOrdersByQuotation(quotationId)
    : await getPurchaseOrdersByQuotation(quotationId);

  if (orders.length === 0) {
    return NextResponse.json(
      { error: "Nenhum pedido vencedor encontrado para esta cotacao." },
      { status: 404 },
    );
  }

  const quotation = isDemoQuotation
    ? await demoRepository.getQuotationById(quotationId)
    : await getQuotationById(quotationId);
  const collections = isDemoQuotation
    ? await demoRepository.getCollections()
    : await getCollections();
  const tenant = collections.tenants.find((item) => item.id === quotation?.tenantId);
  const pharmacy = collections.pharmacies.find((item) => item.id === quotation?.pharmacyId);
  const generatedAt = new Date();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MBA Cotacoes";
  workbook.created = generatedAt;

  const orderSheet = workbook.addWorksheet("Pedidos vencedores");
  orderSheet.columns = [
    { header: "Cotacao", key: "cotacao", width: 30 },
    { header: "Modulo", key: "modulo", width: 14 },
    { header: "Empresa vencedora", key: "empresaVencedora", width: 28 },
    { header: "Vendedor", key: "vendedor", width: 24 },
    { header: "WhatsApp", key: "whatsapp", width: 18 },
    { header: "Produto", key: "produto", width: 36 },
    { header: "EAN", key: "ean", width: 18, style: { numFmt: "@" } },
    { header: "Laboratorio", key: "laboratorio", width: 22 },
    { header: "Unidade", key: "unidade", width: 12 },
    { header: "Quantidade solicitada", key: "quantidade", width: 20 },
    { header: "Quantidade faturada", key: "quantidadeFaturada", width: 20 },
    { header: "Quantidade faltante", key: "quantidadeFaltante", width: 20 },
    { header: "Preco unitario", key: "precoUnitario", width: 18, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Total previsto", key: "total", width: 18, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Total faturado", key: "totalFaturado", width: 18, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Status do pedido", key: "statusPedido", width: 20 },
    { header: "Status faturamento", key: "statusFaturamento", width: 20 },
    { header: "Observacao", key: "observacao", width: 34 },
    { header: "Observacao do vendedor", key: "observacaoVendedor", width: 34 },
    { header: "Link do pedido", key: "linkPedido", width: 42 },
  ];

  for (const order of orders) {
    const supplierCompany = getPurchaseOrderSupplierCompany(order);
    const supplierContact = getPurchaseOrderSupplierContact(order) ?? order.supplierName;
    const publicOrderPath = `/${order.moduleType === "bidding" ? "licitacao" : "cotacao"}/pedido/${order.publicToken}`;
    const publicOrderUrl = new URL(publicOrderPath, request.url).toString();

    for (const item of order.items) {
      const quotationItem = collections.quotationItems.find((quoteItem) => quoteItem.id === item.quotationItemId);
      const billedQuantity = getBilledQuantity(item);
      const missingQuantity = getMissingQuantity(item);
      orderSheet.addRow({
        cotacao: quotation?.name ?? order.quotationId,
        modulo: order.moduleType === "bidding" ? "Licitacao" : "Farmacia",
        empresaVencedora: supplierCompany,
        vendedor: supplierContact,
        whatsapp: order.supplierWhatsapp ?? "",
        produto: item.offeredProductName ?? item.productName,
        ean: quotationItem?.ean ? String(quotationItem.ean) : "",
        laboratorio: item.laboratory ?? quotationItem?.requestedLaboratory ?? "",
        unidade: item.unit,
        quantidade: item.quantityToBuy,
        quantidadeFaturada: billedQuantity,
        quantidadeFaltante: missingQuantity,
        precoUnitario: item.unitPrice,
        total: item.totalPrice,
        totalFaturado: billedQuantity * item.unitPrice,
        statusPedido: labelFrom(statusLabels, order.status),
        statusFaturamento: labelFrom(statusLabels, resolveItemStatus(item)),
        observacao: stripLegacyPurchaseOrderReview(item.observation),
        observacaoVendedor: item.vendorObservation ?? "",
        linkPedido: publicOrderUrl,
      });
    }
  }
  styleWorksheet(orderSheet);
  orderSheet.getColumn("ean").eachCell((cell, rowNumber) => {
    if (rowNumber > 1) cell.value = String(cell.value ?? "");
  });

  const summarySheet = workbook.addWorksheet("Resumo");
  const allItems = orders.flatMap((order) => order.items);
  const totalExpected = orders.reduce((total, order) => total + order.totalAmount, 0);
  const totalConfirmed = allItems.reduce((total, item) => total + getBilledQuantity(item) * item.unitPrice, 0);
  const totalMissing = allItems.reduce((total, item) => total + getMissingQuantity(item), 0);
  summarySheet.columns = [
    { header: "Campo", key: "campo", width: 28 },
    { header: "Valor", key: "valor", width: 48 },
  ];
  [
    ["Empresa", pharmacy?.nomeFantasia ?? tenant?.nomeFantasia ?? "-"],
    ["Cotacao", quotation?.name ?? "-"],
    ["Modulo", quotation?.moduleType === "bidding" ? "Licitacao" : "Farmacia"],
    ["Data", formatDateBR(generatedAt.toISOString())],
    ["Pedidos vencedores", orders.length],
    ["Vendedores vencedores", orders.map(getPurchaseOrderSupplierDisplay).join(" | ")],
    ["Produtos vencedores", allItems.length],
    ["Quantidade faltante", totalMissing],
    ["Valor previsto", totalExpected],
    ["Valor faturado", totalConfirmed],
  ].forEach(([campo, valor]) => summarySheet.addRow({ campo, valor }));
  styleWorksheet(summarySheet);
  summarySheet.getCell("B9").numFmt = '"R$" #,##0.00';
  summarySheet.getCell("B10").numFmt = '"R$" #,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `pedidos_vencedores_${sanitizeFileName(quotation?.name ?? quotationId)}_${formatDateBR(generatedAt.toISOString()).replaceAll("/", "-")}.xlsx`;

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

function resolveItemStatus(item: PurchaseOrderItem) {
  const billedQuantity = getBilledQuantity(item);
  const missingQuantity = getMissingQuantity(item);
  if (billedQuantity > 0 && missingQuantity > 0) return "falta_parcial";
  return item.fulfillmentStatus ?? "pendente";
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

function isDemoQuotationId(quotationId: string, requestUrl: string) {
  const host = new URL(requestUrl).host;
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
  return local && quotationId.startsWith("demo-");
}
