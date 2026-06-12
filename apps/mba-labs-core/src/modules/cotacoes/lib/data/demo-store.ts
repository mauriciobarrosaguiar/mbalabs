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
} from "@/modules/cotacoes/lib/data/demo-data";
import type {
  Distributor,
  Laboratory,
  Product,
  PurchaseOrder,
  Quotation,
  QuotationItem,
  Supplier,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
  SupplierQuoteSession,
  Tenant,
  WinnerOrderPendingItem,
} from "@/modules/cotacoes/lib/types";

export interface DemoStore {
  tenants: Tenant[];
  subscriptionPlans: typeof subscriptionPlans;
  monthlySubscriptions: typeof monthlySubscriptions;
  pharmacies: typeof pharmacies;
  suppliers: Supplier[];
  distributors: Distributor[];
  laboratories: Laboratory[];
  products: Product[];
  quotations: Quotation[];
  quotationItems: QuotationItem[];
  supplierQuoteSessions: SupplierQuoteSession[];
  supplierQuoteResponses: SupplierQuoteResponse[];
  supplierQuoteResponseItems: SupplierQuoteResponseItem[];
  purchaseOrders: PurchaseOrder[];
  winnerOrderPendingItems: WinnerOrderPendingItem[];
  auditLogs: typeof auditLogs;
}

const initialStore: DemoStore = {
  tenants: structuredClone(tenants),
  subscriptionPlans: structuredClone(subscriptionPlans),
  monthlySubscriptions: structuredClone(monthlySubscriptions),
  pharmacies: structuredClone(pharmacies),
  suppliers: structuredClone(suppliers),
  distributors: structuredClone(distributors),
  laboratories: structuredClone(laboratories),
  products: structuredClone(products),
  quotations: structuredClone(quotations),
  quotationItems: structuredClone(quotationItems),
  supplierQuoteSessions: structuredClone(supplierQuoteSessions),
  supplierQuoteResponses: structuredClone(supplierQuoteResponses),
  supplierQuoteResponseItems: structuredClone(supplierQuoteResponseItems),
  purchaseOrders: [],
  winnerOrderPendingItems: [],
  auditLogs: structuredClone(auditLogs),
};

const globalStore = globalThis as typeof globalThis & {
  __cotafarmaDemoStore?: DemoStore;
};

export function getDemoStore() {
  if (!globalStore.__cotafarmaDemoStore) {
    globalStore.__cotafarmaDemoStore = structuredClone(initialStore);
  }

  return globalStore.__cotafarmaDemoStore;
}

export function resetDemoStore() {
  globalStore.__cotafarmaDemoStore = structuredClone(initialStore);
  return globalStore.__cotafarmaDemoStore;
}

export function resolveDemoQuotationId(id?: string) {
  if (!id) return undefined;
  const aliases: Record<string, string> = {
    "demo-farmacia": "quote-pharmacy-001",
    "demo-licitacao": "quote-bidding-001",
  };
  return aliases[id] ?? id;
}

export function resolveDemoPublicToken(token: string) {
  const aliases: Record<string, string> = {
    "farmacia-pedido-demo-token": "pedido-pharmacy-supplier-luiza",
    "licitacao-pedido-demo-token": "pedido-bidding-supplier-joao",
  };
  return aliases[token] ?? token;
}

export function upsertById<T extends { id: string }>(rows: T[], row: T) {
  const index = rows.findIndex((item) => item.id === row.id);
  if (index >= 0) rows[index] = row;
  else rows.unshift(row);
  return row;
}

export function updateById<T extends { id: string }>(
  rows: T[],
  id: string,
  patch: Partial<T>,
) {
  const index = rows.findIndex((item) => item.id === id);
  if (index < 0) return undefined;
  rows[index] = { ...rows[index], ...patch };
  return rows[index];
}

export function deleteById<T extends { id: string }>(rows: T[], id: string) {
  const index = rows.findIndex((item) => item.id === id);
  if (index < 0) return false;
  rows.splice(index, 1);
  return true;
}
