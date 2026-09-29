import { describe, expect, it } from "vitest";
import { buildBiddingAnalysis } from "@/modules/cotacoes/lib/services/bidding-analysis";
import { buildPharmacyAnalysis } from "@/modules/cotacoes/lib/services/pharmacy-analysis";
import { generatePurchaseOrders } from "@/modules/cotacoes/lib/services/purchase-orders";
import { calculateSellerRow, validateSellerResponse } from "@/modules/cotacoes/lib/services/seller-response";
import type {
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
} from "@/modules/cotacoes/lib/types";

const item: QuotationItem = {
  id: "item-1",
  tenantId: "tenant-a",
  quotationId: "quote-a",
  moduleType: "pharmacy",
  itemNumber: 1,
  productName: "Dapagliflozina 10 mg c/30",
  requestedQuantity: 100,
  requestedUnit: "UN",
  laboratoryRequired: false,
  productType: "generico",
  acceptEquivalent: true,
  allowPartialSupply: true,
  msRegistrationRequired: false,
  status: "ativo",
};

function response(id: string, supplierId: string, submittedAt: string): SupplierQuoteResponse {
  return {
    id,
    tenantId: "tenant-a",
    quotationId: "quote-a",
    sessionId: `session-${id}`,
    supplierId,
    sellerName: supplierId,
    sellerCompany: supplierId,
    sellerWhatsapp: "",
    status: "submitted",
    submittedAt,
  };
}

function responseItem(
  id: string,
  responseId: string,
  supplierId: string,
  unitPrice: number,
  overrides: Partial<SupplierQuoteResponseItem> = {},
): SupplierQuoteResponseItem {
  return {
    id,
    tenantId: "tenant-a",
    quotationId: "quote-a",
    quotationItemId: "item-1",
    responseId,
    supplierId,
    unitPrice,
    hasStock: true,
    availableQuantity: 100,
    ...overrides,
  };
}

describe("ranking de farmácia", () => {
  it("escolhe matematicamente o menor preço", () => {
    const responses = [
      response("r-nazaria", "Nazaria", "2026-09-24T10:00:00Z"),
      response("r-pan", "Panpharma", "2026-09-24T10:01:00Z"),
      response("r-pro", "Profarma", "2026-09-24T10:02:00Z"),
      response("r-total", "Total", "2026-09-24T10:03:00Z"),
    ];
    const rows = [
      responseItem("i-nazaria", "r-nazaria", "Nazaria", 10),
      responseItem("i-pan", "r-pan", "Panpharma", 9.8),
      responseItem("i-pro", "r-pro", "Profarma", 11.2),
      responseItem("i-total", "r-total", "Total", 10.3),
    ];

    const analysis = buildPharmacyAnalysis([item], rows, responses, []);

    expect(analysis.awards).toHaveLength(1);
    expect(analysis.awards[0]).toMatchObject({ supplierId: "Panpharma", unitPrice: 9.8 });
    expect(analysis.awards[0].totalPrice).toBe(980);
  });

  it("não deixa preço sem estoque vencer", () => {
    const responses = [
      response("r-a", "A", "2026-09-24T10:00:00Z"),
      response("r-b", "B", "2026-09-24T10:01:00Z"),
    ];
    const rows = [
      responseItem("i-a", "r-a", "A", 8, { hasStock: false, availableQuantity: 0 }),
      responseItem("i-b", "r-b", "B", 8.5),
    ];

    expect(buildPharmacyAnalysis([item], rows, responses, []).awards[0].supplierId).toBe("B");
  });

  it("desempata por resposta mais antiga e depois por fornecedor", () => {
    const responses = [
      response("r-b", "B", "2026-09-24T10:01:00Z"),
      response("r-a", "A", "2026-09-24T10:00:00Z"),
    ];
    const rows = [
      responseItem("i-b", "r-b", "B", 10),
      responseItem("i-a", "r-a", "A", 10),
    ];

    expect(buildPharmacyAnalysis([item], rows, responses, []).awards[0].supplierId).toBe("A");
  });
});

describe("estoque e pedido de licitação", () => {
  it("divide 100 unidades entre estoque barato de 20 e estoque completo de 80", () => {
    const biddingItem = { ...item, moduleType: "bidding" as const };
    const responses = [
      response("r-a", "A", "2026-09-24T10:00:00Z"),
      response("r-b", "B", "2026-09-24T10:01:00Z"),
    ];
    const rows = [
      responseItem("i-a", "r-a", "A", 8, {
        offeredUnit: "UN",
        packageQuantity: 1,
        packagePrice: 8,
        hasFullQuantity: false,
        availableQuantity: 20,
      }),
      responseItem("i-b", "r-b", "B", 8.5, {
        offeredUnit: "UN",
        packageQuantity: 1,
        packagePrice: 8.5,
        hasFullQuantity: false,
        availableQuantity: 80,
      }),
    ];

    const analysis = buildBiddingAnalysis([biddingItem], rows, responses);
    const orders = generatePurchaseOrders(analysis.awards, [biddingItem], rows);

    expect(analysis.awards.map((award) => award.awardedQuantity)).toEqual([20, 80]);
    expect(orders).toHaveLength(2);
    expect(orders.map((order) => order.items[0].quantityToBuy)).toEqual([20, 80]);
    expect(orders.reduce((sum, order) => sum + order.totalAmount, 0)).toBe(840);
  });

  it("calcula subtotal e total monetário com arredondamento em centavos", () => {
    const awards = [{
      id: "award-1",
      tenantId: "tenant-a",
      quotationId: "quote-a",
      quotationItemId: "item-1",
      supplierResponseItemId: "i-a",
      supplierId: "A",
      supplierName: "A",
      moduleType: "pharmacy" as const,
      rankingPosition: 1,
      awardedQuantity: 3,
      awardedPackages: 3,
      unitPrice: 0.1,
      totalPrice: 0.3,
      remainingBalanceAfter: 0,
      status: "winner" as const,
    }];
    const orders = generatePurchaseOrders(awards, [item], [responseItem("i-a", "r-a", "A", 0.1)]);

    expect(orders[0].items[0].totalPrice).toBe(0.3);
    expect(orders[0].totalAmount).toBe(0.3);
  });
});

describe("resposta do representante", () => {
  it("classifica preço informado sem estoque como sem estoque e total zero", () => {
    const calculated = calculateSellerRow("pharmacy", item, {
      quotationItemId: item.id,
      netPrice: "8,00",
      hasStock: "nao",
    });

    expect(calculated.status).toBe("sem_estoque");
    expect(calculated.attendedQuantity).toBe(0);
    expect(calculated.itemTotal).toBe(0);
  });

  it("permite enviar resposta de item único explicitamente sem estoque", () => {
    const errors = validateSellerResponse({
      moduleType: "pharmacy",
      items: [item],
      rows: [{ quotationItemId: item.id, hasStock: "nao" }],
    });

    expect(errors).toEqual([]);
  });
});
