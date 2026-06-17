// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/modules/cotacoes/lib/supabase/server";
import {
  calculateBiddingResponseItem,
  buildBiddingAnalysis,
} from "@/modules/cotacoes/lib/services/bidding-analysis";
import {
  calculateSellerRow,
  validateSellerResponse,
  type SellerResponseRowDraft,
} from "@/modules/cotacoes/lib/services/seller-response";
import { parseCurrencyInput } from "@/modules/cotacoes/lib/formatters";
import { buildPharmacyAnalysis } from "@/modules/cotacoes/lib/services/pharmacy-analysis";
import { generatePurchaseOrders as buildPurchaseOrders } from "@/modules/cotacoes/lib/services/purchase-orders";
import {
  buildLegacyPurchaseOrderItemObservation,
  parseLegacyPurchaseOrderReview,
} from "@/modules/cotacoes/lib/purchase-order-review-legacy";
import {
  canGenerateQuotationOrders,
  isQuotationClosed,
  isQuotationDeleted,
  markQuotationGeneratedStatus,
} from "@/modules/cotacoes/lib/quotation-status";
import type {
  ModuleType,
  ProductType,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderItemFulfillmentStatus,
  PurchaseOrderStatus,
  Quotation,
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
  SupplierQuoteSession,
  Tenant,
  WinnerOrderPendingItem,
} from "@/modules/cotacoes/lib/types";

type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

export function canUseSupabaseOperational() {
  return hasSupabaseConfig() && hasSupabaseAdminConfig();
}

function db() {
  return createSupabaseAdminClient();
}

function logSupabaseReadError(context: string, error: unknown) {
  console.error(`[Supabase] Falha ao buscar ${context}:`, error);
}

function readDb(context: string): SupabaseClient | null {
  if (!canUseSupabaseOperational()) return null;
  try {
    return db();
  } catch (error) {
    logSupabaseReadError(context, error);
    return null;
  }
}

function normalizeModuleType(value: unknown): ModuleType {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["bidding", "licitacao", "licitacoes"].includes(normalized) ? "bidding" : "pharmacy";
}

function filterVisibleQuotationRows(rows: Array<Record<string, any>>) {
  return rows.filter((row) => !isQuotationDeleted(row.status) && !row.deleted_at);
}

export async function listSupabaseQuotations(moduleType: ModuleType, tenantId?: string) {
  if (!canUseSupabaseOperational()) return [];
  const supabase = readDb("quotations");
  if (!supabase) return [];

  console.info("[Supabase] listSupabaseQuotations: inicio", { moduleType, tenantId });

  try {
    let query = supabase
      .from("quotations")
      .select("*")
      .eq("module_type", moduleType)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (tenantId) query = query.eq("tenant_id", tenantId);
    const { data, error } = await query;

    if (error) {
      console.warn("[Supabase] listSupabaseQuotations: consulta com deleted_at falhou; tentando fallback sem deleted_at.", {
        moduleType,
        tenantId,
        error,
      });

      let fallbackQuery = supabase
        .from("quotations")
        .select("*")
        .eq("module_type", moduleType)
        .order("created_at", { ascending: false });
      if (tenantId) fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
      const fallback = await fallbackQuery;

      if (fallback.error) {
        console.error("[Supabase] listSupabaseQuotations: fallback sem deleted_at tambem falhou.", {
          moduleType,
          error: fallback.error,
        });
        return [];
      }

      const visibleRows = filterVisibleQuotationRows(fallback.data ?? []);
      console.info("[Supabase] listSupabaseQuotations: retorno fallback", {
        moduleType,
        totalRows: fallback.data?.length ?? 0,
        visibleRows: visibleRows.length,
      });
      return visibleRows.map(mapQuotation);
    }

    const visibleRows = filterVisibleQuotationRows(data ?? []);
    console.info("[Supabase] listSupabaseQuotations: retorno", {
      moduleType,
      totalRows: data?.length ?? 0,
      visibleRows: visibleRows.length,
    });
    return visibleRows.map(mapQuotation);
  } catch (error) {
    console.error("[Supabase] listSupabaseQuotations: excecao na consulta principal; tentando fallback sem deleted_at.", {
      moduleType,
      error,
    });

    try {
      let fallbackQuery = supabase
        .from("quotations")
        .select("*")
        .eq("module_type", moduleType)
        .order("created_at", { ascending: false });
      if (tenantId) fallbackQuery = fallbackQuery.eq("tenant_id", tenantId);
      const fallback = await fallbackQuery;

      if (fallback.error) {
        console.error("[Supabase] listSupabaseQuotations: fallback sem deleted_at falhou apos excecao.", {
          moduleType,
          error: fallback.error,
        });
        return [];
      }

      const visibleRows = filterVisibleQuotationRows(fallback.data ?? []);
      console.info("[Supabase] listSupabaseQuotations: retorno fallback apos excecao", {
        moduleType,
        totalRows: fallback.data?.length ?? 0,
        visibleRows: visibleRows.length,
      });
      return visibleRows.map(mapQuotation);
    } catch (fallbackError) {
      logSupabaseReadError("quotations", fallbackError);
      return [];
    }
  }
}

export async function getSupabaseQuotationBundle(id: string, tenantId?: string) {
  if (!canUseSupabaseOperational()) return null;
  const supabase = readDb("quotation bundle");
  if (!supabase) return null;
  try {
    let quotationQuery = supabase
      .from("quotations")
      .select("*")
      .eq("id", id);
    if (tenantId) quotationQuery = quotationQuery.eq("tenant_id", tenantId);
    const { data: quotationRow, error: quotationError } = await quotationQuery.maybeSingle();

    if (quotationError) {
      logSupabaseReadError("quotations", quotationError);
      return null;
    }
    if (!quotationRow) return null;
    if (isQuotationDeleted(quotationRow.status) || quotationRow.deleted_at) return null;

    const [{ data: itemRows, error: itemError }, { data: responseRows, error: responseError }, { data: responseItemRows, error: responseItemError }] =
      await Promise.all([
        tenantId
          ? supabase.from("quotation_items").select("*").eq("quotation_id", id).eq("tenant_id", tenantId).order("item_number")
          : supabase.from("quotation_items").select("*").eq("quotation_id", id).order("item_number"),
        tenantId
          ? supabase.from("supplier_quote_responses").select("*").eq("quotation_id", id).eq("tenant_id", tenantId)
          : supabase.from("supplier_quote_responses").select("*").eq("quotation_id", id),
        tenantId
          ? supabase.from("supplier_quote_response_items").select("*").eq("quotation_id", id).eq("tenant_id", tenantId)
          : supabase.from("supplier_quote_response_items").select("*").eq("quotation_id", id),
      ]);

    if (itemError || responseError || responseItemError) {
      logSupabaseReadError("quotation bundle", itemError ?? responseError ?? responseItemError);
      return null;
    }

    return {
      quotation: mapQuotation(quotationRow),
      items: (itemRows ?? []).map(mapQuotationItem),
      responses: (responseRows ?? []).map(mapSupplierResponse),
      responseItems: (responseItemRows ?? []).map(mapSupplierResponseItem),
    };
  } catch (error) {
    logSupabaseReadError("quotation bundle", error);
    return null;
  }
}

export async function getSupabasePublicSession(token: string, moduleType: ModuleType) {
  if (!canUseSupabaseOperational()) return null;
  const supabase = readDb("sessao publica");
  if (!supabase) return null;
  try {
    const { data: sessionRow, error: sessionError } = await supabase
      .from("supplier_quote_sessions")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();

    if (sessionError) {
      logSupabaseReadError("supplier_quote_sessions", sessionError);
      return null;
    }
    if (!sessionRow) return null;

    const { data: quotationRow, error: quotationError } = await supabase
      .from("quotations")
      .select("*")
      .eq("id", sessionRow.quotation_id)
      .eq("module_type", moduleType)
      .maybeSingle();

    if (quotationError) {
      logSupabaseReadError("quotations", quotationError);
      return null;
    }
    if (!quotationRow) return null;
    if (isQuotationDeleted(quotationRow.status) || quotationRow.deleted_at) return null;

    const [{ data: itemRows, error: itemError }, { data: tenantRow }, { data: pharmacyRow }] =
      await Promise.all([
        supabase.from("quotation_items").select("*").eq("quotation_id", quotationRow.id).order("item_number"),
        supabase.from("tenants").select("*").eq("id", quotationRow.tenant_id).maybeSingle(),
        quotationRow.pharmacy_id
          ? supabase.from("pharmacies").select("*").eq("id", quotationRow.pharmacy_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    if (itemError) {
      logSupabaseReadError("quotation_items", itemError);
      return null;
    }

    const { data: responseRow, error: responseError } = await supabase
      .from("supplier_quote_responses")
      .select("*")
      .eq("session_id", sessionRow.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (responseError) {
      logSupabaseReadError("supplier_quote_responses", responseError);
      return null;
    }

    const { data: responseItemRows, error: responseItemError } = responseRow
      ? await supabase
          .from("supplier_quote_response_items")
          .select("*")
          .eq("response_id", responseRow.id)
      : { data: [], error: null };

    if (responseItemError) {
      logSupabaseReadError("supplier_quote_response_items", responseItemError);
      return null;
    }

    return {
      session: mapSupplierSession(sessionRow),
      quotation: mapQuotation(quotationRow),
      items: (itemRows ?? []).map(mapQuotationItem),
      tenant: tenantRow ? mapTenant(tenantRow) : undefined,
      pharmacy: pharmacyRow
        ? {
            id: pharmacyRow.id,
            tenantId: pharmacyRow.tenant_id,
            nomeFantasia: pharmacyRow.nome_fantasia,
            razaoSocial: pharmacyRow.razao_social,
            cnpj: pharmacyRow.cnpj,
            cidade: pharmacyRow.cidade ?? "",
            uf: pharmacyRow.uf ?? "",
            responsavel: pharmacyRow.responsavel ?? "",
            whatsapp: pharmacyRow.whatsapp ?? "",
            email: pharmacyRow.email ?? "",
            status: pharmacyRow.status,
        }
        : undefined,
      response: responseRow ? mapSupplierResponse(responseRow) : undefined,
      responseItems: (responseItemRows ?? []).map(mapSupplierResponseItem),
    };
  } catch (error) {
    logSupabaseReadError("sessao publica", error);
    return null;
  }
}

export async function createSupabaseQuotation(input: {
  moduleType: ModuleType;
  tenantId?: string;
  status: "draft" | "open" | "waiting_responses";
  draft: {
    name: string;
    buyerDocument?: string;
    buyerCompanyName?: string;
    destinationClient?: string;
    processNumber?: string;
    bidNumber?: string;
    deadlineAt: string;
    quotationType?: string;
    judgmentType?: string;
    notes?: string;
    allowPartialSupply: boolean;
    allowEquivalent: boolean;
    considerMinimumOrder: boolean;
  };
  items: Array<{
    itemNumber?: string;
    productId?: string;
    productName: string;
    ean?: string;
    activeIngredient?: string;
    dosage?: string;
    requestedLaboratory?: string;
    requestedQuantity: number;
    requestedUnit?: string;
    laboratoryRequired?: boolean;
    productType?: string;
    acceptEquivalent?: boolean;
    minimumValidity?: string;
    msRegistrationRequired?: boolean;
    maxDeliveryDays?: string;
    buyerObservation?: string;
    lotGroup?: string;
  }>;
  suppliers: Array<{
    id: string;
    nome: string;
    empresa: string;
    whatsapp: string;
    email?: string;
    tipo?: string;
  }>;
}) {
  if (!canUseSupabaseOperational()) {
    throw new Error("Supabase não configurado para gravação real.");
  }

  const supabase = db();
  const moduleType = normalizeModuleType(input.moduleType);
  if (moduleType !== input.moduleType) {
    console.warn("[Supabase] createSupabaseQuotation: moduleType normalizado.", {
      receivedModuleType: input.moduleType,
      moduleType,
    });
  }
  const tenant = await resolveTenant(supabase, moduleType, input.tenantId);
  console.info("[Supabase] createSupabaseQuotation: tenant e modulo resolvidos.", {
    moduleType,
    requestedTenantId: input.tenantId,
    tenantId: tenant.id,
    tenantName: tenant.nomeFantasia,
    tenantType: tenant.tipoCliente,
  });
  await ensureUnitTypes(supabase);
  const pharmacy = moduleType === "pharmacy"
    ? await resolvePharmacy(supabase, tenant.id)
    : null;
  const pharmacyProducts = moduleType === "pharmacy"
    ? await resolveQuotationProducts(supabase, tenant.id, input.items)
    : new Map<string, Record<string, any>>();

  const { data: quotationRow, error: quotationError } = await supabase
    .from("quotations")
    .insert({
      tenant_id: tenant.id,
      module_type: moduleType,
      name: input.draft.name,
      pharmacy_id: pharmacy?.id ?? null,
      buyer_company_name: input.draft.buyerCompanyName,
      destination_client: input.draft.destinationClient,
      process_number: input.draft.processNumber,
      bid_number: input.draft.bidNumber,
      quotation_type: input.draft.quotationType,
      judgment_type: moduleType === "bidding" ? input.draft.judgmentType : null,
      deadline_at: input.draft.deadlineAt ? new Date(input.draft.deadlineAt).toISOString() : null,
      allow_partial_supply: input.draft.allowPartialSupply,
      allow_equivalent: input.draft.allowEquivalent,
      consider_minimum_order: input.draft.considerMinimumOrder,
      notes: input.draft.notes,
      status: input.status,
    })
    .select("*")
    .single();

  if (quotationError) throw quotationError;

  const itemPayload = input.items.map((item, index) => {
    const product = item.productId ? pharmacyProducts.get(item.productId) : undefined;
    return {
      tenant_id: tenant.id,
      quotation_id: quotationRow.id,
      module_type: moduleType,
      item_number: Number(item.itemNumber || index + 1),
      product_id: product?.id ?? null,
      product_name: product?.nome ?? item.productName,
      active_ingredient: product?.principio_ativo ?? item.activeIngredient,
      dosage: product?.dosagem ?? item.dosage,
      ean: product?.ean ?? item.ean,
      requested_quantity: item.requestedQuantity,
      requested_unit: product?.unidade_base ?? item.requestedUnit ?? (moduleType === "pharmacy" ? "CX" : "CAP"),
      requested_laboratory: item.requestedLaboratory || "Qualquer",
      laboratory_required: Boolean(item.laboratoryRequired),
      product_type: product?.tipo_produto ?? item.productType ?? "generico",
      accept_equivalent: item.acceptEquivalent ?? true,
      allow_partial_supply: input.draft.allowPartialSupply,
      minimum_validity: item.minimumValidity || null,
      ms_registration_required: Boolean(item.msRegistrationRequired),
      max_delivery_days: item.maxDeliveryDays ? Number(item.maxDeliveryDays) : null,
      lot_group: item.lotGroup,
      buyer_observation: item.buyerObservation,
      status: "aguardando_respostas",
    };
  });

  const { data: itemRows, error: itemError } = await supabase
    .from("quotation_items")
    .insert(itemPayload)
    .select("*");

  if (itemError) throw itemError;

  const resolvedSuppliers = await Promise.all(
    input.suppliers.map((supplier) => resolveSupplier(supabase, tenant.id, supplier)),
  );

  const expiresAt = input.draft.deadlineAt
    ? new Date(input.draft.deadlineAt).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: sessionRows, error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .insert(resolvedSuppliers.map((supplier) => ({
      tenant_id: tenant.id,
      quotation_id: quotationRow.id,
      supplier_id: supplier.id,
      seller_name: supplier.nome,
      seller_company: supplier.empresa,
      seller_whatsapp: supplier.whatsapp,
      seller_email: supplier.email,
      expires_at: expiresAt,
      status: "opened",
    })))
    .select("*");

  if (sessionError) throw sessionError;

  return {
    quotation: mapQuotation(quotationRow),
    items: (itemRows ?? []).map(mapQuotationItem),
    sessions: (sessionRows ?? []).map(mapSupplierSession),
  };
}

export async function saveSupabasePublicResponse(token: string, input: {
  moduleType: ModuleType;
  status: "draft" | "submitted";
  seller?: {
    name?: string;
    company?: string;
    whatsapp?: string;
    email?: string;
    billingCompany?: string;
    paymentTerms?: string;
    deliveryTerms?: string;
    generalObservation?: string;
  };
  pharmacy?: {
    prices: Record<string, string>;
    stock: Record<string, string>;
    available: Record<string, string>;
  };
  bidding?: {
    packagePrice: number;
    packageQuantity: number;
    hasFullQuantity: boolean;
    availableQuantity: number;
    offeredProductName?: string;
    offeredLaboratory?: string;
    offeredUnit?: string;
    deliveryDays?: number;
  };
}) {
  const publicSession = await getSupabasePublicSession(token, input.moduleType);
  if (!publicSession?.session || !publicSession.quotation) {
    throw new Error("Token público inválido ou expirado.");
  }

  const supabase = db();
  const submittedAt = input.status === "submitted" ? new Date().toISOString() : null;
  const session = publicSession.session;
  const quotation = publicSession.quotation;

  if (session.status === "submitted" || publicSession.response?.status === "submitted") {
    throw new Error("Esta resposta ja foi enviada e esta bloqueada para edicao.");
  }

  if (session.status === "expired" || (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now())) {
    throw new Error("Esta cotacao expirou.");
  }

  if (session.status === "canceled" && quotation.status !== "canceled") {
    throw new Error("Este link foi revogado pela empresa compradora.");
  }

  if (isQuotationClosed(quotation.status) && quotation.status !== "canceled") {
    throw new Error("Cotacao finalizada. Nao e mais possivel enviar ou alterar respostas.");
  }

  if (quotation.status === "canceled") {
    throw new Error("Esta cotacao foi cancelada pela empresa compradora.");
  }

  if (input.status === "submitted" && input.moduleType === "pharmacy") {
    const hasValidPrice = publicSession.items.some((item) =>
      parseMoney(input.pharmacy?.prices[item.id]) > 0,
    );
    if (!hasValidPrice) {
      throw new Error("Informe o preço de pelo menos um item para enviar a resposta.");
    }
  }

  const { data: existingResponse, error: existingResponseError } = await supabase
    .from("supplier_quote_responses")
    .select("id")
    .eq("session_id", session.id)
    .maybeSingle();

  if (existingResponseError) throw existingResponseError;

  const responsePayload = {
      tenant_id: session.tenantId,
      quotation_id: session.quotationId,
      session_id: session.id,
      supplier_id: session.supplierId,
      seller_name: input.seller?.name ?? session.sellerName,
      seller_company: input.seller?.company ?? session.sellerCompany,
      seller_whatsapp: input.seller?.whatsapp ?? session.sellerWhatsapp,
      seller_email: input.seller?.email ?? session.sellerEmail,
      billing_company: input.seller?.billingCompany,
      payment_terms: input.seller?.paymentTerms,
      delivery_terms: input.seller?.deliveryTerms,
      general_observation: input.seller?.generalObservation,
      status: input.status,
      submitted_at: submittedAt,
  };

  const responseQuery = existingResponse
    ? supabase
        .from("supplier_quote_responses")
        .update(responsePayload)
        .eq("id", existingResponse.id)
    : supabase.from("supplier_quote_responses").insert(responsePayload);

  const { data: responseRow, error: responseError } = await responseQuery
    .select("*")
    .single();

  if (responseError) throw responseError;

  const itemPayload: Record<string, any>[] = publicSession.items.flatMap<Record<string, any>>((item) => {
    if (input.moduleType === "bidding") {
      const packageQuantity = input.bidding?.packageQuantity ?? 1;
      const packagePrice = input.bidding?.packagePrice ?? 0;
      const calculated = calculateBiddingResponseItem({
        requestedQuantity: item.requestedQuantity,
        packageQuantity,
        packagePrice,
        hasFullQuantity: Boolean(input.bidding?.hasFullQuantity),
        availableQuantity: input.bidding?.availableQuantity,
      });

      return [{
        tenant_id: item.tenantId,
        quotation_id: item.quotationId,
        quotation_item_id: item.id,
        response_id: responseRow.id,
        supplier_id: session.supplierId,
        offered_product_name: input.bidding?.offeredProductName || item.productName,
        offered_laboratory: input.bidding?.offeredLaboratory || item.requestedLaboratory || "Qualquer",
        offered_unit: input.bidding?.offeredUnit || item.requestedUnit,
        package_quantity: packageQuantity,
        package_price: packagePrice,
        has_full_quantity: Boolean(input.bidding?.hasFullQuantity),
        available_quantity: input.bidding?.hasFullQuantity ? item.requestedQuantity : input.bidding?.availableQuantity,
        delivery_days: input.bidding?.deliveryDays,
        converted_unit_price: calculated.convertedUnitPrice,
        required_packages_total: calculated.requiredPackagesTotal,
        packages_to_buy: calculated.packagesToBuy,
        quantity_to_buy: calculated.quantityToBuy,
        quantity_shortage: calculated.quantityShortage,
        technical_surplus: calculated.technicalSurplus,
        total_price_if_full: calculated.totalPriceIfFull,
        total_price_available: calculated.totalPriceAvailable,
        alert_status: calculated.status === "atendido_total" ? null : calculated.status,
      }];
    }

    const unitPrice = parseMoney(input.pharmacy?.prices[item.id]);
    if (unitPrice <= 0) return [];

    const hasStock = input.pharmacy?.stock[item.id] !== "nao";
    const availableQuantity = hasStock
      ? item.requestedQuantity
      : Number(input.pharmacy?.available[item.id] ?? 0);

    return [{
      tenant_id: item.tenantId,
      quotation_id: item.quotationId,
      quotation_item_id: item.id,
      response_id: responseRow.id,
      supplier_id: session.supplierId,
      unit_price: unitPrice,
      has_stock: hasStock,
      available_quantity: availableQuantity,
      converted_unit_price: unitPrice,
      total_price_available: unitPrice * Math.min(availableQuantity, item.requestedQuantity),
    }];
  });

  const { error: deleteError } = await supabase
    .from("supplier_quote_response_items")
    .delete()
    .eq("response_id", responseRow.id);

  if (deleteError) throw deleteError;

  let responseItemRows: Record<string, any>[] = [];
  if (itemPayload.length > 0) {
    const { data, error: itemError } = await supabase
      .from("supplier_quote_response_items")
      .insert(itemPayload)
      .select("*");

    if (itemError) throw itemError;
    responseItemRows = data ?? [];
  }

  await supabase
    .from("supplier_quote_sessions")
    .update({
      status: input.status,
      submitted_at: submittedAt,
    })
    .eq("id", session.id);

  return {
    response: mapSupplierResponse(responseRow),
    items: (responseItemRows ?? []).map(mapSupplierResponseItem),
  };
}

export async function saveSupabaseGridPublicResponse(token: string, input: {
  moduleType: ModuleType;
  status: "draft" | "submitted";
  rows: SellerResponseRowDraft[];
  seller?: {
    name?: string;
    company?: string;
    whatsapp?: string;
    email?: string;
    billingCompany?: string;
    paymentTerms?: string;
    deliveryTerms?: string;
    generalObservation?: string;
  };
}) {
  const publicSession = await getSupabasePublicSession(token, input.moduleType);
  if (!publicSession?.session || !publicSession.quotation) {
    throw new Error("Token público inválido ou expirado.");
  }

  const session = publicSession.session;
  const quotation = publicSession.quotation;

  if (session.status === "submitted" || publicSession.response?.status === "submitted") {
    throw new Error("Esta resposta já foi enviada e está bloqueada para edição.");
  }

  if (session.status === "expired" || (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now())) {
    throw new Error("Esta cotação expirou.");
  }

  if (session.status === "canceled" && quotation.status !== "canceled") {
    throw new Error("Este link foi revogado pela empresa compradora.");
  }

  if (quotation.status === "canceled" || quotation.status === "excluida") {
    throw new Error("Esta cotação foi cancelada pela empresa compradora.");
  }

  if (isQuotationClosed(quotation.status)) {
    throw new Error("Cotação finalizada. Não é mais possível enviar ou alterar respostas.");
  }

  if (input.status === "submitted") {
    const validationErrors = validateSellerResponse({
      moduleType: input.moduleType,
      items: publicSession.items,
      rows: input.rows,
    });
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(" "));
    }
  }

  const supabase = db();
  const submittedAt = input.status === "submitted" ? new Date().toISOString() : null;
  const { data: existingResponse, error: existingResponseError } = await supabase
    .from("supplier_quote_responses")
    .select("id")
    .eq("session_id", session.id)
    .maybeSingle();

  if (existingResponseError) throw existingResponseError;

  const responsePayload = {
    tenant_id: session.tenantId,
    quotation_id: session.quotationId,
    session_id: session.id,
    supplier_id: session.supplierId,
    seller_name: input.seller?.name ?? session.sellerName,
    seller_company: input.seller?.company ?? session.sellerCompany,
    seller_whatsapp: input.seller?.whatsapp ?? session.sellerWhatsapp,
    seller_email: input.seller?.email ?? session.sellerEmail,
    billing_company: input.seller?.billingCompany,
    payment_terms: input.seller?.paymentTerms,
    delivery_terms: input.seller?.deliveryTerms,
    general_observation: input.seller?.generalObservation,
    status: input.status,
    submitted_at: submittedAt,
  };

  const responseQuery = existingResponse
    ? supabase
        .from("supplier_quote_responses")
        .update(responsePayload)
        .eq("id", existingResponse.id)
    : supabase.from("supplier_quote_responses").insert(responsePayload);

  const { data: responseRow, error: responseError } = await responseQuery
    .select("*")
    .single();

  if (responseError) throw responseError;

  const itemPayload: Record<string, any>[] = publicSession.items.flatMap<Record<string, any>>((item) => {
    const row = input.rows.find((candidate) => candidate.quotationItemId === item.id) ?? {
      quotationItemId: item.id,
    };
    const sellerCalculation = calculateSellerRow(input.moduleType, item, row);

    if (input.moduleType === "bidding") {
      const packageQuantity = getNumericPackageQuantity(row);
      const packagePrice = parseMoney(row.packagePrice ?? row.grossPrice);
      const hasFullQuantity = row.hasFullQuantity !== "nao";
      const availableQuantity = hasFullQuantity
        ? item.requestedQuantity
        : parseMoney(row.attendedQuantity);
      const calculated = calculateBiddingResponseItem({
        requestedQuantity: item.requestedQuantity,
        packageQuantity: packageQuantity || 1,
        packagePrice,
        hasFullQuantity,
        availableQuantity,
      });

      return [{
        tenant_id: item.tenantId,
        quotation_id: item.quotationId,
        quotation_item_id: item.id,
        response_id: responseRow.id,
        supplier_id: session.supplierId,
        offered_product_name: row.offeredProductName || item.productName,
        offered_laboratory: row.offeredLaboratory || item.requestedLaboratory || "Qualquer",
        offered_unit: row.offeredUnit || item.requestedUnit,
        package_quantity: packageQuantity,
        package_price: packagePrice,
        has_full_quantity: hasFullQuantity,
        available_quantity: availableQuantity,
        delivery_days: parseDeliveryDays(row.deliveryText),
        seller_observation: row.observation,
        unit_price: sellerCalculation.convertedUnitPrice,
        converted_unit_price: calculated.convertedUnitPrice,
        required_packages_total: calculated.requiredPackagesTotal,
        packages_to_buy: calculated.packagesToBuy,
        quantity_to_buy: calculated.quantityToBuy,
        quantity_shortage: calculated.quantityShortage,
        technical_surplus: calculated.technicalSurplus,
        total_price_if_full: calculated.totalPriceIfFull,
        total_price_available: calculated.totalPriceAvailable,
        alert_status: calculated.status === "atendido_total" ? null : calculated.status,
      }];
    }

    if (sellerCalculation.netPrice <= 0) return [];

    return [{
      tenant_id: item.tenantId,
      quotation_id: item.quotationId,
      quotation_item_id: item.id,
      response_id: responseRow.id,
      supplier_id: session.supplierId,
      offered_product_name: row.offeredProductName || item.productName,
      offered_laboratory: row.offeredLaboratory || item.requestedLaboratory || "Qualquer",
      unit_price: sellerCalculation.netPrice,
      has_stock: row.hasStock !== "nao",
      available_quantity: sellerCalculation.attendedQuantity,
      delivery_days: parseDeliveryDays(row.deliveryText),
      seller_observation: row.observation,
      converted_unit_price: sellerCalculation.netPrice,
      total_price_available: sellerCalculation.itemTotal,
    }];
  });

  const { error: deleteError } = await supabase
    .from("supplier_quote_response_items")
    .delete()
    .eq("response_id", responseRow.id);

  if (deleteError) throw deleteError;

  let responseItemRows: Record<string, any>[] = [];
  if (itemPayload.length > 0) {
    const { data, error: itemError } = await supabase
      .from("supplier_quote_response_items")
      .insert(itemPayload)
      .select("*");

    if (itemError) throw itemError;
    responseItemRows = data ?? [];
  }

  const { error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .update({
      status: input.status,
      submitted_at: submittedAt,
    })
    .eq("id", session.id);

  if (sessionError) throw sessionError;

  return {
    response: mapSupplierResponse(responseRow),
    items: (responseItemRows ?? []).map(mapSupplierResponseItem),
  };
}

export async function generateAndPersistSupabasePurchaseOrders(quotationId: string, tenantId?: string) {
  const supabase = db();
  const bundle = await getSupabaseQuotationBundle(quotationId, tenantId);
  if (!bundle) throw new Error("Cotação não encontrada.");
  if (bundle.quotation.status === "canceled" || isQuotationDeleted(bundle.quotation.status)) {
    throw new Error("Cotação cancelada ou excluída não permite gerar pedidos.");
  }
  if (!canGenerateQuotationOrders(bundle.quotation.status)) {
    throw new Error("Finalize a cotação para gerar pedidos dos vencedores.");
  }
  if (bundle.items.length === 0) return [] as PurchaseOrder[];

  const analysis = bundle.quotation.moduleType === "bidding"
    ? buildBiddingAnalysis(bundle.items, bundle.responseItems, bundle.responses)
    : buildPharmacyAnalysis(bundle.items, bundle.responseItems, bundle.responses, []);
  const generated = buildPurchaseOrders(analysis.awards, bundle.items, bundle.responseItems);
  const existing = await getPersistedPurchaseOrders(supabase, quotationId, tenantId);
  const activeExisting = existing.filter((order) => order.items.length > 0);
  const expectedItemIds = new Set(generated.flatMap((order) => order.items.map((item) => item.quotationItemId)));
  const existingItemIds = new Set(activeExisting.flatMap((order) => order.items.map((item) => item.quotationItemId)));
  const hasAllExpectedItems =
    expectedItemIds.size > 0 &&
    Array.from(expectedItemIds).every((itemId) => existingItemIds.has(itemId));

  if (activeExisting.length > 0 && (generated.length === 0 || hasAllExpectedItems)) {
    await markSupabaseQuotationAsGenerated(supabase, quotationId, tenantId);
    return activeExisting;
  }

  if (generated.length === 0) return [] as PurchaseOrder[];

  await deleteEmptyGeneratedPurchaseOrders(supabase, existing);
  const existingSupplierKeys = new Set(activeExisting.map(getPurchaseOrderSupplierKey));
  const ordersToPersist = generated.filter((order) => !existingSupplierKeys.has(getPurchaseOrderSupplierKey(order)));

  if (ordersToPersist.length === 0) {
    await markSupabaseQuotationAsGenerated(supabase, quotationId, tenantId);
    return activeExisting;
  }

  const supplierIds = Array.from(new Set(ordersToPersist.map((order) => order.supplierId).filter(Boolean))) as string[];
  const { data: supplierRows } = supplierIds.length
    ? await supabase.from("suppliers").select("id,nome,empresa,whatsapp").in("id", supplierIds)
    : { data: [] as Record<string, any>[] };

  const persisted: PurchaseOrder[] = [];
  for (const order of ordersToPersist) {
    const supplierRow = (supplierRows ?? []).find((supplier) => supplier.id === order.supplierId);
    const supplierResponse = bundle.responses.find((response) =>
      (order.supplierId && response.supplierId === order.supplierId) ||
      response.sellerCompany === order.supplierName ||
      response.sellerName === order.supplierName,
    );
    const orderRow = await insertPurchaseOrderRow(supabase, order, supplierRow, supplierResponse);
    const itemRows = await insertPurchaseOrderItems(supabase, orderRow.id, order);
    persisted.push(enrichPurchaseOrderWithSupplier(mapPurchaseOrder(orderRow, itemRows ?? []), supplierRow, supplierResponse));
  }

  if (persisted.length > 0) {
    await markSupabaseQuotationAsGenerated(supabase, quotationId, tenantId);
  }

  return [...activeExisting, ...persisted];
}

async function markSupabaseQuotationAsGenerated(supabase: SupabaseClient, quotationId: string, tenantId?: string) {
  let query = supabase
    .from("quotations")
    .update({ status: markQuotationGeneratedStatus(), updated_at: new Date().toISOString() })
    .eq("id", quotationId);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { error } = await query;
  if (!error) return true;

  if (isQuotationGeneratedStatusConstraintError(error)) {
    console.warn("[Supabase] Pedido gerado, mas o banco ainda nao aceita quotations.status = generated.", {
      quotationId,
      error,
    });
    return false;
  }

  throw error;
}

function isQuotationGeneratedStatusConstraintError(error: unknown) {
  const text = JSON.stringify(error).toLowerCase();
  return text.includes("quotations_status_check") || (
    text.includes("violates check constraint") &&
    text.includes("quotations") &&
    text.includes("generated")
  );
}

function createPurchaseOrderPublicToken(order: PurchaseOrder) {
  const quotationPart = normalizeTokenPart(order.quotationId).slice(0, 12);
  const supplierPart = normalizeTokenPart(
    order.supplierId ?? order.supplierCompany ?? order.supplierName ?? order.supplierContactName,
  ).slice(0, 48);
  return `pedido-${order.moduleType}-${quotationPart}-${supplierPart || "vendedor"}`;
}

function normalizeTokenPart(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function insertPurchaseOrderRow(
  supabase: SupabaseClient,
  order: PurchaseOrder,
  supplierRow: Record<string, any> | undefined,
  supplierResponse: SupplierQuoteResponse | undefined,
) {
  const payload = {
    tenant_id: order.tenantId,
    quotation_id: order.quotationId,
    module_type: order.moduleType,
    supplier_name: order.supplierName,
    supplier_id: order.supplierId ?? null,
    public_token: createPurchaseOrderPublicToken(order),
    supplier_company: supplierRow?.empresa ?? supplierResponse?.sellerCompany ?? order.supplierCompany ?? null,
    supplier_whatsapp: supplierRow?.whatsapp ?? supplierResponse?.sellerWhatsapp ?? order.supplierWhatsapp ?? null,
    total_amount: order.totalAmount,
    confirmed_amount: 0,
    status: "gerado",
  };

  const { data, error } = await supabase
    .from("purchase_orders")
    .insert(payload)
    .select("*")
    .single();

  if (!error) return data;
  if (!shouldRetryLegacyPurchaseOrderInsert(error)) throw error;

  console.error("[Supabase] Falha ao inserir pedido com schema completo; tentando schema legado.", error);
  const { data: legacyData, error: legacyError } = await supabase
    .from("purchase_orders")
    .insert({
      tenant_id: payload.tenant_id,
      quotation_id: payload.quotation_id,
      module_type: payload.module_type,
      supplier_name: payload.supplier_name,
      supplier_id: payload.supplier_id,
      public_token: payload.public_token,
      total_amount: payload.total_amount,
      status: "draft",
    })
    .select("*")
    .single();

  if (legacyError) throw legacyError;
  return legacyData;
}

async function insertPurchaseOrderItems(
  supabase: SupabaseClient,
  purchaseOrderId: string,
  order: PurchaseOrder,
) {
  const payload = order.items.map((item) => ({
    tenant_id: item.tenantId,
    purchase_order_id: purchaseOrderId,
    quotation_item_id: item.quotationItemId,
    product_name: item.productName,
    offered_product_name: item.offeredProductName,
    laboratory: item.laboratory,
    unit: item.unit,
    quantity_to_buy: item.quantityToBuy,
    billed_quantity: item.billedQuantity ?? 0,
    missing_quantity: item.missingQuantity ?? item.quantityToBuy,
    packages_to_buy: item.packagesToBuy,
    package_quantity: item.packageQuantity,
    package_price: item.packagePrice,
    unit_price: item.unitPrice,
    total_price: item.totalPrice,
    observation: item.observation,
    fulfillment_status: normalizePurchaseOrderFulfillmentStatus(item.fulfillmentStatus),
    vendor_observation: item.vendorObservation,
    original_supplier_id: item.originalSupplierId,
    original_supplier_name: item.originalSupplierName,
  }));

  const { data, error } = await supabase
    .from("purchase_order_items")
    .insert(payload)
    .select("*");

  if (!error) return data ?? [];
  if (!shouldRetryLegacyPurchaseOrderInsert(error)) throw error;

  console.error("[Supabase] Falha ao inserir itens do pedido com schema completo; tentando schema legado.", error);
  const legacyPayload = payload.map((item) => ({
    tenant_id: item.tenant_id,
    purchase_order_id: item.purchase_order_id,
    quotation_item_id: item.quotation_item_id,
    product_name: item.product_name,
    offered_product_name: item.offered_product_name,
    laboratory: item.laboratory,
    unit: item.unit,
    quantity_to_buy: item.quantity_to_buy,
    packages_to_buy: item.packages_to_buy,
    package_quantity: item.package_quantity,
    package_price: item.package_price,
    unit_price: item.unit_price,
    total_price: item.total_price,
    observation: item.observation,
  }));
  const { data: legacyData, error: legacyError } = await supabase
    .from("purchase_order_items")
    .insert(legacyPayload)
    .select("*");

  if (legacyError) throw legacyError;
  return legacyData ?? [];
}

async function deleteEmptyGeneratedPurchaseOrders(
  supabase: SupabaseClient,
  existing: PurchaseOrder[],
) {
  const emptyIds = existing
    .filter((order) => order.items.length === 0)
    .map((order) => order.id);
  if (emptyIds.length === 0) return;

  const { error } = await supabase
    .from("purchase_orders")
    .delete()
    .in("id", emptyIds);
  if (error) throw error;
}

function shouldRetryLegacyPurchaseOrderInsert(error: unknown) {
  const text = JSON.stringify(error).toLowerCase();
  return [
    "schema cache",
    "column",
    "constraint",
    "purchase_orders_status_check",
    "supplier_company",
    "supplier_whatsapp",
    "public_token",
    "confirmed_amount",
    "fulfillment_status",
    "vendor_observation",
    "original_supplier",
  ].some((needle) => text.includes(needle));
}

async function enrichPurchaseOrdersWithSuppliers(supabase: SupabaseClient, orders: PurchaseOrder[]) {
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

  const suppliersById = new Map((data ?? []).map((supplier) => [supplier.id, supplier]));
  return orders.map((order) => enrichPurchaseOrderWithSupplier(order, suppliersById.get(order.supplierId ?? "")));
}

async function enrichPurchaseOrderWithSupplierId(supabase: SupabaseClient, order: PurchaseOrder) {
  if (!order.supplierId) return order;

  const { data, error } = await supabase
    .from("suppliers")
    .select("id,nome,empresa,whatsapp")
    .eq("id", order.supplierId)
    .maybeSingle();
  if (error) {
    logSupabaseReadError("supplier do pedido", error);
    return order;
  }

  return enrichPurchaseOrderWithSupplier(order, data ?? undefined);
}

function enrichPurchaseOrderWithSupplier(
  order: PurchaseOrder,
  supplier?: { nome?: string | null; empresa?: string | null; whatsapp?: string | null },
  response?: SupplierQuoteResponse,
) {
  return {
    ...order,
    supplierWhatsapp: order.supplierWhatsapp ?? supplier?.whatsapp ?? response?.sellerWhatsapp,
    supplierCompany: order.supplierCompany ?? supplier?.empresa ?? response?.sellerCompany,
    supplierContactName: order.supplierContactName ?? supplier?.nome ?? response?.sellerName,
  };
}

function getPurchaseOrderSupplierKey(order: PurchaseOrder) {
  return String(
    order.supplierId ??
    order.supplierCompany ??
    order.supplierName ??
    order.supplierContactName ??
    "",
  ).trim().toLowerCase();
}

async function getPersistedPurchaseOrders(supabase: SupabaseClient, quotationId: string, tenantId?: string) {
  try {
    let orderQuery = supabase
      .from("purchase_orders")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: false });
    if (tenantId) orderQuery = orderQuery.eq("tenant_id", tenantId);
    const { data: orderRows, error: orderError } = await orderQuery;

    if (orderError) {
      logSupabaseReadError("purchase_orders", orderError);
      return [] as PurchaseOrder[];
    }
    if (!orderRows?.length) return [] as PurchaseOrder[];

    const { data: itemRows, error: itemError } = await supabase
      .from("purchase_order_items")
      .select("*")
      .in("purchase_order_id", orderRows.map((order) => order.id));

    if (itemError) {
      logSupabaseReadError("purchase_order_items", itemError);
      return [] as PurchaseOrder[];
    }
    const orders = orderRows.map((order) =>
      mapPurchaseOrder(
        order,
        (itemRows ?? []).filter((item) => item.purchase_order_id === order.id),
      ),
    );
    return await enrichPurchaseOrdersWithSuppliers(supabase, orders);
  } catch (error) {
    logSupabaseReadError("purchase_orders", error);
    return [] as PurchaseOrder[];
  }
}

export async function getSupabasePurchaseOrderByToken(token: string) {
  if (!canUseSupabaseOperational()) return null;
  const supabase = readDb("pedido publico");
  if (!supabase) return null;
  try {
    const { data: orderRow, error: orderError } = await supabase
      .from("purchase_orders")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();

    if (orderError) {
      logSupabaseReadError("purchase_orders", orderError);
      return null;
    }
    if (!orderRow) return null;

    const { data: quotationRow, error: quotationError } = await supabase
      .from("quotations")
      .select("status,deleted_at")
      .eq("id", orderRow.quotation_id)
      .maybeSingle();
    if (quotationError) {
      logSupabaseReadError("quotations", quotationError);
      return null;
    }
    if (!quotationRow || isQuotationDeleted(quotationRow.status) || quotationRow.deleted_at) return null;

    const { data: itemRows, error: itemError } = await supabase
      .from("purchase_order_items")
      .select("*")
      .eq("purchase_order_id", orderRow.id);

    if (itemError) {
      logSupabaseReadError("purchase_order_items", itemError);
      return null;
    }
    return await enrichPurchaseOrderWithSupplierId(supabase, mapPurchaseOrder(orderRow, itemRows ?? []));
  } catch (error) {
    logSupabaseReadError("pedido publico", error);
    return null;
  }
}

export async function markSupabasePurchaseOrderOpened(token: string) {
  const supabase = db();
  const order = await getSupabasePurchaseOrderByToken(token);
  if (!order) throw new Error("Pedido não encontrado.");
  if (!["gerado", "enviado", "draft", "sent"].includes(order.status)) return order;

  const { data, error } = await supabase
    .from("purchase_orders")
    .update({ status: "aberto_pelo_vendedor", opened_at: new Date().toISOString() })
    .eq("public_token", token)
    .select("*")
    .single();
  if (error) {
    if (shouldRetryLegacyPurchaseOrderUpdate(error)) {
      console.error("[Supabase] Falha ao marcar pedido como aberto; mantendo status atual.", error);
      return order;
    }
    throw error;
  }
  return enrichPurchaseOrderWithSupplier(
    mapPurchaseOrder(data, order.items.map(mapPurchaseOrderItemToDbShape)),
    {
      nome: order.supplierContactName,
      empresa: order.supplierCompany,
      whatsapp: order.supplierWhatsapp,
    },
  );
}

export async function saveSupabasePurchaseOrderReview(
  token: string,
  itemUpdates: Array<{ id: string; fulfillmentStatus: PurchaseOrderItemFulfillmentStatus; vendorObservation?: string; billedQuantity?: number }>,
  finalize = false,
) {
  const supabase = db();
  console.info("[PublicOrder] Iniciando salvamento no Supabase", {
    token,
    finalize,
    itemCount: itemUpdates.length,
    payload: itemUpdates,
  });
  const order = await getSupabasePurchaseOrderByToken(token);
  if (!order) {
    console.warn("[PublicOrder] Pedido não encontrado para token", { token });
    throw new Error("Pedido não encontrado ou link expirado.");
  }
  console.info("[PublicOrder] Pedido encontrado", {
    token,
    orderId: order.id,
    status: order.status,
    currentItemCount: order.items.length,
  });
  if (["finalizado_pelo_vendedor", "parcialmente_faturado", "nao_faturado", "cancelado", "confirmed", "canceled"].includes(order.status)) {
    return order;
  }

  const updates = new Map(itemUpdates.map((item) => [item.id, item]));
  const nextItems = order.items.map((item) => {
    const update = updates.get(item.id);
    const fulfillmentStatus = normalizePurchaseOrderFulfillmentStatus(
      update?.fulfillmentStatus ?? item.fulfillmentStatus,
    );
    const billedQuantity = resolveBilledQuantity(item.quantityToBuy, fulfillmentStatus, update?.billedQuantity ?? item.billedQuantity);
    const missingQuantity = resolveMissingQuantity(item.quantityToBuy, billedQuantity);
    return {
      ...item,
      fulfillmentStatus,
      billedQuantity,
      missingQuantity,
      vendorObservation: update?.vendorObservation ?? item.vendorObservation ?? "",
    };
  });

  for (const item of nextItems) {
    await updateSupabasePurchaseOrderItemReview(supabase, item);
  }

  const status: PurchaseOrderStatus = finalize ? resolveFinalPurchaseOrderStatus(nextItems) : "em_conferencia";
  const confirmedAmount = nextItems
    .reduce((total, item) => total + roundMoney((item.billedQuantity ?? 0) * item.unitPrice), 0);
  const reviewedAt = new Date().toISOString();
  const completedAt = finalize ? reviewedAt : order.completedAt;
  const orderRow = await updateSupabasePurchaseOrderReviewHeader(
    supabase,
    order,
    status,
    confirmedAmount,
    completedAt,
    reviewedAt,
    finalize,
  );

  if (finalize) {
    try {
      await createSupabaseWinnerPendingItems(supabase, {
        ...order,
        status,
        confirmedAmount,
        completedAt,
        items: nextItems,
      });
    } catch (error) {
      console.error("[Supabase] Pedido finalizado, mas houve falha ao criar pendências de itens não faturados.", error);
    }
  }

  return enrichPurchaseOrderWithSupplier(
    mapPurchaseOrder(orderRow, nextItems.map(mapPurchaseOrderItemToDbShape)),
    {
      nome: order.supplierContactName,
      empresa: order.supplierCompany,
      whatsapp: order.supplierWhatsapp,
    },
  );
}

async function updateSupabasePurchaseOrderItemReview(supabase: SupabaseClient, item: PurchaseOrderItem) {
  const fulfillmentStatus = normalizePurchaseOrderFulfillmentStatus(item.fulfillmentStatus);
  const legacyStatus = toLegacyFulfillmentStatus(fulfillmentStatus);
  const billedQuantity = resolveBilledQuantity(item.quantityToBuy, fulfillmentStatus, item.billedQuantity);
  const missingQuantity = resolveMissingQuantity(item.quantityToBuy, billedQuantity);
  const updatedAt = new Date().toISOString();
  const attempts: Array<{ label: string; payload: Record<string, unknown> }> = [
    {
      label: "schema completo",
      payload: {
        fulfillment_status: fulfillmentStatus,
        billed_quantity: billedQuantity,
        missing_quantity: missingQuantity,
        vendor_observation: item.vendorObservation,
        status_faturamento: fulfillmentStatus,
        observacao_faturamento: item.vendorObservation,
        updated_at: updatedAt,
        atualizado_em: updatedAt,
      },
    },
    {
      label: "colunas principais",
      payload: {
        fulfillment_status: fulfillmentStatus,
        billed_quantity: billedQuantity,
        missing_quantity: missingQuantity,
        vendor_observation: item.vendorObservation,
      },
    },
    {
      label: "status principal",
      payload: {
        fulfillment_status: fulfillmentStatus,
      },
    },
    {
      label: "colunas alternativas",
      payload: {
        status_faturamento: fulfillmentStatus,
        observacao_faturamento: item.vendorObservation,
      },
    },
    {
      label: "status alternativo",
      payload: {
        status_faturamento: fulfillmentStatus,
      },
    },
  ];

  if (legacyStatus !== fulfillmentStatus) {
    attempts.push(
      {
        label: "colunas principais legado",
        payload: {
          fulfillment_status: legacyStatus,
          vendor_observation: item.vendorObservation,
        },
      },
      {
        label: "somente status legado",
        payload: {
          fulfillment_status: legacyStatus,
        },
      },
      {
        label: "status alternativo legado",
        payload: {
          status_faturamento: legacyStatus,
        },
      },
    );
  }

  let lastError: unknown;
  const reviewedAt = new Date().toISOString();
  for (const attempt of attempts) {
    const { error } = await supabase
      .from("purchase_order_items")
      .update(attempt.payload)
      .eq("id", item.id);
    if (!error) return;

    lastError = error;
    console.error("[Supabase] Falha ao atualizar item do pedido.", {
      itemId: item.id,
      attempt: attempt.label,
      payload: attempt.payload,
      error,
    });
    if (!shouldRetryLegacyPurchaseOrderUpdate(error)) break;
  }

  const legacyObservation = buildLegacyPurchaseOrderItemObservation({
    currentObservation: item.observation,
    fulfillmentStatus,
    vendorObservation: item.vendorObservation,
    reviewedAt,
  });
  const { error: legacyObservationError } = await supabase
    .from("purchase_order_items")
    .update({ observation: legacyObservation })
    .eq("id", item.id);
  if (!legacyObservationError) {
    console.warn("[Supabase] Conferência do item salva em fallback legado na coluna observation.", {
      itemId: item.id,
      fulfillmentStatus,
    });
    return;
  }

  lastError = legacyObservationError;
  console.error("[Supabase] Falha ao salvar fallback legado da conferência do item.", {
    itemId: item.id,
    error: legacyObservationError,
  });

  throw new Error(
    buildControlledDatabaseError(
      "Não foi possível salvar a conferência do pedido. Verifique os itens e tente novamente.",
      lastError,
    ),
  );
}

async function updateSupabasePurchaseOrderReviewHeader(
  supabase: SupabaseClient,
  order: PurchaseOrder,
  status: PurchaseOrderStatus,
  confirmedAmount: number,
  completedAt?: string,
  reviewedAt = new Date().toISOString(),
  finalize = false,
) {
  const attempts: Array<{ label: string; payload: Record<string, unknown> }> = [
    {
      label: "schema completo",
      payload: {
        status,
        confirmed_amount: confirmedAmount,
        completed_at: completedAt ?? null,
        pedido_finalizado: finalize,
        finalizado_em: finalize ? completedAt ?? reviewedAt : null,
        conferido_em: reviewedAt,
        atualizado_em: reviewedAt,
        updated_at: reviewedAt,
      },
    },
    {
      label: "colunas principais",
      payload: {
        status,
        confirmed_amount: confirmedAmount,
        completed_at: completedAt ?? null,
      },
    },
  ];

  const legacyStatus: PurchaseOrderStatus = status === "em_conferencia" ? "draft" : "confirmed";
  if (legacyStatus !== status) {
    attempts.push({
      label: "status legado",
      payload: { status: legacyStatus },
    });
  }

  let lastError: unknown;
  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from("purchase_orders")
      .update(attempt.payload)
      .eq("id", order.id)
      .select("*")
      .single();

    if (!error) {
      return {
        ...data,
        confirmed_amount: data.confirmed_amount ?? confirmedAmount,
        completed_at: data.completed_at ?? completedAt ?? null,
        conferido_em: data.conferido_em ?? reviewedAt,
        pedido_finalizado: data.pedido_finalizado ?? finalize,
      };
    }

    lastError = error;
    console.error("[Supabase] Falha ao atualizar cabeçalho do pedido.", {
      orderId: order.id,
      attempt: attempt.label,
      status,
      payload: attempt.payload,
      error,
    });
    if (!shouldRetryLegacyPurchaseOrderUpdate(error)) break;
  }

  throw new Error(
    buildControlledDatabaseError(
      "Não foi possível finalizar o pedido. Verifique os itens e tente novamente.",
      lastError,
    ),
  );
}

function shouldRetryLegacyPurchaseOrderUpdate(error: unknown) {
  const text = JSON.stringify(error).toLowerCase();
  return [
    "schema cache",
    "column",
    "constraint",
    "purchase_orders_status_check",
    "purchase_order_items_fulfillment_status_check",
    "opened_at",
    "completed_at",
    "confirmed_amount",
    "fulfillment_status",
    "vendor_observation",
    "status_faturamento",
    "observacao_faturamento",
    "billed_quantity",
    "missing_quantity",
    "pedido_finalizado",
    "finalizado_em",
    "conferido_em",
    "atualizado_em",
  ].some((needle) => text.includes(needle));
}

function toLegacyFulfillmentStatus(status: PurchaseOrderItemFulfillmentStatus) {
  return status === "pendente" ? "a_faturar" : status;
}

function resolveFinalPurchaseOrderStatus(items: PurchaseOrderItem[]): PurchaseOrderStatus {
  const billable = items.filter((item) => item.fulfillmentStatus !== "pendente");
  if (billable.length === 0) return "nao_faturado";
  const allBilled = items.every((item) => resolveMissingQuantity(item.quantityToBuy, item.billedQuantity ?? 0) <= 0);
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

function resolveMissingQuantity(requestedQuantity: number, billedQuantity: number) {
  return Math.max(0, requestedQuantity - billedQuantity);
}

function getResponseItemUnitPrice(moduleType: ModuleType, item: SupplierQuoteResponseItem) {
  return moduleType === "bidding"
    ? item.convertedUnitPrice ?? item.unitPrice ?? (
        item.packagePrice && item.packageQuantity ? item.packagePrice / item.packageQuantity : 0
      )
    : item.unitPrice ?? item.netPrice ?? item.convertedUnitPrice ?? 0;
}

function buildControlledDatabaseError(message: string, error: unknown) {
  console.error("[Supabase] Erro real retornado pelo banco.", error);
  return message;
}

export async function getSupabaseWinnerOrderPendingItems(quotationId?: string) {
  const supabase = readDb("winner_order_pending_items");
  if (!supabase) return [] as WinnerOrderPendingItem[];
  try {
    if (quotationId) {
      const { data: quotationRow, error: quotationError } = await supabase
        .from("quotations")
        .select("status,deleted_at")
        .eq("id", quotationId)
        .maybeSingle();
      if (quotationError || !quotationRow || isQuotationDeleted(quotationRow.status) || quotationRow.deleted_at) return [];
    }
    let query = supabase.from("winner_order_pending_items").select("*").order("created_at", { ascending: false });
    if (quotationId) query = query.eq("quotation_id", quotationId);
    const { data, error } = await query;
    if (error) {
      logSupabaseReadError("winner_order_pending_items", error);
      return [];
    }
    return (data ?? []).map(mapWinnerPendingItem);
  } catch (error) {
    logSupabaseReadError("winner_order_pending_items", error);
    return [];
  }
}

export async function redirectSupabaseWinnerPendingItemToNextSupplier(pendingId: string) {
  const supabase = db();
  const pending = await getSupabaseWinnerPendingItemById(supabase, pendingId);
  if (!pending) throw new Error("Pendência não encontrada.");
  if (pending.status !== "pendente") {
    throw new Error("Este item já foi tratado ou direcionado para outro vendedor.");
  }

  const bundle = await getSupabaseQuotationBundle(pending.quotationId);
  if (!bundle) throw new Error("Cotação não encontrada.");
  const quotationItem = bundle.items.find((item) => item.id === pending.quotationItemId);
  if (!quotationItem) throw new Error("Item da cotação não encontrado.");

  const candidates = bundle.responseItems
    .filter((item) =>
      item.quotationItemId === pending.quotationItemId &&
      getResponseItemUnitPrice(bundle.quotation.moduleType, item) > 0 &&
      item.supplierId !== pending.originalSupplierId,
    )
    .sort((a, b) => getResponseItemUnitPrice(bundle.quotation.moduleType, a) - getResponseItemUnitPrice(bundle.quotation.moduleType, b));
  const nextResponseItem = candidates[0];
  if (!nextResponseItem) throw new Error("Não existe próximo vendedor com preço válido para este item.");

  const response = bundle.responses.find((item) => item.id === nextResponseItem.responseId);
  const { data: supplierRow } = nextResponseItem.supplierId
    ? await supabase
        .from("suppliers")
        .select("id,nome,empresa,whatsapp")
        .eq("id", nextResponseItem.supplierId)
        .maybeSingle()
    : { data: null };
  const supplierName =
    response?.sellerCompany ??
    supplierRow?.empresa ??
    response?.sellerName ??
    supplierRow?.nome ??
    "Fornecedor";
  const unitPrice = getResponseItemUnitPrice(bundle.quotation.moduleType, nextResponseItem);
  const quantityToSend = pending.quantity;
  const packagesToBuy = nextResponseItem.packageQuantity
    ? Math.ceil(quantityToSend / nextResponseItem.packageQuantity)
    : quantityToSend;
  const totalPrice = bundle.quotation.moduleType === "bidding" && nextResponseItem.packagePrice
    ? roundMoney(packagesToBuy * nextResponseItem.packagePrice)
    : roundMoney(quantityToSend * unitPrice);

  const { data: orderRow, error: orderError } = await supabase
    .from("purchase_orders")
    .insert({
      tenant_id: pending.tenantId,
      quotation_id: pending.quotationId,
      module_type: bundle.quotation.moduleType,
      supplier_name: supplierName,
      supplier_id: nextResponseItem.supplierId,
      supplier_company: supplierRow?.empresa ?? response?.sellerCompany,
      supplier_whatsapp: supplierRow?.whatsapp ?? response?.sellerWhatsapp,
      total_amount: totalPrice,
      confirmed_amount: 0,
      status: "gerado",
    })
    .select("*")
    .single();
  if (orderError) throw orderError;

  const { data: itemRows, error: itemError } = await supabase
    .from("purchase_order_items")
    .insert({
      tenant_id: pending.tenantId,
      purchase_order_id: orderRow.id,
      quotation_item_id: pending.quotationItemId,
      product_name: quotationItem.productName,
      offered_product_name: nextResponseItem.offeredProductName ?? quotationItem.productName,
      laboratory: nextResponseItem.offeredLaboratory ?? quotationItem.requestedLaboratory,
      unit: quotationItem.requestedUnit,
      quantity_to_buy: quantityToSend,
      billed_quantity: 0,
      missing_quantity: quantityToSend,
      packages_to_buy: packagesToBuy,
      package_quantity: nextResponseItem.packageQuantity,
      package_price: nextResponseItem.packagePrice,
      unit_price: unitPrice,
      total_price: totalPrice,
      observation: nextResponseItem.sellerObservation,
      fulfillment_status: "pendente",
      vendor_observation: "",
      original_supplier_id: nextResponseItem.supplierId,
      original_supplier_name: supplierName,
    })
    .select("*");
  if (itemError) throw itemError;

  const { data: pendingRow, error: pendingError } = await supabase
    .from("winner_order_pending_items")
    .update({
      status: "enviado_para_proximo",
      next_supplier_id: nextResponseItem.supplierId,
      next_supplier_name: supplierName,
      next_unit_price: unitPrice,
      next_order_id: orderRow.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pending.id)
    .select("*")
    .single();
  if (pendingError) throw pendingError;

  return {
    pending: mapWinnerPendingItem(pendingRow),
    order: mapPurchaseOrder(orderRow, itemRows ?? []),
  };
}

export async function createSupabaseQuotationFromWinnerPendingItems(quotationId: string, pendingIds?: string[]) {
  const supabase = db();
  const { data: originalRow, error: quotationError } = await supabase
    .from("quotations")
    .select("*")
    .eq("id", quotationId)
    .maybeSingle();
  if (quotationError) throw quotationError;
  if (!originalRow) throw new Error("Cotação original não encontrada.");

  let pendingQuery = supabase
    .from("winner_order_pending_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .eq("status", "pendente");
  if (pendingIds?.length) pendingQuery = pendingQuery.in("id", pendingIds);

  const { data: pendingRows, error: pendingError } = await pendingQuery;
  if (pendingError) throw pendingError;
  if (!pendingRows?.length) throw new Error("Não há itens pendentes para nova cotação.");

  const { data: newQuotationRow, error: newQuotationError } = await supabase
    .from("quotations")
    .insert({
      tenant_id: originalRow.tenant_id,
      module_type: originalRow.module_type,
      name: `${originalRow.name} - itens pendentes`,
      pharmacy_id: originalRow.pharmacy_id,
      buyer_company_name: originalRow.buyer_company_name,
      destination_client: originalRow.destination_client,
      process_number: originalRow.process_number,
      bid_number: originalRow.bid_number,
      quotation_type: originalRow.quotation_type,
      judgment_type: originalRow.judgment_type,
      deadline_at: originalRow.deadline_at,
      allow_partial_supply: originalRow.allow_partial_supply,
      allow_equivalent: originalRow.allow_equivalent,
      consider_minimum_order: originalRow.consider_minimum_order,
      // TODO: preparar integração futura com Gemini para análise de falteiro/estoque e WhatsApp para envio automático ao vendedor.
      notes: originalRow.notes,
      status: "draft",
      created_by: originalRow.created_by,
      source_quotation_id: originalRow.id,
      source_purchase_order_id: pendingRows[0]?.purchase_order_id,
    })
    .select("*")
    .single();
  if (newQuotationError) throw newQuotationError;

  const { data: originalItems, error: itemError } = await supabase
    .from("quotation_items")
    .select("*")
    .in("id", pendingRows.map((pending) => pending.quotation_item_id));
  if (itemError) throw itemError;

  const itemsToInsert = pendingRows
    .map((pending, index) => {
      const originalItem = (originalItems ?? []).find((item) => item.id === pending.quotation_item_id);
      if (!originalItem) return null;
      return {
        tenant_id: originalItem.tenant_id,
        quotation_id: newQuotationRow.id,
        module_type: originalItem.module_type,
        item_number: index + 1,
        product_id: originalItem.product_id,
        product_name: originalItem.product_name,
        active_ingredient: originalItem.active_ingredient,
        dosage: originalItem.dosage,
        ean: originalItem.ean,
        requested_quantity: pending.quantity,
        requested_unit: originalItem.requested_unit,
        requested_laboratory: originalItem.requested_laboratory,
        laboratory_required: originalItem.laboratory_required,
        product_type: originalItem.product_type,
        accept_equivalent: originalItem.accept_equivalent,
        allow_partial_supply: originalItem.allow_partial_supply,
        buyer_observation: originalItem.buyer_observation,
        status: "aguardando_respostas",
        source_quotation_item_id: originalItem.id,
        source_purchase_order_id: pending.purchase_order_id,
        source_purchase_order_item_id: pending.purchase_order_item_id,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (itemsToInsert.length) {
    const { error: insertItemError } = await supabase.from("quotation_items").insert(itemsToInsert);
    if (insertItemError) throw insertItemError;
  }

  const { error: updatePendingError } = await supabase
    .from("winner_order_pending_items")
    .update({
      status: "nova_cotacao_criada",
      new_quotation_id: newQuotationRow.id,
      updated_at: new Date().toISOString(),
    })
    .in("id", pendingRows.map((pending) => pending.id));
  if (updatePendingError) throw updatePendingError;

  return mapQuotation(newQuotationRow);
}

export async function updateSupabaseWinnerPendingItemStatus(
  pendingId: string,
  status: WinnerOrderPendingItem["status"],
) {
  const supabase = db();
  const { data, error } = await supabase
    .from("winner_order_pending_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", pendingId)
    .select("*")
    .single();
  if (error) throw error;
  return mapWinnerPendingItem(data);
}

async function getSupabaseWinnerPendingItemById(supabase: SupabaseClient, pendingId: string) {
  const { data, error } = await supabase
    .from("winner_order_pending_items")
    .select("*")
    .eq("id", pendingId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapWinnerPendingItem(data) : null;
}

async function resolveTenant(supabase: SupabaseClient, moduleType: ModuleType, tenantId?: string) {
  if (tenantId) {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Empresa do usuario logado nao encontrada no Supabase.");
    return mapTenant(data);
  }

  const preferredTypes = moduleType === "pharmacy"
    ? ["pharmacy", "both"]
    : ["distributor_bidding", "both"];
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .in("tipo_cliente", preferredTypes)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Nenhuma empresa cliente cadastrada no Supabase.");
  return mapTenant(data);
}

async function ensureUnitTypes(supabase: SupabaseClient) {
  const { error } = await supabase
    .from("unit_types")
    .upsert([
      { code: "CP", name: "Comprimido", plural_name: "Comprimidos" },
      { code: "CAP", name: "Cápsula", plural_name: "Cápsulas" },
      { code: "AMP", name: "Ampola", plural_name: "Ampolas" },
      { code: "FR", name: "Frasco", plural_name: "Frascos" },
      { code: "BIS", name: "Bisnaga", plural_name: "Bisnagas" },
      { code: "SACHE", name: "Sachê", plural_name: "Sachês" },
      { code: "FLAC", name: "Flaconete", plural_name: "Flaconetes" },
      { code: "ML", name: "Mililitro", plural_name: "Mililitros" },
      { code: "G", name: "Grama", plural_name: "Gramas" },
      { code: "KG", name: "Quilograma", plural_name: "Quilogramas" },
      { code: "DOSE", name: "Dose", plural_name: "Doses" },
      { code: "UN", name: "Unidade", plural_name: "Unidades" },
      { code: "CX", name: "Caixa", plural_name: "Caixas" },
    ], { onConflict: "code", ignoreDuplicates: true });

  if (error) throw error;
}

async function resolvePharmacy(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase
    .from("pharmacies")
    .select("*")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function resolveQuotationProducts(
  supabase: SupabaseClient,
  tenantId: string,
  items: Array<{ productId?: string; productName: string }>,
) {
  const productIds = Array.from(new Set(items.map((item) => item.productId).filter(Boolean))) as string[];
  if (productIds.length === 0) return new Map<string, Record<string, any>>();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "ativo")
    .in("id", productIds);

  if (error) throw error;
  return new Map((data ?? []).map((product) => [product.id as string, product as Record<string, any>]));
}

async function resolveSupplier(
  supabase: SupabaseClient,
  tenantId: string,
  supplier: { id: string; nome: string; empresa: string; whatsapp: string; email?: string; tipo?: string },
) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplier.id);
  if (isUuid) {
    const { data } = await supabase.from("suppliers").select("*").eq("id", supplier.id).maybeSingle();
    if (data) return data;
  }

  const { data: existing } = await supabase
    .from("suppliers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("empresa", supplier.empresa)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      tenant_id: tenantId,
      nome: supplier.nome,
      empresa: supplier.empresa,
      whatsapp: supplier.whatsapp,
      email: supplier.email,
      tipo_fornecedor: supplier.tipo === "Distribuidora" ? "distribuidora" : "vendedor",
      status: "ativo",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
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
    dataVencimento: row.data_vencimento,
    valorMensal: Number(row.valor_mensal ?? 0),
  };
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

function mapQuotationItem(row: Record<string, any>): QuotationItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    quotationId: row.quotation_id,
    moduleType: row.module_type,
    itemNumber: Number(row.item_number),
    productId: row.product_id ?? undefined,
    productName: row.product_name,
    activeIngredient: row.active_ingredient ?? undefined,
    dosage: row.dosage ?? undefined,
    ean: row.ean ?? undefined,
    requestedQuantity: Number(row.requested_quantity ?? 0),
    requestedUnit: row.requested_unit,
    requestedLaboratory: row.requested_laboratory ?? undefined,
    laboratoryRequired: Boolean(row.laboratory_required),
    productType: row.product_type,
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
    unit: item.unit,
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

function mapPurchaseOrderItemToDbShape(item: PurchaseOrderItem) {
  return {
    id: item.id,
    tenant_id: item.tenantId,
    purchase_order_id: item.purchaseOrderId,
    quotation_item_id: item.quotationItemId,
    product_name: item.productName,
    offered_product_name: item.offeredProductName,
    laboratory: item.laboratory,
    unit: item.unit,
    quantity_to_buy: item.quantityToBuy,
    billed_quantity: item.billedQuantity,
    missing_quantity: item.missingQuantity,
    packages_to_buy: item.packagesToBuy,
    package_quantity: item.packageQuantity,
    package_price: item.packagePrice,
    unit_price: item.unitPrice,
    total_price: item.totalPrice,
    observation: item.observation,
    fulfillment_status: normalizePurchaseOrderFulfillmentStatus(item.fulfillmentStatus),
    vendor_observation: item.vendorObservation,
    original_supplier_id: item.originalSupplierId,
    original_supplier_name: item.originalSupplierName,
  };
}

async function createSupabaseWinnerPendingItems(supabase: SupabaseClient, order: PurchaseOrder) {
  for (const item of order.items) {
    const billedQuantity = resolveBilledQuantity(item.quantityToBuy, item.fulfillmentStatus ?? "pendente", item.billedQuantity);
    const missingQuantity = resolveMissingQuantity(item.quantityToBuy, billedQuantity);
    if (missingQuantity <= 0) continue;
    const { error } = await supabase
      .from("winner_order_pending_items")
      .upsert({
        id: `pending-${order.id}-${item.quotationItemId}`,
        tenant_id: order.tenantId,
        quotation_id: order.quotationId,
        purchase_order_id: order.id,
        purchase_order_item_id: item.id,
        quotation_item_id: item.quotationItemId,
        product_name: item.productName,
        quantity: missingQuantity,
        requested_quantity: item.quantityToBuy,
        billed_quantity: billedQuantity,
        unit: item.unit,
        original_unit_price: item.unitPrice,
        original_total_price: roundMoney(missingQuantity * item.unitPrice),
        original_supplier_id: order.supplierId,
        original_supplier_name: order.supplierName,
        reason: item.vendorObservation || (item.fulfillmentStatus === "parcial" ? "Falta parcial" : "Nao faturado"),
        status: "pendente",
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
  }
}

function mapWinnerPendingItem(row: Record<string, any>): WinnerOrderPendingItem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    quotationId: row.quotation_id,
    purchaseOrderId: row.purchase_order_id,
    purchaseOrderItemId: row.purchase_order_item_id,
    quotationItemId: row.quotation_item_id,
    productName: row.product_name,
    quantity: Number(row.quantity ?? 0),
    requestedQuantity: row.requested_quantity != null ? Number(row.requested_quantity) : undefined,
    billedQuantity: row.billed_quantity != null ? Number(row.billed_quantity) : undefined,
    unit: row.unit ?? "UN",
    originalUnitPrice: Number(row.original_unit_price ?? 0),
    originalTotalPrice: Number(row.original_total_price ?? 0),
    originalSupplierId: row.original_supplier_id ?? undefined,
    originalSupplierName: row.original_supplier_name,
    reason: row.reason ?? undefined,
    nextSupplierId: row.next_supplier_id ?? undefined,
    nextSupplierName: row.next_supplier_name ?? undefined,
    nextUnitPrice: row.next_unit_price ? Number(row.next_unit_price) : undefined,
    nextOrderId: row.next_order_id ?? undefined,
    newQuotationId: row.new_quotation_id ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getNumericPackageQuantity(row: SellerResponseRowDraft) {
  const raw = row.packageQuantity === "outro" ? row.packageQuantityOther : row.packageQuantity;
  return parseMoney(raw);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDeliveryDays(value?: string) {
  if (!value) return undefined;
  if (/imediato/i.test(value)) return 0;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function parseMoney(value?: string) {
  return parseCurrencyInput(value);
}
