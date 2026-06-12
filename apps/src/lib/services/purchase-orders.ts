import type {
  PurchaseOrder,
  PurchaseOrderItem,
  QuotationAward,
  QuotationItem,
  SupplierQuoteResponseItem,
} from "@/lib/types";

export function generatePurchaseOrders(
  awards: QuotationAward[],
  quotationItems: QuotationItem[],
  responseItems: SupplierQuoteResponseItem[],
): PurchaseOrder[] {
  const bySupplier = new Map<string, QuotationAward[]>();
  const usedPharmacyItems = new Set<string>();

  for (const award of awards) {
    if (award.status !== "winner") continue;
    if (award.moduleType === "pharmacy") {
      if (usedPharmacyItems.has(award.quotationItemId)) continue;
      usedPharmacyItems.add(award.quotationItemId);
    }

    const key = award.supplierId ?? award.supplierName;
    bySupplier.set(key, [...(bySupplier.get(key) ?? []), award]);
  }

  return Array.from(bySupplier.entries()).map(([supplierKey, supplierAwards]) => {
    const firstAward = supplierAwards[0];
    const orderId = `po-${firstAward.moduleType}-${supplierKey}`;
    const items: PurchaseOrderItem[] = supplierAwards.map((award) => {
      const quotationItem = quotationItems.find(
        (item) => item.id === award.quotationItemId,
      );
      const responseItem = responseItems.find(
        (item) => item.id === award.supplierResponseItemId,
      );

      return {
        id: `poi-${award.id}`,
        tenantId: award.tenantId,
        purchaseOrderId: orderId,
        quotationItemId: award.quotationItemId,
        productName: quotationItem?.productName ?? "Produto",
        offeredProductName: responseItem?.offeredProductName,
        laboratory: responseItem?.offeredLaboratory,
        unit: quotationItem?.requestedUnit ?? responseItem?.offeredUnit ?? "UN",
        quantityToBuy: award.awardedQuantity,
        billedQuantity: 0,
        missingQuantity: award.awardedQuantity,
        packagesToBuy: award.awardedPackages,
        packageQuantity: responseItem?.packageQuantity,
        packagePrice: award.packagePrice,
        unitPrice: award.unitPrice,
        totalPrice: award.totalPrice,
        observation: responseItem?.sellerObservation,
        fulfillmentStatus: "pendente",
        vendorObservation: "",
        originalSupplierId: award.supplierId,
        originalSupplierName: award.supplierName,
      };
    });

    return {
      id: orderId,
      tenantId: firstAward.tenantId,
      quotationId: firstAward.quotationId,
      moduleType: firstAward.moduleType,
      supplierName: firstAward.supplierName,
      supplierId: firstAward.supplierId,
      publicToken: `pedido-${firstAward.moduleType}-${supplierKey}`,
      totalAmount: roundMoney(
        supplierAwards.reduce((total, award) => total + award.totalPrice, 0),
      ),
      status: "gerado",
      generatedAt: new Date().toISOString(),
      items,
    } satisfies PurchaseOrder;
  });
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
