// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/modules/cotacoes/lib/supabase/server";
import { formatCurrency } from "@/modules/cotacoes/lib/formatters";
import { parseLegacyPurchaseOrderReview } from "@/modules/cotacoes/lib/purchase-order-review-legacy";
import { isQuotationDeleted, isQuotationInProgress } from "@/modules/cotacoes/lib/quotation-status";
import { buildBiddingAnalysis } from "@/modules/cotacoes/lib/services/bidding-analysis";
import { buildPharmacyAnalysis } from "@/modules/cotacoes/lib/services/pharmacy-analysis";
import type {
  AuditLog,
  CustomerType,
  DashboardMetric,
  Distributor,
  Laboratory,
  ModuleType,
  MonthlySubscription,
  Pharmacy,
  Product,
  ProductType,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderItemFulfillmentStatus,
  PurchaseOrderStatus,
  Quotation,
  QuotationItem,
  Supplier,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
  SupplierQuoteSession,
  SubscriptionPlan,
  Tenant,
} from "@/modules/cotacoes/lib/types";
import {
  canUseSupabaseOperational,
  createSupabaseQuotation,
  createSupabaseQuotationFromWinnerPendingItems,
  generateAndPersistSupabasePurchaseOrders,
  getSupabaseWinnerOrderPendingItems,
  getSupabasePublicSession,
  getSupabasePurchaseOrderByToken,
  getSupabaseQuotationBundle,
  listSupabaseQuotations,
  markSupabasePurchaseOrderOpened,
  redirectSupabaseWinnerPendingItemToNextSupplier,
  saveSupabasePurchaseOrderReview,
  updateSupabaseWinnerPendingItemStatus,
} from "./supabase-operational";

type DbClient = ReturnType<typeof createSupabaseAdminClient>;

export function getClientMode() {
  return "supabase" as const;
}

function canUseSupabaseRepository() {
  return hasSupabaseConfig() && hasSupabaseAdminConfig();
}

function db(): DbClient {
  return createSupabaseAdminClient();
}

function requireDb() {
  if (!canUseSupabaseRepository()) {
    throw new Error("Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.");
  }

  return db();
}

function logSupabaseReadError(context: string, error: unknown) {
  console.error(`[Supabase] Falha ao buscar ${context}:`, error);
}

function readDb(context: string): DbClient | null {
  if (!canUseSupabaseRepository()) return null;
  try {
    return db();
  } catch (error) {
    logSupabaseReadError(context, error);
    return null;
  }
}

export async function getCollections() {
  if (!canUseSupabaseRepository()) return emptyCollections();
  const supabase = readDb("colecoes");
  if (!supabase) return emptyCollections();

  const [
    tenants,
    subscriptionPlans,
    monthlySubscriptions,
    pharmacies,
    suppliers,
    distributors,
    laboratories,
    products,
    quotations,
    quotationItems,
    supplierQuoteSessions,
    supplierQuoteResponses,
    supplierQuoteResponseItems,
    auditLogs,
  ] = await Promise.all([
    selectAll(supabase, "tenants", mapTenant),
    selectAll(supabase, "subscription_plans", mapSubscriptionPlan),
    selectAll(supabase, "monthly_subscriptions", mapMonthlySubscription),
    selectAll(supabase, "pharmacies", mapPharmacy),
    selectAll(supabase, "suppliers", mapSupplier),
    selectAll(supabase, "distributors", mapDistributor),
    selectAll(supabase, "laboratories", mapLaboratory),
    selectAll(supabase, "products", mapProduct),
    selectAll(supabase, "quotations", mapQuotation),
    selectAll(supabase, "quotation_items", mapQuotationItem),
    selectAll(supabase, "supplier_quote_sessions", mapSupplierSession),
    selectAll(supabase, "supplier_quote_responses", mapSupplierResponse),
    selectAll(supabase, "supplier_quote_response_items", mapSupplierResponseItem),
    selectAll(supabase, "audit_logs", mapAuditLog),
  ]);

  const activeQuotations = quotations.filter((quotation) => !isQuotationDeleted(quotation.status));
  const activeQuotationIds = new Set(activeQuotations.map((quotation) => quotation.id));

  return {
    tenants,
    subscriptionPlans,
    monthlySubscriptions,
    pharmacies,
    suppliers,
    distributors,
    laboratories,
    products,
    quotations: activeQuotations,
    quotationItems: quotationItems.filter((item) => activeQuotationIds.has(item.quotationId)),
    supplierQuoteSessions: supplierQuoteSessions.filter((session) => activeQuotationIds.has(session.quotationId)),
    supplierQuoteResponses: supplierQuoteResponses.filter((response) => activeQuotationIds.has(response.quotationId)),
    supplierQuoteResponseItems: supplierQuoteResponseItems.filter((item) => activeQuotationIds.has(item.quotationId)),
    auditLogs,
  };
}

export async function getDashboardData(tenantId?: string) {
  return {
    adminMetrics: await getAdminMetrics(),
    companyMetrics: await getCompanyMetrics(tenantId),
    mode: getClientMode(),
  };
}

export async function getTenants() {
  const supabase = readDb("tenants");
  return supabase ? selectAll(supabase, "tenants", mapTenant) : [];
}

export async function createTenant(input: Omit<Tenant, "id"> & { id?: string }) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("tenants")
    .insert(mapTenantToDb(input))
    .select("*")
    .single();
  if (error) throw error;
  return mapTenant(data);
}

export async function updateTenant(id: string, patch: Partial<Tenant>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("tenants")
    .update(mapTenantToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapTenant(data);
}

export async function deleteTenant(id: string) {
  return updateTenant(id, { status: "suspenso" });
}

export async function getPharmacies() {
  const supabase = readDb("pharmacies");
  return supabase ? selectAll(supabase, "pharmacies", mapPharmacy) : [];
}

export async function createPharmacy(input: Omit<Pharmacy, "id"> & { id?: string }) {
  const supabase = requireDb();
  const tenantId = input.tenantId || (await getDefaultTenantId(supabase));
  const { data, error } = await supabase
    .from("pharmacies")
    .insert(mapPharmacyToDb({ ...input, tenantId }))
    .select("*")
    .single();
  if (error) throw error;
  return mapPharmacy(data);
}

export async function updatePharmacy(id: string, patch: Partial<Pharmacy>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("pharmacies")
    .update(mapPharmacyToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapPharmacy(data);
}

export async function deletePharmacy(id: string) {
  return updatePharmacy(id, { status: "inativo" });
}

export async function getProducts() {
  const supabase = readDb("products");
  return supabase ? selectAll(supabase, "products", mapProduct) : [];
}

export async function createProduct(input: Omit<Product, "id"> & { id?: string }) {
  const supabase = requireDb();
  const tenantId = input.tenantId || (await getDefaultTenantId(supabase));
  const { data, error } = await supabase
    .from("products")
    .insert(mapProductToDb({ ...input, tenantId }))
    .select("*")
    .single();
  if (error) throw error;
  return mapProduct(data);
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("products")
    .update(mapProductToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapProduct(data);
}

export async function deleteProduct(id: string) {
  return updateProduct(id, { status: "inativo" });
}

export async function getSuppliers() {
  const supabase = readDb("suppliers");
  return supabase ? selectAll(supabase, "suppliers", mapSupplier) : [];
}

export async function createSupplier(input: Omit<Supplier, "id"> & { id?: string }) {
  const supabase = requireDb();
  const tenantId = input.tenantId || (await getDefaultTenantId(supabase));
  const { data, error } = await supabase
    .from("suppliers")
    .insert(mapSupplierToDb({ ...input, tenantId }))
    .select("*")
    .single();
  if (error) throw error;
  return mapSupplier(data);
}

export async function updateSupplier(id: string, patch: Partial<Supplier>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("suppliers")
    .update(mapSupplierToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapSupplier(data);
}

export async function deleteSupplier(id: string) {
  return updateSupplier(id, { status: "inativo" });
}

export async function getDistributors() {
  const supabase = readDb("distributors");
  return supabase ? selectAll(supabase, "distributors", mapDistributor) : [];
}

export async function createDistributor(input: Omit<Distributor, "id"> & { id?: string }) {
  const supabase = requireDb();
  const tenantId = input.tenantId || (await getDefaultTenantId(supabase));
  const { data, error } = await supabase
    .from("distributors")
    .insert(mapDistributorToDb({ ...input, tenantId }))
    .select("*")
    .single();
  if (error) throw error;
  return mapDistributor(data);
}

export async function updateDistributor(id: string, patch: Partial<Distributor>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("distributors")
    .update(mapDistributorToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapDistributor(data);
}

export async function deleteDistributor(id: string) {
  return updateDistributor(id, { status: "inativo" });
}

export async function getLaboratories() {
  const supabase = readDb("laboratories");
  return supabase ? selectAll(supabase, "laboratories", mapLaboratory) : [];
}

export async function createLaboratory(input: Omit<Laboratory, "id"> & { id?: string }) {
  const supabase = requireDb();
  const tenantId = input.tenantId || (await getDefaultTenantId(supabase));
  const { data, error } = await supabase
    .from("laboratories")
    .insert(mapLaboratoryToDb({ ...input, tenantId }))
    .select("*")
    .single();
  if (error) throw error;
  return mapLaboratory(data);
}

export async function updateLaboratory(id: string, patch: Partial<Laboratory>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("laboratories")
    .update(mapLaboratoryToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapLaboratory(data);
}

export async function deleteLaboratory(id: string) {
  return updateLaboratory(id, { status: "inativo" });
}

export async function createSubscriptionPlan(input: Omit<SubscriptionPlan, "id"> & { id?: string }) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("subscription_plans")
    .insert(mapSubscriptionPlanToDb(input))
    .select("*")
    .single();
  if (error) throw error;
  return mapSubscriptionPlan(data);
}

export async function updateSubscriptionPlan(id: string, patch: Partial<SubscriptionPlan>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("subscription_plans")
    .update(mapSubscriptionPlanToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapSubscriptionPlan(data);
}

export async function deleteSubscriptionPlan(id: string) {
  return updateSubscriptionPlan(id, { status: "inativo" });
}

export async function createMonthlySubscription(input: Omit<MonthlySubscription, "id"> & { id?: string }) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("monthly_subscriptions")
    .insert(mapMonthlySubscriptionToDb(input))
    .select("*")
    .single();
  if (error) throw error;
  return mapMonthlySubscription(data);
}

export async function updateMonthlySubscription(id: string, patch: Partial<MonthlySubscription>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("monthly_subscriptions")
    .update(mapMonthlySubscriptionToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapMonthlySubscription(data);
}

export async function deleteMonthlySubscription(id: string) {
  return updateMonthlySubscription(id, { status: "canceled" });
}

export async function getPharmacyQuotations() {
  return getQuotationsByModule("pharmacy");
}

export async function getBiddingQuotations() {
  return getQuotationsByModule("bidding");
}

export async function getQuotationsByModule(moduleType: ModuleType) {
  return listQuotationsByModule(moduleType);
}

export async function listQuotationsByModule(moduleType: ModuleType) {
  if (!canUseSupabaseOperational()) return [];
  try {
    return await listSupabaseQuotations(moduleType);
  } catch (error) {
    logSupabaseReadError("quotations", error);
    return [];
  }
}

export async function getQuotationById(id: string) {
  const bundle = await getQuotationBundle(id);
  return bundle.quotation.id === id ? bundle.quotation : undefined;
}

export async function getQuotation(id: string) {
  const quotation = await getQuotationById(id);
  return quotation ?? getDefaultQuotationForModule("bidding");
}

export async function createQuotation(input: any) {
  const result = await createSupabaseQuotation({
    moduleType: input.moduleType,
    status: input.status ?? "draft",
    draft: input.draft ?? input,
    items: input.items ?? [],
    suppliers: input.suppliers ?? [],
  });
  return result.quotation;
}

export async function updateQuotation(id: string, patch: Partial<Quotation>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("quotations")
    .update(mapQuotationToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapQuotation(data);
}

export async function deleteQuotation(id: string) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("quotations")
    .update({
      status: "excluida",
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapQuotation(data);
}

export async function getQuotationItems(quotationId: string) {
  const supabase = readDb("quotation_items");
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("item_number", { ascending: true });
    if (error) {
      logSupabaseReadError("quotation_items", error);
      return [];
    }
    return (data ?? []).map(mapQuotationItem);
  } catch (error) {
    logSupabaseReadError("quotation_items", error);
    return [];
  }
}

export async function createQuotationItem(input: Omit<QuotationItem, "id"> & { id?: string }) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("quotation_items")
    .insert(mapQuotationItemToDb(input))
    .select("*")
    .single();
  if (error) throw error;
  return mapQuotationItem(data);
}

export async function updateQuotationItem(id: string, patch: Partial<QuotationItem>) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("quotation_items")
    .update(mapQuotationItemToDb(patch))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapQuotationItem(data);
}

export async function deleteQuotationItem(id: string) {
  const { error } = await requireDb().from("quotation_items").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function getQuotationBundle(id: string) {
  const bundle = canUseSupabaseOperational() ? await getSupabaseQuotationBundle(id).catch((error) => {
    logSupabaseReadError("quotation bundle", error);
    return null;
  }) : null;
  if (bundle) return bundle;
  return {
    quotation: { ...notFoundQuotation, id },
    items: [] as QuotationItem[],
    responses: [] as SupplierQuoteResponse[],
    responseItems: [] as SupplierQuoteResponseItem[],
  };
}

export async function getSupplierSessions(quotationId?: string) {
  const supabase = readDb("supplier_quote_sessions");
  if (!supabase) return [];
  try {
    let query = supabase.from("supplier_quote_sessions").select("*").order("created_at", { ascending: false });
    if (quotationId) query = query.eq("quotation_id", quotationId);
    const { data, error } = await query;
    if (error) {
      logSupabaseReadError("supplier_quote_sessions", error);
      return [];
    }
    return (data ?? []).map(mapSupplierSession);
  } catch (error) {
    logSupabaseReadError("supplier_quote_sessions", error);
    return [];
  }
}

export async function createSupplierSession(input: Omit<SupplierQuoteSession, "id" | "publicToken"> & { id?: string; publicToken?: string }) {
  const supabase = requireDb();
  const { data, error } = await supabase
    .from("supplier_quote_sessions")
    .insert(mapSupplierSessionToDb(input))
    .select("*")
    .single();
  if (error) throw error;
  return mapSupplierSession(data);
}

export async function getSessionByToken(token: string) {
  const supabase = readDb("supplier_quote_sessions por token");
  if (!supabase) return undefined;
  try {
    const { data, error } = await supabase
      .from("supplier_quote_sessions")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();
    if (error) {
      logSupabaseReadError("supplier_quote_sessions por token", error);
      return undefined;
    }
    return data ? mapSupplierSession(data) : undefined;
  } catch (error) {
    logSupabaseReadError("supplier_quote_sessions por token", error);
    return undefined;
  }
}

export async function getPublicSession(token: string, moduleType: ModuleType) {
  try {
    return await getSupabasePublicSession(token, moduleType);
  } catch (error) {
    logSupabaseReadError("sessao publica", error);
    return null;
  }
}

export async function saveSupplierResponse(response: SupplierQuoteResponse) {
  return upsertSupplierResponse(response);
}

export async function submitSupplierResponse(response: SupplierQuoteResponse) {
  return upsertSupplierResponse({
    ...response,
    status: "submitted",
    submittedAt: new Date().toISOString(),
  });
}

export async function generatePharmacyAnalysis(quotationId?: string) {
  return getPharmacyAnalysis(quotationId);
}

export async function getPharmacyAnalysis(quotationId?: string) {
  const id = quotationId ?? (await getFirstQuotationId("pharmacy"));
  if (!id) return buildPharmacyAnalysis([], [], [], []);
  const bundle = await getQuotationBundle(id);
  const distributors = await getDistributors();
  return buildPharmacyAnalysis(bundle.items, bundle.responseItems, bundle.responses, distributors);
}

export async function generateBiddingAnalysis(quotationId?: string) {
  return getBiddingAnalysis(quotationId);
}

export async function getBiddingAnalysis(quotationId?: string) {
  const id = quotationId ?? (await getFirstQuotationId("bidding"));
  if (!id) return buildBiddingAnalysis([], [], []);
  const bundle = await getQuotationBundle(id);
  return buildBiddingAnalysis(bundle.items, bundle.responseItems, bundle.responses);
}

export function generateBiddingAwards(quotationItem: QuotationItem, responseItems: SupplierQuoteResponseItem[]) {
  return buildBiddingAnalysis([quotationItem], responseItems, []).awards;
}

export async function generatePurchaseOrders(quotationId: string) {
  return generateAndPersistSupabasePurchaseOrders(quotationId);
}

export async function getPurchaseOrdersByQuotation(quotationId: string) {
  const supabase = readDb("purchase_orders");
  if (!supabase) return [];
  try {
    const { data: quotationRow, error: quotationError } = await supabase
      .from("quotations")
      .select("status,deleted_at")
      .eq("id", quotationId)
      .maybeSingle();
    if (quotationError || !quotationRow || isQuotationDeleted(quotationRow.status) || quotationRow.deleted_at) return [];

    const { data: orderRows, error: orderError } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: false });
    if (orderError) {
      logSupabaseReadError("purchase_orders", orderError);
      return [];
    }
    if (!orderRows?.length) return [];

    const orderIds = orderRows.map((row) => row.id);
    const { data: itemRows, error: itemError } = await supabase
      .from("purchase_order_items")
      .select("*")
      .in("purchase_order_id", orderIds);
    if (itemError) {
      logSupabaseReadError("purchase_order_items", itemError);
      return [];
    }

    const orders = orderRows.map((order) =>
      mapPurchaseOrder(
        order,
        (itemRows ?? []).filter((item) => item.purchase_order_id === order.id),
      ),
    );
    return enrichPurchaseOrdersWithSuppliers(supabase, orders);
  } catch (error) {
    logSupabaseReadError("purchase_orders", error);
    return [];
  }
}

export async function getPurchaseOrderByToken(token: string) {
  const order = canUseSupabaseOperational() ? await getSupabasePurchaseOrderByToken(token).catch((error) => {
    logSupabaseReadError("pedido publico", error);
    return null;
  }) : null;
  return order;
}

export async function markPurchaseOrderOpened(token: string) {
  return markSupabasePurchaseOrderOpened(token);
}

export async function savePurchaseOrderReview(
  token: string,
  itemUpdates: Parameters<typeof saveSupabasePurchaseOrderReview>[1],
  finalize?: boolean,
) {
  return saveSupabasePurchaseOrderReview(token, itemUpdates, finalize);
}

export async function getWinnerOrderPendingItems(quotationId?: string) {
  return getSupabaseWinnerOrderPendingItems(quotationId);
}

export async function redirectWinnerPendingItemToNextSupplier(pendingId: string) {
  return redirectSupabaseWinnerPendingItemToNextSupplier(pendingId);
}

export async function createQuotationFromWinnerPendingItems(quotationId: string, pendingIds?: string[]) {
  return createSupabaseQuotationFromWinnerPendingItems(quotationId, pendingIds);
}

export async function updateWinnerPendingItemStatus(
  pendingId: string,
  status: Parameters<typeof updateSupabaseWinnerPendingItemStatus>[1],
) {
  return updateSupabaseWinnerPendingItemStatus(pendingId, status);
}

export async function getTenant(tenantId?: string) {
  const tenants = await getTenants();
  return tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0] ?? getEmptyTenant();
}

export async function getAdminMetrics(): Promise<DashboardMetric[]> {
  if (!canUseSupabaseRepository()) return [];
  const collections = await getCollections();
  const active = collections.tenants.filter((tenant) => tenant.status === "ativo").length;
  const trial = collections.tenants.filter((tenant) => tenant.status === "teste").length;
  const suspended = collections.tenants.filter((tenant) => tenant.status === "suspenso").length;
  const paid = collections.monthlySubscriptions.filter((sub) => sub.status === "paid").length;
  const overdue = collections.monthlySubscriptions.filter((sub) => sub.status === "overdue").length;
  const revenue = collections.tenants
    .filter((tenant) => tenant.status === "ativo" || tenant.status === "teste")
    .reduce((total, tenant) => total + tenant.valorMensal, 0);
  const quotationsThisMonth = collections.quotations.filter((quotation) => {
    const created = new Date(quotation.createdAt);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;

  return [
    { label: "Empresas ativas", value: String(active), hint: "Clientes operando", tone: "success" },
    { label: "Empresas em teste", value: String(trial), hint: "Avaliação comercial", tone: "info" },
    { label: "Suspensas", value: String(suspended), hint: "Bloqueio por status", tone: "warning" },
    { label: "Mensalidades pagas", value: String(paid), hint: "Referência atual", tone: "success" },
    { label: "Mensalidades atrasadas", value: String(overdue), hint: "Ação financeira", tone: "danger" },
    { label: "Receita mensal estimada", value: formatCurrency(revenue), hint: "MRR bruto previsto", tone: "default" },
    { label: "Cotações no mês", value: String(quotationsThisMonth), hint: "Farmácia + licitação", tone: "info" },
    { label: "Usuários ativos", value: "-", hint: "Supabase Auth", tone: "default" },
    { label: "Erros recentes", value: "0", hint: "Auditoria sem erro crítico", tone: "success" },
  ];
}

export async function getCompanyMetrics(tenantId?: string): Promise<DashboardMetric[]> {
  if (!canUseSupabaseRepository()) return [];
  const collections = await getCollections();
  const tenant = tenantId
    ? collections.tenants.find((item) => item.id === tenantId)
    : collections.tenants[0];
  const quotations = tenant
    ? collections.quotations.filter((quotation) => quotation.tenantId === tenant.id)
    : collections.quotations;
  const open = quotations.filter((quotation) => isQuotationInProgress(quotation.status)).length;
  const finished = quotations.filter((quotation) => quotation.status === "finished").length;
  const bidding = quotations.filter((quotation) => quotation.moduleType === "bidding").length;
  const pharmacy = quotations.filter((quotation) => quotation.moduleType === "pharmacy").length;
  const responses = collections.supplierQuoteResponses.filter((response) =>
    quotations.some((quotation) => quotation.id === response.quotationId),
  ).length;

  return [
    { label: "Cotações abertas", value: String(open), hint: "Aguardando resposta", tone: "info" },
    { label: "Respostas recebidas", value: String(responses), hint: "Fornecedores responderam", tone: "success" },
    { label: "Finalizadas", value: String(finished), hint: "Pedidos ou análise concluída", tone: "success" },
    { label: "Licitações", value: String(bidding), hint: "Módulo por unidade", tone: "default" },
    { label: "Farmácia", value: String(pharmacy), hint: "Módulo menor preço", tone: "default" },
    { label: "Fornecedores", value: String(collections.suppliers.length), hint: "Base cadastrada", tone: "info" },
  ];
}

export function getDefaultQuotationForModule(moduleType: ModuleType): Quotation {
  return { ...notFoundQuotation, moduleType };
}

async function selectAll<T>(supabase: DbClient, table: string, mapper: (row: Record<string, any>) => T): Promise<T[]> {
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      logSupabaseReadError(table, error);
      return [];
    }
    return (data ?? []).map(mapper);
  } catch (error) {
    logSupabaseReadError(table, error);
    return [];
  }
}

async function getDefaultTenantId(supabase: DbClient) {
  const { data, error } = await supabase.from("tenants").select("id").limit(1).maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Cadastre uma empresa cliente antes de criar registros.");
  return data.id as string;
}

async function getFirstQuotationId(moduleType: ModuleType) {
  const quotations = await listQuotationsByModule(moduleType);
  return quotations[0]?.id;
}

async function upsertSupplierResponse(response: SupplierQuoteResponse) {
  const supabase = requireDb();
  const payload = mapSupplierResponseToDb(response);
  const query = response.id
    ? supabase.from("supplier_quote_responses").upsert({ id: response.id, ...payload }).select("*").single()
    : supabase.from("supplier_quote_responses").insert(payload).select("*").single();
  const { data, error } = await query;
  if (error) throw error;
  return mapSupplierResponse(data);
}

function emptyCollections() {
  return {
    tenants: [] as Tenant[],
    subscriptionPlans: [],
    monthlySubscriptions: [] as MonthlySubscription[],
    pharmacies: [],
    suppliers: [] as Supplier[],
    distributors: [] as Distributor[],
    laboratories: [] as Laboratory[],
    products: [] as Product[],
    quotations: [] as Quotation[],
    quotationItems: [] as QuotationItem[],
    supplierQuoteSessions: [] as SupplierQuoteSession[],
    supplierQuoteResponses: [] as SupplierQuoteResponse[],
    supplierQuoteResponseItems: [] as SupplierQuoteResponseItem[],
    auditLogs: [] as AuditLog[],
  };
}

const notFoundQuotation: Quotation = {
  id: "not-found",
  tenantId: "not-found",
  moduleType: "bidding",
  name: "Registro não encontrado",
  deadlineAt: new Date().toISOString(),
  allowPartialSupply: true,
  allowEquivalent: true,
  considerMinimumOrder: false,
  notes: "Registro não encontrado no Supabase.",
  status: "draft",
  createdBy: "system",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function getEmptyTenant(): Tenant {
  return {
    id: "not-found",
    nomeFantasia: "Empresa não cadastrada",
    razaoSocial: "Empresa não cadastrada",
    cnpj: "",
    tipoCliente: "both",
    responsavelNome: "",
    responsavelEmail: "",
    responsavelWhatsapp: "",
    planoId: "",
    status: "teste",
    dataInicio: new Date().toISOString(),
    dataVencimento: new Date().toISOString(),
    valorMensal: 0,
  };
}

function mapTenant(row: Record<string, any>): Tenant {
  return {
    id: row.id,
    nomeFantasia: row.nome_fantasia,
    razaoSocial: row.razao_social,
    cnpj: row.cnpj,
    tipoCliente: row.tipo_cliente,
    responsavelNome: row.responsavel_nome,
    responsavelEmail: row.responsavel_email,
    responsavelWhatsapp: row.responsavel_whatsapp ?? "",
    planoId: row.plano_id ?? "",
    status: row.status,
    dataInicio: row.data_inicio,
    dataVencimento: row.data_vencimento ?? "",
    valorMensal: Number(row.valor_mensal ?? 0),
  };
}

function mapTenantToDb(input: Partial<Tenant>) {
  return stripUndefined({
    nome_fantasia: input.nomeFantasia,
    razao_social: input.razaoSocial,
    cnpj: input.cnpj,
    tipo_cliente: input.tipoCliente,
    responsavel_nome: input.responsavelNome,
    responsavel_email: input.responsavelEmail,
    responsavel_whatsapp: input.responsavelWhatsapp,
    plano_id: input.planoId || null,
    status: input.status,
    data_inicio: input.dataInicio,
    data_vencimento: input.dataVencimento || null,
    valor_mensal: input.valorMensal,
  });
}

function mapSupplier(row: Record<string, any>): Supplier {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nome: row.nome,
    empresa: row.empresa,
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? undefined,
    tipoFornecedor: row.tipo_fornecedor,
    observacao: row.observacao ?? undefined,
    status: row.status,
  };
}

function mapSupplierToDb(input: Partial<Supplier>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    nome: input.nome,
    empresa: input.empresa,
    whatsapp: input.whatsapp,
    email: input.email || null,
    tipo_fornecedor: input.tipoFornecedor,
    observacao: input.observacao || null,
    status: input.status,
  });
}

function mapDistributor(row: Record<string, any>): Distributor {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nome: row.nome,
    unidadeCd: row.unidade_cd ?? "",
    uf: row.uf ?? "",
    pedidoMinimo: Number(row.pedido_minimo ?? 0),
    prazoMedio: row.prazo_medio ?? "",
    portal: row.portal ?? undefined,
    observacao: row.observacao ?? undefined,
    status: row.status,
  };
}

function mapDistributorToDb(input: Partial<Distributor>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    nome: input.nome,
    unidade_cd: input.unidadeCd,
    uf: input.uf,
    pedido_minimo: input.pedidoMinimo,
    prazo_medio: input.prazoMedio,
    portal: input.portal || null,
    observacao: input.observacao || null,
    status: input.status,
  });
}

function mapLaboratory(row: Record<string, any>): Laboratory {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nome: row.nome,
    cnpj: row.cnpj ?? undefined,
    tipo: row.tipo,
    status: row.status,
  };
}

function mapLaboratoryToDb(input: Partial<Laboratory>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    nome: input.nome,
    cnpj: input.cnpj || null,
    tipo: input.tipo,
    status: input.status,
  });
}

function mapProduct(row: Record<string, any>): Product {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nome: row.nome,
    principioAtivo: row.principio_ativo ?? undefined,
    dosagem: row.dosagem ?? undefined,
    forma: row.forma ?? undefined,
    tipoProduto: row.tipo_produto,
    laboratorioId: row.laboratorio_id ?? undefined,
    ean: row.ean ?? undefined,
    unidadeBase: row.unidade_base ?? "UN",
    apresentacao: row.apresentacao ?? "",
    quantidadePorEmbalagem: Number(row.quantidade_por_embalagem ?? 1),
    status: row.status,
  };
}

function mapProductToDb(input: Partial<Product>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    nome: input.nome,
    principio_ativo: input.principioAtivo || null,
    dosagem: input.dosagem || null,
    forma: input.forma || null,
    tipo_produto: input.tipoProduto,
    laboratorio_id: input.laboratorioId || null,
    ean: input.ean || null,
    unidade_base: input.unidadeBase,
    apresentacao: input.apresentacao || null,
    quantidade_por_embalagem: input.quantidadePorEmbalagem,
    status: input.status,
  });
}

function mapQuotation(row: Record<string, any>): Quotation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    moduleType: row.module_type,
    name: row.name,
    pharmacyId: row.pharmacy_id ?? undefined,
    buyerCompanyName: row.buyer_company_name ?? undefined,
    destinationClient: row.destination_client ?? undefined,
    orgaoDestino: row.orgao_destino ?? undefined,
    processNumber: row.process_number ?? undefined,
    bidNumber: row.bid_number ?? undefined,
    quotationType: row.quotation_type as ProductType | undefined,
    judgmentType: row.judgment_type ?? undefined,
    deadlineAt: row.deadline_at,
    allowPartialSupply: Boolean(row.allow_partial_supply),
    allowEquivalent: Boolean(row.allow_equivalent),
    considerMinimumOrder: Boolean(row.consider_minimum_order),
    notes: row.notes ?? undefined,
    status: row.deleted_at ? "excluida" : row.status,
    createdBy: row.created_by ?? "system",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQuotationToDb(input: Partial<Quotation>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    module_type: input.moduleType,
    name: input.name,
    pharmacy_id: input.pharmacyId || null,
    buyer_company_name: input.buyerCompanyName || null,
    destination_client: input.destinationClient || null,
    orgao_destino: input.orgaoDestino || null,
    process_number: input.processNumber || null,
    bid_number: input.bidNumber || null,
    quotation_type: input.quotationType || null,
    judgment_type: input.judgmentType || null,
    deadline_at: input.deadlineAt || null,
    allow_partial_supply: input.allowPartialSupply,
    allow_equivalent: input.allowEquivalent,
    consider_minimum_order: input.considerMinimumOrder,
    notes: input.notes || null,
    status: input.status,
    created_by: input.createdBy === "system" ? null : input.createdBy,
  });
}

function mapQuotationItem(row: Record<string, any>): QuotationItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    quotationId: row.quotation_id,
    moduleType: row.module_type,
    itemNumber: Number(row.item_number ?? 1),
    productId: row.product_id ?? undefined,
    productName: row.product_name,
    activeIngredient: row.active_ingredient ?? undefined,
    dosage: row.dosage ?? undefined,
    ean: row.ean ?? undefined,
    requestedQuantity: Number(row.requested_quantity ?? 0),
    requestedUnit: row.requested_unit ?? "UN",
    requestedLaboratory: row.requested_laboratory ?? undefined,
    laboratoryRequired: Boolean(row.laboratory_required),
    productType: row.product_type ?? "outros",
    acceptEquivalent: Boolean(row.accept_equivalent),
    allowPartialSupply: Boolean(row.allow_partial_supply),
    minimumValidity: row.minimum_validity ?? undefined,
    msRegistrationRequired: Boolean(row.ms_registration_required),
    maxDeliveryDays: row.max_delivery_days ? Number(row.max_delivery_days) : undefined,
    lotGroup: row.lot_group ?? undefined,
    buyerObservation: row.buyer_observation ?? undefined,
    lastPurchasePrice: row.last_purchase_price ? Number(row.last_purchase_price) : undefined,
    lastPurchaseDate: row.last_purchase_date ?? undefined,
    status: row.status,
  };
}

function mapQuotationItemToDb(input: Partial<QuotationItem>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    quotation_id: input.quotationId,
    module_type: input.moduleType,
    item_number: input.itemNumber,
    product_id: input.productId || null,
    product_name: input.productName,
    active_ingredient: input.activeIngredient || null,
    dosage: input.dosage || null,
    ean: input.ean || null,
    requested_quantity: input.requestedQuantity,
    requested_unit: input.requestedUnit,
    requested_laboratory: input.requestedLaboratory || null,
    laboratory_required: input.laboratoryRequired,
    product_type: input.productType,
    accept_equivalent: input.acceptEquivalent,
    allow_partial_supply: input.allowPartialSupply,
    minimum_validity: input.minimumValidity || null,
    ms_registration_required: input.msRegistrationRequired,
    max_delivery_days: input.maxDeliveryDays,
    lot_group: input.lotGroup || null,
    buyer_observation: input.buyerObservation || null,
    last_purchase_price: input.lastPurchasePrice,
    last_purchase_date: input.lastPurchaseDate || null,
    status: input.status,
  });
}

function mapSupplierSession(row: Record<string, any>): SupplierQuoteSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    quotationId: row.quotation_id,
    supplierId: row.supplier_id ?? undefined,
    publicToken: row.public_token,
    sellerName: row.seller_name ?? "",
    sellerCompany: row.seller_company ?? "",
    sellerWhatsapp: row.seller_whatsapp ?? "",
    sellerEmail: row.seller_email ?? undefined,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at ?? undefined,
    status: row.status,
  };
}

function mapSupplierSessionToDb(input: Partial<SupplierQuoteSession>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    quotation_id: input.quotationId,
    supplier_id: input.supplierId || null,
    public_token: input.publicToken,
    seller_name: input.sellerName,
    seller_company: input.sellerCompany,
    seller_whatsapp: input.sellerWhatsapp,
    seller_email: input.sellerEmail || null,
    expires_at: input.expiresAt,
    submitted_at: input.submittedAt || null,
    status: input.status,
  });
}

function mapSupplierResponse(row: Record<string, any>): SupplierQuoteResponse {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    quotationId: row.quotation_id,
    sessionId: row.session_id,
    supplierId: row.supplier_id ?? undefined,
    sellerName: row.seller_name ?? "",
    sellerCompany: row.seller_company ?? "",
    sellerWhatsapp: row.seller_whatsapp ?? "",
    sellerEmail: row.seller_email ?? undefined,
    billingCompany: row.billing_company ?? undefined,
    paymentTerms: row.payment_terms ?? undefined,
    deliveryTerms: row.delivery_terms ?? undefined,
    generalObservation: row.general_observation ?? undefined,
    status: row.status,
    submittedAt: row.submitted_at ?? undefined,
  };
}

function mapSupplierResponseToDb(input: Partial<SupplierQuoteResponse>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    quotation_id: input.quotationId,
    session_id: input.sessionId,
    supplier_id: input.supplierId || null,
    seller_name: input.sellerName,
    seller_company: input.sellerCompany,
    seller_whatsapp: input.sellerWhatsapp,
    seller_email: input.sellerEmail || null,
    billing_company: input.billingCompany || null,
    payment_terms: input.paymentTerms || null,
    delivery_terms: input.deliveryTerms || null,
    general_observation: input.generalObservation || null,
    status: input.status,
    submitted_at: input.submittedAt || null,
  });
}

function mapSupplierResponseItem(row: Record<string, any>): SupplierQuoteResponseItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    quotationId: row.quotation_id,
    quotationItemId: row.quotation_item_id,
    responseId: row.response_id,
    supplierId: row.supplier_id ?? undefined,
    offeredProductName: row.offered_product_name ?? undefined,
    offeredLaboratory: row.offered_laboratory ?? undefined,
    offeredUnit: row.offered_unit ?? undefined,
    packageQuantity: row.package_quantity ? Number(row.package_quantity) : undefined,
    packagePrice: row.package_price ? Number(row.package_price) : undefined,
    hasFullQuantity: row.has_full_quantity ?? undefined,
    availableQuantity: row.available_quantity ? Number(row.available_quantity) : undefined,
    deliveryDays: row.delivery_days ? Number(row.delivery_days) : undefined,
    deliveryTermText: row.delivery_term_text ?? undefined,
    sellerObservation: row.seller_observation ?? undefined,
    unitPrice: row.unit_price ? Number(row.unit_price) : undefined,
    grossPrice: row.gross_price ? Number(row.gross_price) : undefined,
    extraDiscount: row.discount_extra ? Number(row.discount_extra) : undefined,
    netPrice: row.net_price ? Number(row.net_price) : undefined,
    hasStock: row.has_stock ?? undefined,
    distributorId: row.distributor_id ?? undefined,
    convertedUnitPrice: row.converted_unit_price ? Number(row.converted_unit_price) : undefined,
    requiredPackagesTotal: row.required_packages_total ? Number(row.required_packages_total) : undefined,
    packagesToBuy: row.packages_to_buy ? Number(row.packages_to_buy) : undefined,
    quantityToBuy: row.quantity_to_buy ? Number(row.quantity_to_buy) : undefined,
    quantityShortage: row.quantity_shortage ? Number(row.quantity_shortage) : undefined,
    technicalSurplus: row.technical_surplus ? Number(row.technical_surplus) : undefined,
    totalPriceIfFull: row.total_price_if_full ? Number(row.total_price_if_full) : undefined,
    totalPriceAvailable: row.total_price_available ? Number(row.total_price_available) : undefined,
    rankingPosition: row.ranking_position ?? undefined,
    awardStatus: row.award_status ?? undefined,
    alertStatus: row.alert_status ?? undefined,
  };
}

function mapPurchaseOrder(row: Record<string, any>, itemRows: Record<string, any>[]): PurchaseOrder {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    quotationId: row.quotation_id,
    moduleType: row.module_type,
    supplierName: row.supplier_name,
    supplierId: row.supplier_id ?? undefined,
    supplierWhatsapp: row.supplier_whatsapp ?? undefined,
    supplierCompany: row.supplier_company ?? undefined,
    supplierContactName: row.supplier_contact_name ?? undefined,
    publicToken: row.public_token,
    totalAmount: Number(row.total_amount ?? 0),
    status: normalizePurchaseOrderStatus(row),
    generatedAt: row.created_at ?? undefined,
    openedAt: row.opened_at ?? undefined,
    completedAt: row.completed_at ?? row.finalizado_em ?? row.conferido_em ?? (row.status === "confirmed" ? row.updated_at : undefined) ?? undefined,
    confirmedAmount: row.confirmed_amount != null ? Number(row.confirmed_amount) : undefined,
    items: itemRows.map(mapPurchaseOrderItem),
  };
}

function mapPurchaseOrderItem(item: Record<string, any>): PurchaseOrderItem {
  const legacyReview = parseLegacyPurchaseOrderReview(item.observation);
  return {
    id: item.id,
    tenantId: item.tenant_id,
    purchaseOrderId: item.purchase_order_id,
    quotationItemId: item.quotation_item_id,
    productName: item.product_name,
    offeredProductName: item.offered_product_name ?? undefined,
    laboratory: item.laboratory ?? undefined,
    unit: item.unit ?? "UN",
    quantityToBuy: Number(item.quantity_to_buy ?? 0),
    billedQuantity: item.billed_quantity != null ? Number(item.billed_quantity) : undefined,
    missingQuantity: item.missing_quantity != null ? Number(item.missing_quantity) : undefined,
    packagesToBuy: item.packages_to_buy ? Number(item.packages_to_buy) : undefined,
    packageQuantity: item.package_quantity ? Number(item.package_quantity) : undefined,
    packagePrice: item.package_price ? Number(item.package_price) : undefined,
    unitPrice: Number(item.unit_price ?? 0),
    totalPrice: Number(item.total_price ?? 0),
    observation: legacyReview?.observation || item.observation || undefined,
    fulfillmentStatus: normalizePurchaseOrderFulfillmentStatus(
      item.fulfillment_status ?? item.status_faturamento ?? legacyReview?.fulfillmentStatus,
    ),
    vendorObservation: item.vendor_observation ?? item.observacao_faturamento ?? legacyReview?.vendorObservation ?? undefined,
    originalSupplierId: item.original_supplier_id ?? undefined,
    originalSupplierName: item.original_supplier_name ?? undefined,
  };
}

function normalizePurchaseOrderFulfillmentStatus(value: unknown): PurchaseOrderItemFulfillmentStatus {
  if (value === "faturado" || value === "parcial" || value === "nao_faturado" || value === "pendente") {
    return value;
  }
  if (value === "a_faturar") return "pendente";
  return "pendente";
}

function normalizePurchaseOrderStatus(row: Record<string, any>): PurchaseOrderStatus {
  if (
    row.pedido_finalizado === true &&
    !["finalizado_pelo_vendedor", "parcialmente_faturado", "nao_faturado", "confirmed"].includes(String(row.status))
  ) {
    return "finalizado_pelo_vendedor";
  }
  return row.status;
}

async function enrichPurchaseOrdersWithSuppliers(supabase: DbClient, orders: PurchaseOrder[]) {
  const supplierIds = Array.from(new Set(orders.map((order) => order.supplierId).filter(Boolean))) as string[];
  if (supplierIds.length === 0) return orders;

  const { data, error } = await supabase
    .from("suppliers")
    .select("id,nome,empresa,whatsapp")
    .in("id", supplierIds);
  if (error) {
    logSupabaseReadError("suppliers dos pedidos", error);
    return orders;
  }

  const suppliersById = new Map((data ?? []).map((supplier) => [supplier.id, supplier as Supplier]));
  return orders.map((order) => enrichPurchaseOrderWithSupplier(order, suppliersById.get(order.supplierId ?? "")));
}

function enrichPurchaseOrderWithSupplier(order: PurchaseOrder, supplier?: Pick<Supplier, "nome" | "empresa" | "whatsapp">) {
  if (!supplier) return order;
  return {
    ...order,
    supplierWhatsapp: order.supplierWhatsapp ?? supplier.whatsapp,
    supplierCompany: order.supplierCompany ?? supplier.empresa,
    supplierContactName: order.supplierContactName ?? supplier.nome,
  };
}

function mapSubscriptionPlan(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    monthlyPrice: Number(row.monthly_price ?? 0),
    maxUsers: Number(row.max_users ?? 1),
    maxQuotationsMonth: Number(row.max_quotations_month ?? 0),
    maxPharmacies: Number(row.max_pharmacies ?? 1),
    modules: row.modules as CustomerType,
    status: row.status,
    observation: row.observation ?? undefined,
  };
}

function mapSubscriptionPlanToDb(input: Partial<SubscriptionPlan>) {
  return stripUndefined({
    name: input.name,
    monthly_price: input.monthlyPrice,
    max_users: input.maxUsers,
    max_quotations_month: input.maxQuotationsMonth,
    max_pharmacies: input.maxPharmacies,
    modules: input.modules,
    status: input.status,
    observation: input.observation,
  });
}

function mapMonthlySubscription(row: Record<string, any>): MonthlySubscription {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    planId: row.plan_id ?? undefined,
    referenceMonth: row.reference_month,
    dueDate: row.due_date,
    amount: Number(row.amount ?? 0),
    status: row.status,
    paymentMethod: row.payment_method ?? undefined,
    paidAt: row.paid_at ?? undefined,
    paidAmount: row.paid_amount ? Number(row.paid_amount) : undefined,
    manualPaymentNote: row.manual_payment_note ?? undefined,
    txid: row.txid ?? undefined,
    efiStatus: row.efi_status ?? undefined,
  };
}

function mapMonthlySubscriptionToDb(input: Partial<MonthlySubscription>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    plan_id: input.planId,
    reference_month: input.referenceMonth,
    due_date: input.dueDate,
    amount: input.amount,
    status: input.status,
    payment_method: input.paymentMethod,
    paid_at: input.paidAt,
    paid_amount: input.paidAmount,
    manual_payment_note: input.manualPaymentNote,
    txid: input.txid,
    efi_status: input.efiStatus,
  });
}

function mapPharmacyToDb(input: Partial<Pharmacy>) {
  return stripUndefined({
    tenant_id: input.tenantId,
    nome_fantasia: input.nomeFantasia,
    razao_social: input.razaoSocial,
    cnpj: input.cnpj,
    cidade: input.cidade,
    uf: input.uf,
    responsavel: input.responsavel,
    whatsapp: input.whatsapp,
    email: input.email,
    status: input.status,
  });
}

function mapPharmacy(row: Record<string, any>) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nomeFantasia: row.nome_fantasia,
    razaoSocial: row.razao_social,
    cnpj: row.cnpj,
    cidade: row.cidade ?? "",
    uf: row.uf ?? "",
    responsavel: row.responsavel ?? "",
    whatsapp: row.whatsapp ?? "",
    email: row.email ?? "",
    status: row.status,
  };
}

function mapAuditLog(row: Record<string, any>): AuditLog {
  return {
    id: row.id,
    tenantId: row.tenant_id ?? undefined,
    actor: row.actor ?? row.actor_user_id ?? "sistema",
    action: row.action,
    entity: row.entity ?? "",
    severity: row.severity,
    createdAt: row.created_at,
  };
}

function stripUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
