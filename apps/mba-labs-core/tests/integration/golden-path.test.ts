import { describe, expect, it } from "vitest";
import { buildPharmacyAnalysis } from "@/modules/cotacoes/lib/services/pharmacy-analysis";
import { generatePurchaseOrders } from "@/modules/cotacoes/lib/services/purchase-orders";
import type {
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
} from "@/modules/cotacoes/lib/types";

function tenantScenario(tenantId: string, quoteId: string, prefix: string, prices: number[]) {
  const quotationItem: QuotationItem = {
    id: `${prefix}-item`, tenantId, quotationId: quoteId, moduleType: "pharmacy",
    itemNumber: 1, productName: `${prefix} Losartana 50 mg c/30`, requestedQuantity: 10,
    requestedUnit: "UN", laboratoryRequired: false, productType: "generico",
    acceptEquivalent: true, allowPartialSupply: true, msRegistrationRequired: false, status: "ativo",
  };
  const responses: SupplierQuoteResponse[] = prices.map((_, index) => ({
    id: `${prefix}-response-${index}`, tenantId, quotationId: quoteId,
    sessionId: `${prefix}-session-${index}`, supplierId: `${prefix}-supplier-${index}`,
    sellerName: `${prefix} Representante ${index}`, sellerCompany: `${prefix} Distribuidora ${index}`,
    sellerWhatsapp: "", status: "submitted", submittedAt: `2026-09-24T10:0${index}:00Z`,
  }));
  const responseItems: SupplierQuoteResponseItem[] = prices.map((price, index) => ({
    id: `${prefix}-response-item-${index}`, tenantId, quotationId: quoteId,
    quotationItemId: quotationItem.id, responseId: responses[index].id,
    supplierId: responses[index].supplierId, unitPrice: price, hasStock: true, availableQuantity: 10,
  }));
  return { quotationItem, responses, responseItems };
}

describe("golden path de cálculo até o pedido", () => {
  it("mantém duas farmácias isoladas e gera pedido apenas do vencedor de cada uma", () => {
    const pharmacyA = tenantScenario("tenant-a", "quote-a", "A", [10, 9.8, 11.2]);
    const pharmacyB = tenantScenario("tenant-b", "quote-b", "B", [7.5, 8.1]);

    const analysisA = buildPharmacyAnalysis(
      [pharmacyA.quotationItem], pharmacyA.responseItems, pharmacyA.responses, [],
    );
    const analysisB = buildPharmacyAnalysis(
      [pharmacyB.quotationItem], pharmacyB.responseItems, pharmacyB.responses, [],
    );
    const ordersA = generatePurchaseOrders(
      analysisA.awards, [pharmacyA.quotationItem], pharmacyA.responseItems,
    );
    const ordersB = generatePurchaseOrders(
      analysisB.awards, [pharmacyB.quotationItem], pharmacyB.responseItems,
    );

    expect(ordersA).toHaveLength(1);
    expect(ordersA[0]).toMatchObject({ tenantId: "tenant-a", quotationId: "quote-a", totalAmount: 98 });
    expect(ordersA[0].items.every((entry) => entry.tenantId === "tenant-a")).toBe(true);
    expect(ordersB).toHaveLength(1);
    expect(ordersB[0]).toMatchObject({ tenantId: "tenant-b", quotationId: "quote-b", totalAmount: 75 });
    expect(ordersB[0].items.every((entry) => entry.tenantId === "tenant-b")).toBe(true);
  });
});
