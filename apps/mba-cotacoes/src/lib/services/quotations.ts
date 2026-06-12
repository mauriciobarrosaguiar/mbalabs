import {
  auditLogs,
  distributors,
  laboratories,
  monthlySubscriptions,
  pharmacies,
  products,
  quotationItems,
  quotations,
  subscriptionPlans,
  supplierQuoteResponseItems,
  supplierQuoteResponses,
  supplierQuoteSessions,
  suppliers,
  tenants,
} from "@/lib/data/demo-data";
import type { DashboardMetric, ModuleType, Quotation } from "@/lib/types";
import { buildBiddingAnalysis } from "./bidding-analysis";
import { buildPharmacyAnalysis } from "./pharmacy-analysis";
import { generatePurchaseOrders } from "./purchase-orders";
import { formatCurrency, formatInteger } from "@/lib/formatters";

export function getTenant(tenantId?: string) {
  return tenants.find((tenant) => tenant.id === tenantId) ?? tenants[0];
}

export function getQuotation(id: string) {
  return quotations.find((quotation) => quotation.id === id) ?? quotations[0];
}

export function getQuotationBundle(id: string) {
  const quotation = getQuotation(id);
  const items = quotationItems.filter((item) => item.quotationId === quotation.id);
  const responses = supplierQuoteResponses.filter(
    (response) => response.quotationId === quotation.id,
  );
  const responseItems = supplierQuoteResponseItems.filter(
    (item) => item.quotationId === quotation.id,
  );

  return { quotation, items, responses, responseItems };
}

export function getBiddingAnalysis(quotationId?: string) {
  const bundle = getQuotationBundle(quotationId ?? getDefaultQuotationForModule("bidding").id);
  return buildBiddingAnalysis(bundle.items, bundle.responseItems, bundle.responses);
}

export function getPharmacyAnalysis(quotationId?: string) {
  const bundle = getQuotationBundle(quotationId ?? getDefaultQuotationForModule("pharmacy").id);
  return buildPharmacyAnalysis(
    bundle.items,
    bundle.responseItems,
    bundle.responses,
    distributors,
  );
}

export function getPurchaseOrdersByQuotation(quotationId: string) {
  const bundle = getQuotationBundle(quotationId);
  const analysis =
    bundle.quotation.moduleType === "bidding"
      ? getBiddingAnalysis(quotationId)
      : getPharmacyAnalysis(quotationId);

  return generatePurchaseOrders(analysis.awards, bundle.items, bundle.responseItems);
}

export function getPurchaseOrderByToken(token: string) {
  const allOrders = quotations.flatMap((quotation) =>
    getPurchaseOrdersByQuotation(quotation.id),
  );
  return allOrders.find((order) => order.publicToken === token) ?? allOrders[0];
}

export function getPublicSession(token: string, moduleType: ModuleType) {
  void moduleType;
  const session = supplierQuoteSessions.find((item) => item.publicToken === token);
  const quotation = quotations.find((item) => item.id === session?.quotationId);
  const items = quotationItems.filter((item) => item.quotationId === quotation?.id);
  const tenant = tenants.find((item) => item.id === quotation?.tenantId);
  const pharmacy = pharmacies.find((item) => item.id === quotation?.pharmacyId);

  return { session, quotation, items, tenant, pharmacy };
}

export function getAdminMetrics(): DashboardMetric[] {
  const activeTenants = tenants.filter((tenant) => tenant.status === "ativo").length;
  const trialTenants = tenants.filter((tenant) => tenant.status === "teste").length;
  const suspendedTenants = tenants.filter(
    (tenant) => tenant.status === "suspenso",
  ).length;
  const paid = monthlySubscriptions.filter((item) => item.status === "paid").length;
  const overdue = monthlySubscriptions.filter(
    (item) => item.status === "overdue",
  ).length;
  const revenue = tenants
    .filter((tenant) => tenant.status === "ativo" || tenant.status === "teste")
    .reduce((total, tenant) => total + tenant.valorMensal, 0);

  return [
    { label: "Empresas ativas", value: String(activeTenants), hint: "Clientes em produção", tone: "success" },
    { label: "Empresas em teste", value: String(trialTenants), hint: "Avaliação comercial", tone: "info" },
    { label: "Suspensas", value: String(suspendedTenants), hint: "Bloqueio por status", tone: "warning" },
    { label: "Mensalidades pagas", value: String(paid), hint: "Referência atual", tone: "success" },
    { label: "Mensalidades atrasadas", value: String(overdue), hint: "Ação financeira", tone: "danger" },
    { label: "Receita mensal estimada", value: formatCurrency(revenue), hint: "MRR bruto previsto", tone: "default" },
    { label: "Cotações no mês", value: String(quotations.length), hint: "Farmácia + licitação", tone: "info" },
    { label: "Usuários ativos", value: "12", hint: "Perfis internos", tone: "default" },
    { label: "Erros recentes", value: "0", hint: "Últimas 24 horas", tone: "success" },
  ];
}

export function getCompanyMetrics(tenantId?: string): DashboardMetric[] {
  const tenant = getTenant(tenantId ?? tenants[0]?.id);
  const tenantQuotations = quotations.filter(
    (quotation) => quotation.tenantId === tenant.id,
  );
  const biddingAnalysis = getBiddingAnalysis();
  const pharmacyAnalysis = getPharmacyAnalysis();

  if (tenant.tipoCliente === "pharmacy") {
    return [
      { label: "Cotações abertas", value: "1", hint: "Com link enviado", tone: "info" },
      { label: "Aguardando resposta", value: "1", hint: "Fornecedores pendentes", tone: "warning" },
      { label: "Finalizadas", value: "4", hint: "Últimos 30 dias", tone: "success" },
      { label: "Economia estimada", value: formatCurrency(pharmacyAnalysis.totals.estimatedSavings), hint: "Contra última compra", tone: "success" },
      { label: "Produtos sem resposta", value: "0", hint: "Cotação atual", tone: "success" },
      { label: "Vendedor competitivo", value: "Luiza", hint: "Menor preço médio", tone: "default" },
    ];
  }

  return [
    { label: "Cotações abertas", value: formatInteger(tenantQuotations.length), hint: "Em análise ou resposta", tone: "info" },
    { label: "Itens aguardando", value: "0", hint: "Sem resposta válida", tone: "success" },
    { label: "Atendidos 100%", value: formatInteger(biddingAnalysis.totals.fullySuppliedItems), hint: "Com saldo fechado", tone: "success" },
    { label: "Saldo pendente", value: formatInteger(biddingAnalysis.totals.pendingItems), hint: "Itens a recotar", tone: "warning" },
    { label: "Total sugerido", value: formatCurrency(biddingAnalysis.totals.estimatedTotal), hint: "Pedidos recomendados", tone: "default" },
    { label: "Preço médio unidade", value: formatCurrency(biddingAnalysis.totals.averageUnitPrice), hint: "Respostas válidas", tone: "info" },
  ];
}

export function getCollections() {
  return {
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
  };
}

export function listQuotationsByModule(moduleType: ModuleType) {
  return quotations.filter((quotation) => quotation.moduleType === moduleType);
}

export function getDefaultQuotationForModule(moduleType: ModuleType): Quotation {
  return (
    quotations.find((quotation) => quotation.moduleType === moduleType) ??
    quotations[0]
  );
}
