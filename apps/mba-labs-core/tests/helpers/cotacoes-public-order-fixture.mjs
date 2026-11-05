export const state = { row: {}, writes: 0, beforeWrite: undefined, collectionTenant: undefined };

export const hasSupabaseConfig = () => true;
export const hasSupabaseAdminConfig = () => true;
export const createSupabaseAdminClient = () => ({
  from(table) {
    let patch;
    const predicates = [];
    const query = {
      select() { return query; },
      update(value) { patch = value; return query; },
      eq(column, value) { predicates.push(row => row[column] === value); return query; },
      is(column, value) { predicates.push(row => row[column] === value); return query; },
      async maybeSingle() {
        if (table === "quotations") return { data: { status: "generated" } };
        if (patch) state.beforeWrite?.();
        if (!predicates.every(matches => matches(state.row))) return { data: null };
        if (patch) {
          state.writes++;
          Object.assign(state.row, patch);
        }
        return { data: { ...state.row } };
      },
      then(resolve) { return Promise.resolve({ data: [] }).then(resolve); },
    };
    return query;
  },
});

export const getPurchaseOrderByToken = async () => ({
  id: "order", tenantId: "qa", quotationId: "quote", supplierName: "Representante QA",
  moduleType: "pharmacy", status: "finalizado_pelo_vendedor", totalAmount: 10, confirmedAmount: 10,
  items: [{ quotationItemId: "item", distributorId: "correct", productName: "Produto fictício", quantityToBuy: 1,
    billedQuantity: 1, missingQuantity: 0, unitPrice: 10, totalPrice: 10, fulfillmentStatus: "faturado" }],
});
export const getQuotationById = async () => ({
  id: "quote", tenantId: "qa", moduleType: "pharmacy", pharmacyId: "unit", name: "Cotação fictícia",
  buyerCnpj: "11222333000262", buyerCompanyName: "Filial histórica", buyerLegalName: "Razão histórica",
});
export const getCollections = async (tenantId) => {
  state.collectionTenant = tenantId;
  return {
    tenants: [{ id: "qa", nomeFantasia: "Matriz" }],
    pharmacies: [{ id: "unit", tenantId: "qa", nomeFantasia: "Filial atual", razaoSocial: "Razão atual", cnpj: "11222333000181" }],
    distributors: [
      { id: "foreign", tenantId: "other", nome: "Distribuidora errada", pedidoMinimo: 100 },
      { id: "correct", tenantId: "qa", nome: "Distribuidora fictícia", pedidoMinimo: 20 },
    ],
    quotations: [await getQuotationById()],
    quotationItems: [{ id: "item", ean: "0000000000001" }],
  };
};
export const NextResponse = Response;
export const getCurrentAuthContext = async () => ({
  isAuthenticated: true, isActive: true, profile: {}, tenantAccess: { tenantId: "qa", tenantStatus: "ativo", status: "ativo" },
});
export const isTenantSuspended = () => false;
export const ensureQuotationAccess = async (_auth, id) =>
  id === "quote" ? { ok: true, tenantId: "qa" } : { ok: false, status: 403, error: "Sem acesso" };
export const getQuotationBundle = async () => ({ quotation: await getQuotationById() });
export const getPurchaseOrdersByQuotation = async id => id === "quote" ? [await getPurchaseOrderByToken()] : [];
