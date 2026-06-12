import { getSupabaseClientMode } from "@/lib/supabase/env";
import { formatCurrency, formatInteger } from "@/lib/formatters";
import { buildBiddingAnalysis, generateBiddingAwards as calculateBiddingAwards } from "@/lib/services/bidding-analysis";
import { buildPharmacyAnalysis } from "@/lib/services/pharmacy-analysis";
import { generatePurchaseOrders as buildPurchaseOrders } from "@/lib/services/purchase-orders";
import { isQuotationDeleted, isQuotationInProgress, markQuotationGeneratedStatus } from "@/lib/quotation-status";
import type {
  DashboardMetric,
  Distributor,
  Laboratory,
  ModuleType,
  MonthlySubscription,
  Pharmacy,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderItemFulfillmentStatus,
  PurchaseOrderStatus,
  Quotation,
  QuotationItem,
  SubscriptionPlan,
  Supplier,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
  SupplierQuoteSession,
  Tenant,
  WinnerOrderPendingItem,
} from "@/lib/types";
import {
  deleteById,
  getDemoStore,
  resolveDemoPublicToken,
  resolveDemoQuotationId,
  updateById,
  upsertById,
} from "./demo-store";

export function getClientMode() {
  return getSupabaseClientMode();
}

export function getCollections() {
  const store = getDemoStore();
  const quotationIds = new Set(store.quotations.filter((quotation) => !isQuotationDeleted(quotation.status)).map((quotation) => quotation.id));
  return {
    ...store,
    quotations: store.quotations.filter((quotation) => quotationIds.has(quotation.id)),
    quotationItems: store.quotationItems.filter((item) => quotationIds.has(item.quotationId)),
    supplierQuoteSessions: store.supplierQuoteSessions.filter((session) => quotationIds.has(session.quotationId)),
    supplierQuoteResponses: store.supplierQuoteResponses.filter((response) => quotationIds.has(response.quotationId)),
    supplierQuoteResponseItems: store.supplierQuoteResponseItems.filter((item) => quotationIds.has(item.quotationId)),
    purchaseOrders: store.purchaseOrders.filter((order) => quotationIds.has(order.quotationId)),
    winnerOrderPendingItems: store.winnerOrderPendingItems.filter((item) => quotationIds.has(item.quotationId)),
  };
}

export function getDashboardData(tenantId = "tenant-bidding") {
  return {
    adminMetrics: getAdminMetrics(),
    companyMetrics: getCompanyMetrics(tenantId),
    mode: getClientMode(),
  };
}

export function getTenants() {
  return getDemoStore().tenants;
}

export function createTenant(input: Omit<Tenant, "id"> & { id?: string }) {
  return upsertById(getDemoStore().tenants, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  });
}

export function updateTenant(id: string, patch: Partial<Tenant>) {
  return updateById(getDemoStore().tenants, id, patch);
}

export function deleteTenant(id: string) {
  return updateTenant(id, { status: "suspenso" });
}

export function getPharmacies() {
  return getDemoStore().pharmacies;
}

export function createPharmacy(input: Omit<Pharmacy, "id"> & { id?: string }) {
  return upsertById(getDemoStore().pharmacies, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  });
}

export function updatePharmacy(id: string, patch: Partial<Pharmacy>) {
  return updateById(getDemoStore().pharmacies, id, patch);
}

export function deletePharmacy(id: string) {
  return updatePharmacy(id, { status: "inativo" });
}

export function getProducts() {
  return getDemoStore().products;
}

export function createProduct(input: Omit<Product, "id"> & { id?: string }) {
  return upsertById(getDemoStore().products, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  });
}

export function updateProduct(id: string, patch: Partial<Product>) {
  return updateById(getDemoStore().products, id, patch);
}

export function deleteProduct(id: string) {
  return updateProduct(id, { status: "inativo" });
}

export function getSuppliers() {
  return getDemoStore().suppliers;
}

export function createSupplier(input: Omit<Supplier, "id"> & { id?: string }) {
  return upsertById(getDemoStore().suppliers, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  });
}

export function updateSupplier(id: string, patch: Partial<Supplier>) {
  return updateById(getDemoStore().suppliers, id, patch);
}

export function deleteSupplier(id: string) {
  return updateSupplier(id, { status: "inativo" });
}

export function getDistributors() {
  return getDemoStore().distributors;
}

export function createDistributor(input: Omit<Distributor, "id"> & { id?: string }) {
  return upsertById(getDemoStore().distributors, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  });
}

export function updateDistributor(id: string, patch: Partial<Distributor>) {
  return updateById(getDemoStore().distributors, id, patch);
}

export function deleteDistributor(id: string) {
  return updateDistributor(id, { status: "inativo" });
}

export function getLaboratories() {
  return getDemoStore().laboratories;
}

export function createLaboratory(input: Omit<Laboratory, "id"> & { id?: string }) {
  return upsertById(getDemoStore().laboratories, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  });
}

export function updateLaboratory(id: string, patch: Partial<Laboratory>) {
  return updateById(getDemoStore().laboratories, id, patch);
}

export function deleteLaboratory(id: string) {
  return updateLaboratory(id, { status: "inativo" });
}

export function createSubscriptionPlan(input: Omit<SubscriptionPlan, "id"> & { id?: string }) {
  return upsertById(getDemoStore().subscriptionPlans, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  });
}

export function updateSubscriptionPlan(id: string, patch: Partial<SubscriptionPlan>) {
  return updateById(getDemoStore().subscriptionPlans, id, patch);
}

export function deleteSubscriptionPlan(id: string) {
  return updateSubscriptionPlan(id, { status: "inativo" });
}

export function createMonthlySubscription(input: Omit<MonthlySubscription, "id"> & { id?: string }) {
  return upsertById(getDemoStore().monthlySubscriptions, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  });
}

export function updateMonthlySubscription(id: string, patch: Partial<MonthlySubscription>) {
  return updateById(getDemoStore().monthlySubscriptions, id, patch);
}

export function deleteMonthlySubscription(id: string) {
  return updateMonthlySubscription(id, { status: "canceled" });
}

export function getPharmacyQuotations() {
  return getQuotationsByModule("pharmacy");
}

export function getBiddingQuotations() {
  return getQuotationsByModule("bidding");
}

export function getQuotationsByModule(moduleType: ModuleType) {
  return getDemoStore().quotations.filter((quotation) => quotation.moduleType === moduleType && !isQuotationDeleted(quotation.status));
}

export function listQuotationsByModule(moduleType: ModuleType) {
  return getQuotationsByModule(moduleType);
}

export function getQuotationById(id: string) {
  const resolvedId = resolveDemoQuotationId(id) ?? id;
  return getDemoStore().quotations.find((quotation) => quotation.id === resolvedId && !isQuotationDeleted(quotation.status));
}

export function getQuotation(id: string) {
  return getQuotationById(id) ?? getDemoStore().quotations[0];
}

export function createQuotation(input: Omit<Quotation, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  const now = new Date().toISOString();
  return upsertById(getDemoStore().quotations, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  });
}

export function updateQuotation(id: string, patch: Partial<Quotation>) {
  const resolvedId = resolveDemoQuotationId(id) ?? id;
  return updateById(getDemoStore().quotations, resolvedId, {
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}

export function deleteQuotation(id: string) {
  return updateQuotation(id, { status: "excluida" });
}

export function getQuotationItems(quotationId: string) {
  const resolvedId = resolveDemoQuotationId(quotationId) ?? quotationId;
  return getDemoStore().quotationItems.filter((item) => item.quotationId === resolvedId);
}

export function createQuotationItem(input: Omit<QuotationItem, "id"> & { id?: string }) {
  return upsertById(getDemoStore().quotationItems, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
  });
}

export function updateQuotationItem(id: string, patch: Partial<QuotationItem>) {
  return updateById(getDemoStore().quotationItems, id, patch);
}

export function deleteQuotationItem(id: string) {
  return deleteById(getDemoStore().quotationItems, id);
}

export function getQuotationBundle(id: string) {
  const quotation = getQuotation(id);
  const items = getQuotationItems(quotation.id);
  const responses = getDemoStore().supplierQuoteResponses.filter(
    (response) => response.quotationId === quotation.id,
  );
  const responseItems = getDemoStore().supplierQuoteResponseItems.filter(
    (item) => item.quotationId === quotation.id,
  );

  return { quotation, items, responses, responseItems };
}

export function getSupplierSessions(quotationId?: string) {
  const store = getDemoStore();
  if (!quotationId) return store.supplierQuoteSessions;
  const resolvedId = resolveDemoQuotationId(quotationId) ?? quotationId;
  return store.supplierQuoteSessions.filter((session) => session.quotationId === resolvedId);
}

export function createSupplierSession(input: Omit<SupplierQuoteSession, "id" | "publicToken"> & { id?: string; publicToken?: string }) {
  return upsertById(getDemoStore().supplierQuoteSessions, {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    publicToken: input.publicToken ?? crypto.randomUUID().replaceAll("-", ""),
  });
}

export function getSessionByToken(token: string) {
  const resolvedToken = resolveDemoPublicToken(token);
  return getDemoStore().supplierQuoteSessions.find(
    (session) => session.publicToken === resolvedToken,
  );
}

export function getPublicSession(token: string, moduleType: ModuleType) {
  const session =
    getSessionByToken(token) ??
    getDemoStore().supplierQuoteSessions.find((item) =>
      moduleType === "bidding"
        ? item.quotationId === "quote-bidding-001"
        : item.quotationId === "quote-pharmacy-001",
    );
  const quotation = getDemoStore().quotations.find((item) => item.id === session?.quotationId);
  const items = getDemoStore().quotationItems.filter((item) => item.quotationId === quotation?.id);
  const tenant = getDemoStore().tenants.find((item) => item.id === quotation?.tenantId);
  const pharmacy = getDemoStore().pharmacies.find((item) => item.id === quotation?.pharmacyId);

  return { session, quotation, items, tenant, pharmacy };
}

export function saveSupplierResponse(response: SupplierQuoteResponse, items: SupplierQuoteResponseItem[]) {
  upsertById(getDemoStore().supplierQuoteResponses, response);
  for (const item of items) upsertById(getDemoStore().supplierQuoteResponseItems, item);
  return response;
}

export function submitSupplierResponse(response: SupplierQuoteResponse, items: SupplierQuoteResponseItem[]) {
  const submitted = {
    ...response,
    status: "submitted" as const,
    submittedAt: new Date().toISOString(),
  };
  return saveSupplierResponse(submitted, items);
}

export function generatePharmacyAnalysis(quotationId = "quote-pharmacy-001") {
  const bundle = getQuotationBundle(quotationId);
  return buildPharmacyAnalysis(
    bundle.items,
    bundle.responseItems,
    bundle.responses,
    getDemoStore().distributors,
  );
}

export function getPharmacyAnalysis(quotationId = "quote-pharmacy-001") {
  return generatePharmacyAnalysis(quotationId);
}

export function generateBiddingAnalysis(quotationId = "quote-bidding-001") {
  const bundle = getQuotationBundle(quotationId);
  return buildBiddingAnalysis(bundle.items, bundle.responseItems, bundle.responses);
}

export function getBiddingAnalysis(quotationId = "quote-bidding-001") {
  return generateBiddingAnalysis(quotationId);
}

export function generateBiddingAwards(quotationItem: QuotationItem, responseItems: SupplierQuoteResponseItem[]) {
  return calculateBiddingAwards(quotationItem, responseItems, getDemoStore().supplierQuoteResponses);
}

export function generatePurchaseOrders(quotationId: string): PurchaseOrder[] {
  const store = getDemoStore();
  const bundle = getQuotationBundle(quotationId);
  const analysis =
    bundle.quotation.moduleType === "bidding"
      ? generateBiddingAnalysis(bundle.quotation.id)
      : generatePharmacyAnalysis(bundle.quotation.id);
  const orders = buildPurchaseOrders(analysis.awards, bundle.items, bundle.responseItems);

  const persisted = orders.map((order, index) => {
    const supplier = store.suppliers.find((item) => item.id === order.supplierId);
    const publicToken =
      order.moduleType === "bidding"
        ? index === 0
          ? "licitacao-pedido-demo-token"
          : `licitacao-pedido-${order.supplierId ?? index}`
        : index === 0
          ? "farmacia-pedido-demo-token"
          : `farmacia-pedido-${order.supplierId ?? index}`;

    const nextOrder: PurchaseOrder = {
      ...order,
      publicToken,
      supplierWhatsapp: supplier?.whatsapp,
      supplierCompany: supplier?.empresa,
      supplierContactName: supplier?.nome,
      status: order.status,
    };
    const existing = store.purchaseOrders.find((item) => item.id === nextOrder.id || item.publicToken === publicToken);
    const merged = existing ? mergePurchaseOrderState(nextOrder, existing) : nextOrder;
    upsertById(store.purchaseOrders, merged);
    return merged;
  });
  if (persisted.length > 0) {
    updateQuotation(bundle.quotation.id, { status: markQuotationGeneratedStatus() });
  }
  return persisted;
}

export function getPurchaseOrdersByQuotation(quotationId: string) {
  const resolvedId = resolveDemoQuotationId(quotationId) ?? quotationId;
  const quotation = getDemoStore().quotations.find((item) => item.id === resolvedId);
  if (quotation && isQuotationDeleted(quotation.status)) return [];
  return getDemoStore().purchaseOrders.filter((order) => order.quotationId === resolvedId);
}

export function getPurchaseOrderByToken(token: string) {
  const resolvedToken = resolveDemoPublicToken(token);
  const store = getDemoStore();
  const allOrders = store.quotations.filter((quotation) => !isQuotationDeleted(quotation.status)).flatMap((quotation) =>
    generatePurchaseOrders(quotation.id),
  );
  const order = (
    store.purchaseOrders.find((order) => order.publicToken === token || order.publicToken === resolvedToken) ??
    allOrders.find((order) => order.publicToken === token || order.publicToken === resolvedToken)
  );
  const quotation = order ? store.quotations.find((item) => item.id === order.quotationId) : undefined;
  if (quotation && isQuotationDeleted(quotation.status)) return undefined;
  return order;
}

export function markPurchaseOrderOpened(token: string) {
  const order = getPurchaseOrderByToken(token);
  if (!order) return undefined;
  if (["gerado", "enviado", "draft", "sent"].includes(order.status)) {
    const opened = {
      ...order,
      status: "aberto_pelo_vendedor" as PurchaseOrderStatus,
      openedAt: new Date().toISOString(),
    };
    upsertById(getDemoStore().purchaseOrders, opened);
    return opened;
  }
  return order;
}

export function savePurchaseOrderReview(
  token: string,
  itemUpdates: Array<{ id: string; fulfillmentStatus: PurchaseOrderItemFulfillmentStatus; vendorObservation?: string; billedQuantity?: number }>,
  finalize = false,
) {
  const order = getPurchaseOrderByToken(token);
  if (!order) throw new Error("Pedido não encontrado ou link expirado.");
  if (isFinalOrderStatus(order.status)) return order;

  const updates = new Map(itemUpdates.map((item) => [item.id, item]));
  const items = order.items.map((item) => {
    const update = updates.get(item.id);
    const fulfillmentStatus = normalizePurchaseOrderFulfillmentStatus(
      update?.fulfillmentStatus ?? item.fulfillmentStatus,
    );
    const billedQuantity = resolveBilledQuantity(item.quantityToBuy, fulfillmentStatus, update?.billedQuantity ?? item.billedQuantity);
    const missingQuantity = Math.max(0, item.quantityToBuy - billedQuantity);
    return {
      ...item,
      fulfillmentStatus,
      billedQuantity,
      missingQuantity,
      vendorObservation: update?.vendorObservation ?? item.vendorObservation ?? "",
    };
  });

  const status = finalize
    ? resolveFinalPurchaseOrderStatus(items)
    : "em_conferencia";
  const confirmedAmount = items
    .reduce((total, item) => total + roundMoney((item.billedQuantity ?? 0) * item.unitPrice), 0);
  const nextOrder = {
    ...order,
    status,
    confirmedAmount,
    completedAt: finalize ? new Date().toISOString() : order.completedAt,
    items,
  } satisfies PurchaseOrder;
  upsertById(getDemoStore().purchaseOrders, nextOrder);
  if (finalize) createWinnerPendingItems(nextOrder);
  return nextOrder;
}

export function getWinnerOrderPendingItems(quotationId?: string) {
  const activeQuotationIds = new Set(
    getDemoStore().quotations.filter((quotation) => !isQuotationDeleted(quotation.status)).map((quotation) => quotation.id),
  );
  return getDemoStore().winnerOrderPendingItems.filter((item) =>
    activeQuotationIds.has(item.quotationId) && (!quotationId || item.quotationId === quotationId),
  );
}

export function redirectWinnerPendingItemToNextSupplier(pendingId: string) {
  const store = getDemoStore();
  const pending = store.winnerOrderPendingItems.find((item) => item.id === pendingId);
  if (!pending) throw new Error("Pendência não encontrada.");
  if (pending.status === "enviado_para_proximo" && pending.nextOrderId) {
    throw new Error("Este item já foi direcionado para outro vendedor.");
  }

  const quotationItem = store.quotationItems.find((item) => item.id === pending.quotationItemId);
  if (!quotationItem) throw new Error("Item da cotação não encontrado.");

  const candidates = store.supplierQuoteResponseItems
    .filter((item) =>
      item.quotationItemId === pending.quotationItemId &&
      getResponseItemUnitPrice(item, getQuotation(pending.quotationId).moduleType) > 0 &&
      item.supplierId !== pending.originalSupplierId,
    )
    .sort((a, b) => getResponseItemUnitPrice(a, getQuotation(pending.quotationId).moduleType) - getResponseItemUnitPrice(b, getQuotation(pending.quotationId).moduleType));
  const nextResponseItem = candidates[0];
  if (!nextResponseItem) throw new Error("Não existe próximo vendedor com preço válido para este item.");

  const response = store.supplierQuoteResponses.find((item) => item.id === nextResponseItem.responseId);
  const supplier = store.suppliers.find((item) => item.id === nextResponseItem.supplierId);
  const moduleType = getQuotation(pending.quotationId).moduleType;
  const quantityToSend = pending.quantity;
  const unitPrice = getResponseItemUnitPrice(nextResponseItem, moduleType);
  const packagesToBuy = nextResponseItem.packageQuantity ? Math.ceil(quantityToSend / nextResponseItem.packageQuantity) : quantityToSend;
  const totalPrice = moduleType === "bidding" && nextResponseItem.packagePrice
    ? roundMoney(packagesToBuy * nextResponseItem.packagePrice)
    : roundMoney(quantityToSend * unitPrice);
  const orderId = `po-${moduleType}-redirect-${pending.quotationItemId}-${nextResponseItem.supplierId ?? nextResponseItem.responseId}`;
  const orderItem: PurchaseOrderItem = {
    id: `poi-redirect-${pending.id}`,
    tenantId: pending.tenantId,
    purchaseOrderId: orderId,
    quotationItemId: pending.quotationItemId,
    productName: quotationItem.productName,
    offeredProductName: nextResponseItem.offeredProductName ?? quotationItem.productName,
    laboratory: nextResponseItem.offeredLaboratory ?? quotationItem.requestedLaboratory,
    unit: quotationItem.requestedUnit,
    quantityToBuy: quantityToSend,
    billedQuantity: 0,
    missingQuantity: quantityToSend,
    packagesToBuy,
    packageQuantity: nextResponseItem.packageQuantity,
    packagePrice: nextResponseItem.packagePrice,
    unitPrice,
    totalPrice,
    observation: nextResponseItem.sellerObservation,
    fulfillmentStatus: "pendente",
    originalSupplierId: nextResponseItem.supplierId,
    originalSupplierName: response?.sellerCompany ?? supplier?.empresa ?? "Fornecedor",
  };
  const order: PurchaseOrder = {
    id: orderId,
    tenantId: pending.tenantId,
    quotationId: pending.quotationId,
    moduleType,
    supplierName: response?.sellerCompany ?? supplier?.empresa ?? "Fornecedor",
    supplierId: nextResponseItem.supplierId,
    supplierWhatsapp: supplier?.whatsapp ?? response?.sellerWhatsapp,
    supplierCompany: supplier?.empresa ?? response?.sellerCompany,
    supplierContactName: supplier?.nome ?? response?.sellerName,
    publicToken: `${moduleType === "bidding" ? "licitacao" : "farmacia"}-pedido-proximo-${pending.quotationItemId}-${nextResponseItem.supplierId ?? nextResponseItem.responseId}`,
    totalAmount: orderItem.totalPrice,
    confirmedAmount: 0,
    status: "gerado",
    generatedAt: new Date().toISOString(),
    items: [orderItem],
  };
  upsertById(store.purchaseOrders, order);
  const updated = {
    ...pending,
    status: "enviado_para_proximo" as const,
    nextSupplierId: nextResponseItem.supplierId,
    nextSupplierName: order.supplierName,
    nextUnitPrice: unitPrice,
    nextOrderId: order.id,
    updatedAt: new Date().toISOString(),
  };
  upsertById(store.winnerOrderPendingItems, updated);
  return { pending: updated, order };
}

export function createQuotationFromWinnerPendingItems(quotationId: string, pendingIds?: string[]) {
  const store = getDemoStore();
  const original = getQuotation(quotationId);
  const pendencies = store.winnerOrderPendingItems.filter((item) =>
    item.quotationId === original.id &&
    item.status === "pendente" &&
    (!pendingIds?.length || pendingIds.includes(item.id)),
  );
  if (pendencies.length === 0) throw new Error("Não há itens pendentes para nova cotação.");

  const newQuotationId = `quote-${original.moduleType}-pending-${Date.now()}`;
  const newQuotation: Quotation = {
    ...original,
    id: newQuotationId,
    name: `${original.name} - itens pendentes`,
    status: "draft",
    notes: original.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  // TODO: preparar integração futura com Gemini para análise de falteiro/estoque e WhatsApp para envio automático ao vendedor.
  upsertById(store.quotations, newQuotation);
  for (const [index, pending] of pendencies.entries()) {
    const originalItem = store.quotationItems.find((item) => item.id === pending.quotationItemId);
    if (!originalItem) continue;
    upsertById(store.quotationItems, {
      ...originalItem,
      id: `quote-item-pending-${pending.id}`,
      quotationId: newQuotationId,
      itemNumber: index + 1,
      requestedQuantity: pending.quantity,
      status: "aguardando_respostas",
    });
    upsertById(store.winnerOrderPendingItems, {
      ...pending,
      status: "nova_cotacao_criada",
      newQuotationId,
      updatedAt: new Date().toISOString(),
    });
  }
  return newQuotation;
}

export function updateWinnerPendingItemStatus(pendingId: string, status: WinnerOrderPendingItem["status"]) {
  const pending = getDemoStore().winnerOrderPendingItems.find((item) => item.id === pendingId);
  if (!pending) throw new Error("Pendência não encontrada.");
  const updated = { ...pending, status, updatedAt: new Date().toISOString() };
  upsertById(getDemoStore().winnerOrderPendingItems, updated);
  return updated;
}

function mergePurchaseOrderState(generated: PurchaseOrder, existing: PurchaseOrder): PurchaseOrder {
  const existingItemsByQuotationItem = new Map(existing.items.map((item) => [item.quotationItemId, item]));
  return {
    ...generated,
    status: existing.status,
    openedAt: existing.openedAt,
    completedAt: existing.completedAt,
    confirmedAmount: existing.confirmedAmount,
    items: generated.items.map((item) => {
      const existingItem = existingItemsByQuotationItem.get(item.quotationItemId);
      return existingItem
        ? {
            ...item,
            fulfillmentStatus: existingItem.fulfillmentStatus ?? item.fulfillmentStatus,
            vendorObservation: existingItem.vendorObservation ?? item.vendorObservation,
          }
        : item;
    }),
  };
}

function isFinalOrderStatus(status: PurchaseOrderStatus) {
  return ["finalizado_pelo_vendedor", "parcialmente_faturado", "nao_faturado", "cancelado", "confirmed", "canceled"].includes(status);
}

function resolveFinalPurchaseOrderStatus(items: PurchaseOrderItem[]): PurchaseOrderStatus {
  const allBilled = items.every((item) => (item.missingQuantity ?? Math.max(0, item.quantityToBuy - (item.billedQuantity ?? 0))) <= 0);
  if (allBilled) return "finalizado_pelo_vendedor";
  const anyBilled = items.some((item) => (item.billedQuantity ?? 0) > 0);
  return anyBilled ? "parcialmente_faturado" : "nao_faturado";
}

function resolveBilledQuantity(
  requestedQuantity: number,
  fulfillmentStatus: PurchaseOrderItemFulfillmentStatus,
  rawValue?: number,
) {
  if (fulfillmentStatus === "faturado") return requestedQuantity;
  if (fulfillmentStatus === "nao_faturado" || fulfillmentStatus === "pendente") return 0;
  const value = Number(rawValue ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), requestedQuantity);
}

function getResponseItemUnitPrice(item: SupplierQuoteResponseItem, moduleType: ModuleType) {
  return moduleType === "bidding"
    ? item.convertedUnitPrice ?? item.unitPrice ?? (
        item.packagePrice && item.packageQuantity ? item.packagePrice / item.packageQuantity : 0
      )
    : item.unitPrice ?? item.netPrice ?? item.convertedUnitPrice ?? 0;
}

function normalizePurchaseOrderFulfillmentStatus(value: unknown): PurchaseOrderItemFulfillmentStatus {
  if (value === "faturado" || value === "parcial" || value === "nao_faturado" || value === "pendente") {
    return value;
  }
  if (value === "a_faturar") return "pendente";
  return "pendente";
}

function createWinnerPendingItems(order: PurchaseOrder) {
  const store = getDemoStore();
  const now = new Date().toISOString();
  for (const item of order.items) {
    const billedQuantity = resolveBilledQuantity(item.quantityToBuy, item.fulfillmentStatus ?? "pendente", item.billedQuantity);
    const missingQuantity = Math.max(0, item.quantityToBuy - billedQuantity);
    if (missingQuantity <= 0) continue;
    const existing = store.winnerOrderPendingItems.find((pending) =>
      pending.purchaseOrderId === order.id &&
      pending.quotationItemId === item.quotationItemId &&
      ["pendente", "enviado_para_proximo"].includes(pending.status),
    );
    if (existing) continue;
    upsertById(store.winnerOrderPendingItems, {
      id: `pending-${order.id}-${item.quotationItemId}`,
      tenantId: order.tenantId,
      quotationId: order.quotationId,
      purchaseOrderId: order.id,
      purchaseOrderItemId: item.id,
      quotationItemId: item.quotationItemId,
      productName: item.productName,
      quantity: missingQuantity,
      requestedQuantity: item.quantityToBuy,
      billedQuantity,
      unit: item.unit,
      originalUnitPrice: item.unitPrice,
      originalTotalPrice: roundMoney(missingQuantity * item.unitPrice),
      originalSupplierId: order.supplierId,
      originalSupplierName: order.supplierName,
      reason: item.vendorObservation || (item.fulfillmentStatus === "parcial" ? "Falta parcial" : "Nao faturado"),
      status: "pendente",
      createdAt: now,
      updatedAt: now,
    });
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getTenant(tenantId = "tenant-bidding") {
  return getDemoStore().tenants.find((tenant) => tenant.id === tenantId) ?? getDemoStore().tenants[0];
}

export function getAdminMetrics(): DashboardMetric[] {
  const store = getDemoStore();
  const activeTenants = store.tenants.filter((tenant) => tenant.status === "ativo").length;
  const trialTenants = store.tenants.filter((tenant) => tenant.status === "teste").length;
  const suspendedTenants = store.tenants.filter((tenant) => tenant.status === "suspenso").length;
  const paid = store.monthlySubscriptions.filter((item) => item.status === "paid").length;
  const overdue = store.monthlySubscriptions.filter((item) => item.status === "overdue").length;
  const revenue = store.tenants
    .filter((tenant) => tenant.status === "ativo" || tenant.status === "teste")
    .reduce((total, tenant) => total + tenant.valorMensal, 0);

  return [
    { label: "Empresas ativas", value: String(activeTenants), hint: "Clientes em produção", tone: "success" },
    { label: "Empresas em teste", value: String(trialTenants), hint: "Avaliação comercial", tone: "info" },
    { label: "Suspensas", value: String(suspendedTenants), hint: "Bloqueio por status", tone: "warning" },
    { label: "Mensalidades pagas", value: String(paid), hint: "Referência atual", tone: "success" },
    { label: "Mensalidades atrasadas", value: String(overdue), hint: "Ação financeira", tone: "danger" },
    { label: "Receita mensal estimada", value: formatCurrency(revenue), hint: "MRR bruto previsto", tone: "default" },
    { label: "Cotações no mês", value: String(store.quotations.filter((quotation) => !isQuotationDeleted(quotation.status)).length), hint: "Farmácia + licitação", tone: "info" },
    { label: "Usuários ativos", value: "12", hint: "Perfis internos", tone: "default" },
    { label: "Erros recentes", value: "0", hint: "Últimas 24 horas", tone: "success" },
  ];
}

export function getCompanyMetrics(tenantId = "tenant-bidding"): DashboardMetric[] {
  const tenant = getTenant(tenantId);
  const tenantQuotations = getDemoStore().quotations.filter(
    (quotation) => quotation.tenantId === tenant.id && !isQuotationDeleted(quotation.status),
  );
  const biddingAnalysis = generateBiddingAnalysis();
  const pharmacyAnalysis = generatePharmacyAnalysis();

  if (tenant.tipoCliente === "pharmacy") {
    return [
      { label: "Cotações abertas", value: formatInteger(tenantQuotations.filter((quotation) => quotation.moduleType === "pharmacy" && isQuotationInProgress(quotation.status)).length), hint: "Com link enviado", tone: "info" },
      { label: "Aguardando resposta", value: formatInteger(tenantQuotations.filter((quotation) => quotation.moduleType === "pharmacy" && quotation.status === "waiting_responses").length), hint: "Fornecedores pendentes", tone: "warning" },
      { label: "Finalizadas", value: formatInteger(tenantQuotations.filter((quotation) => quotation.moduleType === "pharmacy" && quotation.status === "finished").length), hint: "Últimos 30 dias", tone: "success" },
      { label: "Economia estimada", value: formatCurrency(pharmacyAnalysis.totals.estimatedSavings), hint: "Contra última compra", tone: "success" },
      { label: "Produtos sem resposta", value: "0", hint: "Cotação atual", tone: "success" },
      { label: "Vendedor competitivo", value: "Luiza", hint: "Menor preço médio", tone: "default" },
    ];
  }

  return [
    { label: "Cotações abertas", value: formatInteger(tenantQuotations.filter((quotation) => quotation.moduleType === "bidding" && isQuotationInProgress(quotation.status)).length), hint: "Em análise ou resposta", tone: "info" },
    { label: "Itens aguardando", value: "0", hint: "Sem resposta válida", tone: "success" },
    { label: "Atendidos 100%", value: formatInteger(biddingAnalysis.totals.fullySuppliedItems), hint: "Com saldo fechado", tone: "success" },
    { label: "Saldo pendente", value: formatInteger(biddingAnalysis.totals.pendingItems), hint: "Itens a recotar", tone: "warning" },
    { label: "Total sugerido", value: formatCurrency(biddingAnalysis.totals.estimatedTotal), hint: "Pedidos recomendados", tone: "default" },
    { label: "Preço médio unidade", value: formatCurrency(biddingAnalysis.totals.averageUnitPrice), hint: "Respostas válidas", tone: "info" },
  ];
}

export function getDefaultQuotationForModule(moduleType: ModuleType): Quotation {
  return (
    getDemoStore().quotations.find((quotation) => quotation.moduleType === moduleType && !isQuotationDeleted(quotation.status)) ??
    getDemoStore().quotations[0]
  );
}

export interface StoredDemoQuotation {
  id: string;
  moduleType: ModuleType;
  status: Quotation["status"];
  draft: {
    name: string;
    deadlineAt: string;
  };
  items: unknown[];
  suppliers: string[];
  createdAt: string;
}

export function getDemoQuotationStorageKey(moduleType: ModuleType) {
  return moduleType === "bidding"
    ? "cotafarma-demo-bidding-quotations"
    : "cotafarma-demo-pharmacy-quotations";
}

export function getStoredDemoQuotations(moduleType: ModuleType) {
  if (typeof window === "undefined") return [] as StoredDemoQuotation[];

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(getDemoQuotationStorageKey(moduleType)) || "[]",
    ) as StoredDemoQuotation[];
    return parsed.filter((quotation) => quotation.moduleType === moduleType);
  } catch {
    return [];
  }
}

export function saveDemoQuotationToLocalStorage(
  moduleType: ModuleType,
  quotation: StoredDemoQuotation,
) {
  if (typeof window === "undefined") return quotation;

  const current = getStoredDemoQuotations(moduleType);
  window.localStorage.setItem(
    getDemoQuotationStorageKey(moduleType),
    JSON.stringify([quotation, ...current.filter((item) => item.id !== quotation.id)]),
  );

  return quotation;
}
