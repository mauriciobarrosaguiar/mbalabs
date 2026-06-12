import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import {
  getCollections,
  getPurchaseOrdersByQuotation,
} from "@/lib/data/repository";
import { formatDateBR } from "@/lib/formatters";
import { labelFrom, statusLabels } from "@/lib/labels";
import {
  getPurchaseOrderSupplierCompany,
  getPurchaseOrderSupplierContact,
  getPurchaseOrderSupplierDisplay,
} from "@/lib/purchase-order-display";
import { stripLegacyPurchaseOrderReview } from "@/lib/purchase-order-review-legacy";
import type { ModuleType, PurchaseOrder, PurchaseOrderItem } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const moduleFilter = parseModuleFilter(url.searchParams.get("module"));
  const statusFilter = url.searchParams.get("status") ?? "all";
  const dateFilter = url.searchParams.get("date") ?? "";
  const vendorFilter = (url.searchParams.get("vendor") ?? "").trim().toLowerCase();
  const collections = await getCollections();

  const quotations = collections.quotations.filter((quotation) =>
    moduleFilter === "all" || quotation.moduleType === moduleFilter,
  );
  const orderGroups = await Promise.all(quotations.map(async (quotation) => ({
    quotation,
    orders: await getPurchaseOrdersByQuotation(quotation.id),
  })));

  const rows = orderGroups
    .flatMap(({ quotation, orders }) => orders.map((order) => ({ quotation, order })))
    .filter(({ order }) => {
      const vendorText = [
        getPurchaseOrderSupplierDisplay(order),
        getPurchaseOrderSupplierCompany(order),
        getPurchaseOrderSupplierContact(order),
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesVendor = !vendorFilter || vendorText.includes(vendorFilter);
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesDate = !dateFilter || order.generatedAt?.slice(0, 10) === dateFilter;
      return matchesVendor && matchesStatus && matchesDate;
    });

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Nenhum pedido gerado encontrado para exportacao." },
      { status: 404 },
    );
  }

  const quotationItemsById = new Map(collections.quotationItems.map((item) => [item.id, item]));
  const generatedAt = new Date();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MBA Cotacoes";
  workbook.created = generatedAt;

  const orderSheet = workbook.addWorksheet("Pedidos gerados");
  orderSheet.columns = [
    { header: "Modulo", key: "modulo", width: 14 },
    { header: "Cotacao", key: "cotacao", width: 32 },
    { header: "Empresa vencedora", key: "empresaVencedora", width: 28 },
    { header: "Vendedor", key: "vendedor", width: 24 },
    { header: "WhatsApp", key: "whatsapp", width: 18 },
    { header: "Data do pedido", key: "dataPedido", width: 16 },
    { header: "Status do pedido", key: "statusPedido", width: 22 },
    { header: "Produto", key: "produto", width: 38 },
    { header: "EAN", key: "ean", width: 18, style: { numFmt: "@" } },
    { header: "Laboratorio", key: "laboratorio", width: 22 },
    { header: "Unidade", key: "unidade", width: 12 },
    { header: "Quantidade solicitada", key: "quantidade", width: 20 },
    { header: "Quantidade faturada", key: "quantidadeFaturada", width: 20 },
    { header: "Quantidade faltante", key: "quantidadeFaltante", width: 20 },
    { header: "Preco unitario", key: "precoUnitario", width: 18, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Total previsto", key: "total", width: 18, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Total faturado", key: "totalFaturado", width: 18, style: { numFmt: '"R$" #,##0.00' } },
    { header: "Status faturamento", key: "statusFaturamento", width: 22 },
    { header: "Observacao", key: "observacao", width: 34 },
    { header: "Observacao do vendedor", key: "observacaoVendedor", width: 34 },
    { header: "Link do pedido", key: "linkPedido", width: 42 },
  ];

  for (const { quotation, order } of rows) {
    const supplierCompany = getPurchaseOrderSupplierCompany(order);
    const supplierContact = getPurchaseOrderSupplierContact(order) ?? order.supplierName;
    const publicOrderPath = `/${order.moduleType === "bidding" ? "licitacao" : "cotacao"}/pedido/${order.publicToken}`;
    const publicOrderUrl = new URL(publicOrderPath, request.url).toString();

    for (const item of order.items) {
      const quotationItem = quotationItemsById.get(item.quotationItemId);
      const billedQuantity = getBilledQuantity(item);
      const missingQuantity = getMissingQuantity(item);

      orderSheet.addRow({
        modulo: getModuleLabel(order.moduleType),
        cotacao: quotation.name,
        empresaVencedora: supplierCompany,
        vendedor: supplierContact,
        whatsapp: order.supplierWhatsapp ?? "",
        dataPedido: order.generatedAt ? formatDateBR(order.generatedAt) : "-",
        statusPedido: labelFrom(statusLabels, order.status),
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
  const allOrders = rows.map(({ order }) => order);
  const allItems = allOrders.flatMap((order) => order.items);
  const totalExpected = allOrders.reduce((total, order) => total + order.totalAmount, 0);
  const totalConfirmed = allItems.reduce((total, item) => total + getBilledQuantity(item) * item.unitPrice, 0);
  const totalMissing = allItems.reduce((total, item) => total + getMissingQuantity(item), 0);
  summarySheet.columns = [
    { header: "Campo", key: "campo", width: 28 },
    { header: "Valor", key: "valor", width: 54 },
  ];
  [
    ["Modulo", moduleFilter === "all" ? "Todos" : getModuleLabel(moduleFilter)],
    ["Data filtrada", dateFilter || "Todas"],
    ["Vendedor filtrado", vendorFilter || "Todos"],
    ["Status filtrado", statusFilter === "all" ? "Todos" : labelFrom(statusLabels, statusFilter)],
    ["Data da exportacao", formatDateBR(generatedAt.toISOString())],
    ["Pedidos gerados", allOrders.length],
    ["Pedidos de farmacia", countOrdersByModule(allOrders, "pharmacy")],
    ["Pedidos de licitacao", countOrdersByModule(allOrders, "bidding")],
    ["Produtos vencedores", allItems.length],
    ["Quantidade faltante", totalMissing],
    ["Valor previsto", totalExpected],
    ["Valor faturado", totalConfirmed],
    ["Vendedores vencedores", uniqueOrderSuppliers(allOrders).join(" | ")],
  ].forEach(([campo, valor]) => summarySheet.addRow({ campo, valor }));
  styleWorksheet(summarySheet);
  summarySheet.getCell("B12").numFmt = '"R$" #,##0.00';
  summarySheet.getCell("B13").numFmt = '"R$" #,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `pedidos_gerados_${sanitizeFileName(moduleFilter)}_${formatDateBR(generatedAt.toISOString()).replaceAll("/", "-")}.xlsx`;

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}

function parseModuleFilter(value: string | null): ModuleType | "all" {
  return value === "pharmacy" || value === "bidding" ? value : "all";
}

function getModuleLabel(moduleType: ModuleType) {
  return moduleType === "bidding" ? "Licitacao" : "Farmacia";
}

function countOrdersByModule(orders: PurchaseOrder[], moduleType: ModuleType) {
  return orders.filter((order) => order.moduleType === moduleType).length;
}

function uniqueOrderSuppliers(orders: PurchaseOrder[]) {
  return Array.from(new Set(orders.map(getPurchaseOrderSupplierDisplay))).filter(Boolean);
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
