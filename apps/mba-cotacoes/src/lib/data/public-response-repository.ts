/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/supabase/server";
import { calculateBiddingResponseItem } from "@/lib/services/bidding-analysis";
import {
  calculateSellerRow,
  parseNumberInput,
  validateSellerResponse,
  type SellerResponseRowDraft,
} from "@/lib/services/seller-response";
import { isQuotationClosed, isQuotationDeleted } from "@/lib/quotation-status";
import type {
  ModuleType,
  Pharmacy,
  ProductType,
  Quotation,
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
  SupplierQuoteSession,
  Tenant,
} from "@/lib/types";

type DbClient = ReturnType<typeof createSupabaseAdminClient>;

interface SavePublicSellerResponseInput {
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
}

export function canUsePublicResponseRepository() {
  return hasSupabaseConfig() && hasSupabaseAdminConfig();
}

function db(): DbClient {
  return createSupabaseAdminClient();
}

function logSupabaseReadError(context: string, error: unknown) {
  console.error(`[Supabase] Falha ao buscar ${context}:`, error);
}

function readDb(context: string): DbClient | null {
  if (!canUsePublicResponseRepository()) return null;
  try {
    return db();
  } catch (error) {
    logSupabaseReadError(context, error);
    return null;
  }
}

export async function getPublicQuoteByToken(token: string, moduleType: ModuleType) {
  if (!canUsePublicResponseRepository()) return null;

  const supabase = readDb("cotacao publica");
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
    if (!quotationRow || isQuotationDeleted(quotationRow.status) || quotationRow.deleted_at) return null;

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
      pharmacy: pharmacyRow ? mapPharmacy(pharmacyRow) : undefined,
      response: responseRow ? mapSupplierResponse(responseRow) : undefined,
      responseItems: (responseItemRows ?? []).map(mapSupplierResponseItem),
    };
  } catch (error) {
    logSupabaseReadError("cotacao publica", error);
    return null;
  }
}

export async function savePublicSellerResponse(token: string, input: SavePublicSellerResponseInput) {
  if (!canUsePublicResponseRepository()) {
    throw new Error("Supabase não configurado para resposta real.");
  }

  const publicQuote = await getPublicQuoteByToken(token, input.moduleType);
  if (!publicQuote?.session || !publicQuote.quotation) {
    throw new Error("Cotação não encontrada ou link inválido.");
  }

  const { session, quotation } = publicQuote;

  if (session.status === "submitted" || publicQuote.response?.status === "submitted") {
    throw new Error("Esta resposta já foi enviada e está bloqueada para edição.");
  }

  if (session.status === "expired" || isExpired(session.expiresAt)) {
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
      items: publicQuote.items,
      rows: input.rows,
    });

    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(" "));
    }
  }

  const supabase = db();
  const submittedAt = input.status === "submitted" ? new Date().toISOString() : null;
  const responseId = await upsertResponse(supabase, session, input, submittedAt);

  await replaceResponseItems(supabase, {
    responseId,
    session,
    moduleType: input.moduleType,
    items: publicQuote.items,
    rows: input.rows,
  });

  const { error: sessionError } = await supabase
    .from("supplier_quote_sessions")
    .update({
      seller_name: input.seller?.name ?? session.sellerName,
      seller_company: input.seller?.company ?? session.sellerCompany,
      seller_whatsapp: input.seller?.whatsapp ?? session.sellerWhatsapp,
      seller_email: input.seller?.email ?? session.sellerEmail,
      status: input.status,
      submitted_at: submittedAt,
    })
    .eq("id", session.id);

  if (sessionError) throw sessionError;

  if (input.status === "submitted") {
    await updateQuotationResponseStatus(supabase, session.quotationId);
  }

  return {
    ok: true,
    status: input.status,
    submittedAt,
  };
}

async function updateQuotationResponseStatus(supabase: DbClient, quotationId: string) {
  const { data: sessions, error } = await supabase
    .from("supplier_quote_sessions")
    .select("status")
    .eq("quotation_id", quotationId);

  if (error) throw error;

  const hasSubmitted = (sessions ?? []).some((session) => session.status === "submitted");
  const { error: updateError } = await supabase
    .from("quotations")
    .update({ status: hasSubmitted ? "analyzing" : "waiting_responses" })
    .eq("id", quotationId);

  if (updateError) throw updateError;
}

async function upsertResponse(
  supabase: DbClient,
  session: SupplierQuoteSession,
  input: SavePublicSellerResponseInput,
  submittedAt: string | null,
) {
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
    supplier_id: session.supplierId ?? null,
    seller_name: input.seller?.name ?? session.sellerName,
    seller_company: input.seller?.company ?? session.sellerCompany,
    seller_whatsapp: input.seller?.whatsapp ?? session.sellerWhatsapp,
    seller_email: input.seller?.email ?? session.sellerEmail ?? null,
    billing_company: input.seller?.billingCompany ?? null,
    payment_terms: input.seller?.paymentTerms ?? null,
    delivery_terms: input.seller?.deliveryTerms ?? null,
    general_observation: input.seller?.generalObservation ?? null,
    status: input.status,
    submitted_at: submittedAt,
  };

  const query = existingResponse
    ? supabase
        .from("supplier_quote_responses")
        .update(responsePayload)
        .eq("id", existingResponse.id)
        .select("id")
        .single()
    : supabase.from("supplier_quote_responses").insert(responsePayload).select("id").single();

  const { data, error } = await query;
  if (error) throw error;
  return data.id as string;
}

async function replaceResponseItems(
  supabase: DbClient,
  input: {
    responseId: string;
    session: SupplierQuoteSession;
    moduleType: ModuleType;
    items: QuotationItem[];
    rows: SellerResponseRowDraft[];
  },
) {
  const { error: deleteError } = await supabase
    .from("supplier_quote_response_items")
    .delete()
    .eq("response_id", input.responseId);

  if (deleteError) throw deleteError;

  const payloads: Record<string, any>[] = input.items.flatMap<Record<string, any>>((item) => {
    const row =
      input.rows.find((candidate) => candidate.quotationItemId === item.id) ??
      ({ quotationItemId: item.id } as SellerResponseRowDraft);

    if (input.moduleType === "bidding") {
      return [buildBiddingResponseItemPayload(input.responseId, input.session, item, row)];
    }

    const calculation = calculateSellerRow("pharmacy", item, row);
    if (calculation.netPrice <= 0) return [];

    return [buildPharmacyResponseItemPayload(input.responseId, input.session, item, row)];
  });

  if (payloads.length === 0) return;

  const { error: insertError } = await supabase.from("supplier_quote_response_items").insert(payloads);
  if (insertError) throw insertError;
}

function buildPharmacyResponseItemPayload(
  responseId: string,
  session: SupplierQuoteSession,
  item: QuotationItem,
  row: SellerResponseRowDraft,
) {
  const calculation = calculateSellerRow("pharmacy", item, row);
  const grossPrice = parseNumberInput(row.grossPrice);
  const extraDiscount = parseNumberInput(row.extraDiscount);
  const netPrice = calculation.netPrice || parseNumberInput(row.netPrice);

  return {
    tenant_id: session.tenantId,
    quotation_id: session.quotationId,
    quotation_item_id: item.id,
    response_id: responseId,
    supplier_id: session.supplierId ?? null,
    offered_product_name: clean(row.offeredProductName) ?? item.productName,
    offered_laboratory: clean(row.offeredLaboratory) ?? item.requestedLaboratory ?? null,
    package_price: null,
    gross_price: grossPrice || null,
    discount_extra: extraDiscount || null,
    net_price: netPrice || null,
    unit_price: netPrice || null,
    has_stock: row.hasStock !== "nao",
    available_quantity: calculation.attendedQuantity || null,
    delivery_term_text: clean(row.deliveryText) ?? null,
    delivery_days: parseDeliveryDays(row.deliveryText),
    seller_observation: clean(row.observation) ?? null,
    total_price_available: calculation.itemTotal || null,
  };
}

function buildBiddingResponseItemPayload(
  responseId: string,
  session: SupplierQuoteSession,
  item: QuotationItem,
  row: SellerResponseRowDraft,
) {
  const packageQuantity = getNumericPackageQuantity(row);
  const packagePrice = parseNumberInput(row.packagePrice);
  const hasFullQuantity = row.hasFullQuantity !== "nao";
  const availableQuantity = hasFullQuantity ? item.requestedQuantity : parseNumberInput(row.attendedQuantity);
  const calculation =
    packageQuantity > 0 && packagePrice >= 0
      ? calculateBiddingResponseItem({
          requestedQuantity: item.requestedQuantity,
          packageQuantity,
          packagePrice,
          hasFullQuantity,
          availableQuantity,
        })
      : null;

  return {
    tenant_id: session.tenantId,
    quotation_id: session.quotationId,
    quotation_item_id: item.id,
    response_id: responseId,
    supplier_id: session.supplierId ?? null,
    offered_product_name: clean(row.offeredProductName) ?? item.productName,
    offered_laboratory: clean(row.offeredLaboratory) ?? item.requestedLaboratory ?? null,
    offered_unit: row.offeredUnit || item.requestedUnit,
    package_quantity: packageQuantity || null,
    package_price: packagePrice || null,
    has_full_quantity: hasFullQuantity,
    available_quantity: availableQuantity || null,
    delivery_term_text: clean(row.deliveryText) ?? null,
    delivery_days: parseDeliveryDays(row.deliveryText),
    seller_observation: clean(row.observation) ?? null,
    converted_unit_price: calculation?.convertedUnitPrice ?? null,
    required_packages_total: calculation?.requiredPackagesTotal ?? null,
    packages_to_buy: calculation?.packagesToBuy ?? null,
    quantity_to_buy: calculation?.quantityToBuy ?? null,
    quantity_shortage: calculation?.quantityShortage ?? null,
    technical_surplus: calculation?.technicalSurplus ?? null,
    total_price_if_full: calculation?.totalPriceIfFull ?? null,
    total_price_available: calculation?.totalPriceAvailable ?? null,
    alert_status: calculation?.status ?? null,
  };
}

function mapTenant(row: Record<string, any>): Tenant {
  return {
    id: row.id,
    nomeFantasia: row.nome_fantasia,
    razaoSocial: row.razao_social,
    cnpj: row.cnpj,
    tipoCliente: row.tipo_cliente,
    responsavelNome: row.responsavel_nome ?? "",
    responsavelEmail: row.responsavel_email ?? "",
    responsavelWhatsapp: row.responsavel_whatsapp ?? "",
    planoId: row.plano_id ?? "",
    status: row.status,
    dataInicio: row.data_inicio,
    dataVencimento: row.data_vencimento,
    valorMensal: Number(row.valor_mensal ?? 0),
  };
}

function mapPharmacy(row: Record<string, any>): Pharmacy {
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
    status: row.status,
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

function getNumericPackageQuantity(row: SellerResponseRowDraft) {
  const raw = row.packageQuantity === "outro" ? row.packageQuantityOther : row.packageQuantity;
  return parseNumberInput(raw);
}

function parseDeliveryDays(value?: string) {
  if (!value) return undefined;
  if (/imediato/i.test(value)) return 0;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function clean(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function isExpired(expiresAt?: string) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() < Date.now());
}
