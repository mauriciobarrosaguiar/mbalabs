import { getRuntimeMode } from "@/lib/runtime-mode";
import * as demoRepository from "./demo-repository";
import * as supabaseRepository from "./supabase-repository";

type Repository = typeof demoRepository;

function repository(): Repository {
  return getRuntimeMode() === "demo"
    ? demoRepository
    : (supabaseRepository as unknown as Repository);
}

export function getClientMode() {
  return repository().getClientMode();
}

export function getCollections() {
  return repository().getCollections();
}

export function getDashboardData(tenantId?: string) {
  return repository().getDashboardData(tenantId);
}

export function getTenants() {
  return repository().getTenants();
}

export function createTenant(input: Parameters<Repository["createTenant"]>[0]) {
  return repository().createTenant(input);
}

export function updateTenant(id: string, patch: Parameters<Repository["updateTenant"]>[1]) {
  return repository().updateTenant(id, patch);
}

export function deleteTenant(id: string) {
  return repository().deleteTenant(id);
}

export function getPharmacies() {
  return repository().getPharmacies();
}

export function createPharmacy(input: Parameters<Repository["createPharmacy"]>[0]) {
  return repository().createPharmacy(input);
}

export function updatePharmacy(id: string, patch: Parameters<Repository["updatePharmacy"]>[1]) {
  return repository().updatePharmacy(id, patch);
}

export function deletePharmacy(id: string) {
  return repository().deletePharmacy(id);
}

export function getProducts() {
  return repository().getProducts();
}

export function createProduct(input: Parameters<Repository["createProduct"]>[0]) {
  return repository().createProduct(input);
}

export function updateProduct(id: string, patch: Parameters<Repository["updateProduct"]>[1]) {
  return repository().updateProduct(id, patch);
}

export function deleteProduct(id: string) {
  return repository().deleteProduct(id);
}

export function getSuppliers() {
  return repository().getSuppliers();
}

export function createSupplier(input: Parameters<Repository["createSupplier"]>[0]) {
  return repository().createSupplier(input);
}

export function updateSupplier(id: string, patch: Parameters<Repository["updateSupplier"]>[1]) {
  return repository().updateSupplier(id, patch);
}

export function deleteSupplier(id: string) {
  return repository().deleteSupplier(id);
}

export function getDistributors() {
  return repository().getDistributors();
}

export function createDistributor(input: Parameters<Repository["createDistributor"]>[0]) {
  return repository().createDistributor(input);
}

export function updateDistributor(id: string, patch: Parameters<Repository["updateDistributor"]>[1]) {
  return repository().updateDistributor(id, patch);
}

export function deleteDistributor(id: string) {
  return repository().deleteDistributor(id);
}

export function getLaboratories() {
  return repository().getLaboratories();
}

export function createLaboratory(input: Parameters<Repository["createLaboratory"]>[0]) {
  return repository().createLaboratory(input);
}

export function updateLaboratory(id: string, patch: Parameters<Repository["updateLaboratory"]>[1]) {
  return repository().updateLaboratory(id, patch);
}

export function deleteLaboratory(id: string) {
  return repository().deleteLaboratory(id);
}

export function createSubscriptionPlan(input: Parameters<Repository["createSubscriptionPlan"]>[0]) {
  return repository().createSubscriptionPlan(input);
}

export function updateSubscriptionPlan(id: string, patch: Parameters<Repository["updateSubscriptionPlan"]>[1]) {
  return repository().updateSubscriptionPlan(id, patch);
}

export function deleteSubscriptionPlan(id: string) {
  return repository().deleteSubscriptionPlan(id);
}

export function createMonthlySubscription(input: Parameters<Repository["createMonthlySubscription"]>[0]) {
  return repository().createMonthlySubscription(input);
}

export function updateMonthlySubscription(id: string, patch: Parameters<Repository["updateMonthlySubscription"]>[1]) {
  return repository().updateMonthlySubscription(id, patch);
}

export function deleteMonthlySubscription(id: string) {
  return repository().deleteMonthlySubscription(id);
}

export function getPharmacyQuotations() {
  return repository().getPharmacyQuotations();
}

export function getBiddingQuotations() {
  return repository().getBiddingQuotations();
}

export function getQuotationsByModule(moduleType: Parameters<Repository["getQuotationsByModule"]>[0]) {
  return repository().getQuotationsByModule(moduleType);
}

export function listQuotationsByModule(moduleType: Parameters<Repository["listQuotationsByModule"]>[0]) {
  return repository().listQuotationsByModule(moduleType);
}

export function getQuotationById(id: string) {
  return repository().getQuotationById(id);
}

export function getQuotation(id: string) {
  return repository().getQuotation(id);
}

export function createQuotation(input: Parameters<Repository["createQuotation"]>[0]) {
  return repository().createQuotation(input);
}

export function updateQuotation(id: string, patch: Parameters<Repository["updateQuotation"]>[1]) {
  return repository().updateQuotation(id, patch);
}

export function deleteQuotation(id: string) {
  return repository().deleteQuotation(id);
}

export function getQuotationItems(quotationId: string) {
  return repository().getQuotationItems(quotationId);
}

export function createQuotationItem(input: Parameters<Repository["createQuotationItem"]>[0]) {
  return repository().createQuotationItem(input);
}

export function updateQuotationItem(id: string, patch: Parameters<Repository["updateQuotationItem"]>[1]) {
  return repository().updateQuotationItem(id, patch);
}

export function deleteQuotationItem(id: string) {
  return repository().deleteQuotationItem(id);
}

export function getQuotationBundle(id: string) {
  return repository().getQuotationBundle(id);
}

export function getSupplierSessions(quotationId?: string) {
  return repository().getSupplierSessions(quotationId);
}

export function createSupplierSession(input: Parameters<Repository["createSupplierSession"]>[0]) {
  return repository().createSupplierSession(input);
}

export function getSessionByToken(token: string) {
  return repository().getSessionByToken(token);
}

export function getPublicSession(token: string, moduleType: Parameters<Repository["getPublicSession"]>[1]) {
  return repository().getPublicSession(token, moduleType);
}

export function saveSupplierResponse(
  response: Parameters<Repository["saveSupplierResponse"]>[0],
  items: Parameters<Repository["saveSupplierResponse"]>[1],
) {
  return repository().saveSupplierResponse(response, items);
}

export function submitSupplierResponse(
  response: Parameters<Repository["submitSupplierResponse"]>[0],
  items: Parameters<Repository["submitSupplierResponse"]>[1],
) {
  return repository().submitSupplierResponse(response, items);
}

export function generatePharmacyAnalysis(quotationId?: string) {
  return repository().generatePharmacyAnalysis(quotationId);
}

export function getPharmacyAnalysis(quotationId?: string) {
  return repository().getPharmacyAnalysis(quotationId);
}

export function generateBiddingAnalysis(quotationId?: string) {
  return repository().generateBiddingAnalysis(quotationId);
}

export function getBiddingAnalysis(quotationId?: string) {
  return repository().getBiddingAnalysis(quotationId);
}

export function generateBiddingAwards(
  quotationItem: Parameters<Repository["generateBiddingAwards"]>[0],
  responseItems: Parameters<Repository["generateBiddingAwards"]>[1],
) {
  return repository().generateBiddingAwards(quotationItem, responseItems);
}

export function generatePurchaseOrders(quotationId: string) {
  return repository().generatePurchaseOrders(quotationId);
}

export function getPurchaseOrdersByQuotation(quotationId: string) {
  return repository().getPurchaseOrdersByQuotation(quotationId);
}

export function getPurchaseOrderByToken(token: string) {
  return repository().getPurchaseOrderByToken(token);
}

export function markPurchaseOrderOpened(token: string) {
  return repository().markPurchaseOrderOpened(token);
}

export function savePurchaseOrderReview(
  token: Parameters<Repository["savePurchaseOrderReview"]>[0],
  itemUpdates: Parameters<Repository["savePurchaseOrderReview"]>[1],
  finalize?: Parameters<Repository["savePurchaseOrderReview"]>[2],
) {
  return repository().savePurchaseOrderReview(token, itemUpdates, finalize);
}

export function getWinnerOrderPendingItems(quotationId?: string) {
  return repository().getWinnerOrderPendingItems(quotationId);
}

export function redirectWinnerPendingItemToNextSupplier(pendingId: string) {
  return repository().redirectWinnerPendingItemToNextSupplier(pendingId);
}

export function createQuotationFromWinnerPendingItems(quotationId: string, pendingIds?: string[]) {
  return repository().createQuotationFromWinnerPendingItems(quotationId, pendingIds);
}

export function updateWinnerPendingItemStatus(
  pendingId: string,
  status: Parameters<Repository["updateWinnerPendingItemStatus"]>[1],
) {
  return repository().updateWinnerPendingItemStatus(pendingId, status);
}

export function getTenant(tenantId?: string) {
  return repository().getTenant(tenantId);
}

export function getAdminMetrics() {
  return repository().getAdminMetrics();
}

export function getCompanyMetrics(tenantId?: string) {
  return repository().getCompanyMetrics(tenantId);
}

export function getDefaultQuotationForModule(moduleType: Parameters<Repository["getDefaultQuotationForModule"]>[0]) {
  return repository().getDefaultQuotationForModule(moduleType);
}
