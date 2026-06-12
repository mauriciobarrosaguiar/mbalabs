export type CustomerType = "pharmacy" | "distributor_bidding" | "both";
export type ClientType = CustomerType;
export type TenantStatus = "teste" | "ativo" | "suspenso" | "cancelado" | "inativo";

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN_EMPRESA"
  | "COMPRADOR"
  | "CONFERENTE"
  | "FINANCEIRO"
  | "VENDEDOR_EXTERNO";

export type ModuleType = "pharmacy" | "bidding";
export type QuotationStatus =
  | "draft"
  | "open"
  | "waiting_responses"
  | "analyzing"
  | "finished"
  | "gerado"
  | "generated"
  | "pedido_gerado"
  | "canceled"
  | "excluida"
  | "deleted";

export type SellerSessionStatus =
  | "opened"
  | "draft"
  | "submitted"
  | "expired"
  | "canceled";
export type SupplierSessionStatus = SellerSessionStatus;

export type PaymentStatus =
  | "pending"
  | "paid"
  | "overdue"
  | "canceled"
  | "refunded";

export type ProductType =
  | "generico"
  | "similar"
  | "etico"
  | "generico_similar"
  | "mip"
  | "perfumaria"
  | "controlado"
  | "hospitalar"
  | "qualquer"
  | "outros";

export type UnitType =
  | "CP"
  | "CAP"
  | "AMP"
  | "FR"
  | "BIS"
  | "SACHE"
  | "FLAC"
  | "ML"
  | "G"
  | "KG"
  | "DOSE"
  | "UN"
  | "CX";

export type JudgmentType = "by_item" | "by_lot" | "global";
export type PurchaseOrderStatus =
  | "gerado"
  | "enviado"
  | "enviado_ao_vendedor"
  | "aberto_pelo_vendedor"
  | "em_conferencia"
  | "finalizado_pelo_vendedor"
  | "parcialmente_faturado"
  | "nao_faturado"
  | "cancelado"
  | "draft"
  | "sent"
  | "confirmed"
  | "canceled";

export type PurchaseOrderItemFulfillmentStatus =
  | "faturado"
  | "parcial"
  | "nao_faturado"
  | "pendente";

export type WinnerPendingStatus =
  | "pendente"
  | "enviado_para_proximo"
  | "nova_cotacao_criada"
  | "cancelado"
  | "resolvido";

export type BiddingItemStatus =
  | "aguardando_respostas"
  | "sem_resposta"
  | "atendido_total"
  | "atendido_parcial"
  | "saldo_pendente"
  | "nao_atendido"
  | "marca_incompativel"
  | "unidade_incompativel"
  | "preco_suspeito";

export interface UnitDefinition {
  code: UnitType;
  name: string;
  plural: string;
}

export interface Tenant {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  tipoCliente: CustomerType;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelWhatsapp: string;
  planoId: string;
  status: TenantStatus;
  dataInicio: string;
  dataVencimento: string;
  valorMensal: number;
}

export interface UserProfile {
  id: string;
  authUserId?: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: "ativo" | "inativo" | "convidado";
}

export interface TenantUser {
  id: string;
  tenantId: string;
  userProfileId: string;
  role: Exclude<UserRole, "SUPER_ADMIN" | "VENDEDOR_EXTERNO">;
  status: "ativo" | "inativo" | "convidado";
}

export interface Pharmacy {
  id: string;
  tenantId: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  cidade: string;
  uf: string;
  responsavel: string;
  whatsapp: string;
  email: string;
  status: "ativo" | "inativo";
}

export interface Supplier {
  id: string;
  tenantId: string;
  nome: string;
  empresa: string;
  whatsapp: string;
  email?: string;
  tipoFornecedor:
    | "vendedor"
    | "distribuidora"
    | "laboratorio"
    | "marketplace"
    | "outro";
  observacao?: string;
  status: "ativo" | "inativo";
}

export interface Distributor {
  id: string;
  tenantId: string;
  nome: string;
  unidadeCd: string;
  uf: string;
  pedidoMinimo: number;
  prazoMedio: string;
  portal?: string;
  observacao?: string;
  status: "ativo" | "inativo";
}

export interface Laboratory {
  id: string;
  tenantId: string;
  nome: string;
  cnpj?: string;
  tipo: "laboratorio" | "marca" | "fabricante";
  status: "ativo" | "inativo";
}

export interface Product {
  id: string;
  tenantId: string;
  nome: string;
  principioAtivo?: string;
  dosagem?: string;
  forma?: string;
  tipoProduto: ProductType;
  laboratorioId?: string;
  ean?: string;
  unidadeBase: UnitType | string;
  apresentacao: string;
  quantidadePorEmbalagem: number;
  status: "ativo" | "inativo";
}

export interface Quotation {
  id: string;
  tenantId: string;
  moduleType: ModuleType;
  name: string;
  pharmacyId?: string;
  buyerCompanyName?: string;
  destinationClient?: string;
  orgaoDestino?: string;
  processNumber?: string;
  bidNumber?: string;
  quotationType?: ProductType;
  judgmentType?: JudgmentType;
  deadlineAt: string;
  allowPartialSupply: boolean;
  allowEquivalent: boolean;
  considerMinimumOrder: boolean;
  notes?: string;
  status: QuotationStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItem {
  id: string;
  tenantId: string;
  quotationId: string;
  moduleType: ModuleType;
  itemNumber: number;
  productId?: string;
  productName: string;
  activeIngredient?: string;
  dosage?: string;
  ean?: string;
  requestedQuantity: number;
  requestedUnit: UnitType | string;
  requestedLaboratory?: string;
  laboratoryRequired: boolean;
  productType: ProductType;
  acceptEquivalent: boolean;
  allowPartialSupply: boolean;
  minimumValidity?: string;
  msRegistrationRequired: boolean;
  maxDeliveryDays?: number;
  lotGroup?: string;
  buyerObservation?: string;
  lastPurchasePrice?: number;
  lastPurchaseDate?: string;
  status: BiddingItemStatus | "ativo";
}

export interface SupplierQuoteSession {
  id: string;
  tenantId: string;
  quotationId: string;
  supplierId?: string;
  publicToken: string;
  sellerName: string;
  sellerCompany: string;
  sellerWhatsapp: string;
  sellerEmail?: string;
  expiresAt: string;
  submittedAt?: string;
  status: SellerSessionStatus;
}

export interface SupplierQuoteResponse {
  id: string;
  tenantId: string;
  quotationId: string;
  sessionId: string;
  supplierId?: string;
  sellerName: string;
  sellerCompany: string;
  sellerWhatsapp: string;
  sellerEmail?: string;
  billingCompany?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  generalObservation?: string;
  status: SellerSessionStatus;
  submittedAt?: string;
}

export interface SupplierQuoteResponseItem {
  id: string;
  tenantId: string;
  quotationId: string;
  quotationItemId: string;
  responseId: string;
  supplierId?: string;
  offeredProductName?: string;
  offeredLaboratory?: string;
  offeredUnit?: UnitType | string;
  packageQuantity?: number;
  packagePrice?: number;
  hasFullQuantity?: boolean;
  availableQuantity?: number;
  deliveryDays?: number;
  sellerObservation?: string;
  unitPrice?: number;
  grossPrice?: number;
  extraDiscount?: number;
  netPrice?: number;
  deliveryTermText?: string;
  hasStock?: boolean;
  distributorId?: string;
  convertedUnitPrice?: number;
  requiredPackagesTotal?: number;
  packagesToBuy?: number;
  quantityToBuy?: number;
  quantityShortage?: number;
  technicalSurplus?: number;
  totalPriceIfFull?: number;
  totalPriceAvailable?: number;
  rankingPosition?: number;
  awardStatus?: string;
  alertStatus?: string;
}

export interface QuotationAward {
  id: string;
  tenantId: string;
  quotationId: string;
  quotationItemId: string;
  supplierResponseItemId: string;
  supplierId?: string;
  supplierName: string;
  moduleType: ModuleType;
  rankingPosition: number;
  awardedQuantity: number;
  awardedPackages: number;
  unitPrice: number;
  packagePrice?: number;
  totalPrice: number;
  remainingBalanceAfter: number;
  status: "winner" | "partial" | "minimum_order_warning" | "pending" | "tie_manual";
  tieReason?: string;
}

export interface PendingBalance {
  id: string;
  tenantId: string;
  quotationId: string;
  quotationItemId: string;
  productName: string;
  requestedQuantity: number;
  suppliedQuantity: number;
  pendingQuantity: number;
  unit: UnitType | string;
  status: "pending" | "new_quotation_created" | "canceled" | "resolved";
  newQuotationId?: string;
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  quotationId: string;
  moduleType: ModuleType;
  supplierName: string;
  supplierId?: string;
  supplierWhatsapp?: string;
  supplierCompany?: string;
  supplierContactName?: string;
  publicToken: string;
  totalAmount: number;
  status: PurchaseOrderStatus;
  generatedAt?: string;
  openedAt?: string;
  completedAt?: string;
  confirmedAmount?: number;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  tenantId: string;
  purchaseOrderId: string;
  quotationItemId: string;
  productName: string;
  offeredProductName?: string;
  laboratory?: string;
  unit: UnitType | string;
  quantityToBuy: number;
  billedQuantity?: number;
  missingQuantity?: number;
  packagesToBuy?: number;
  packageQuantity?: number;
  packagePrice?: number;
  unitPrice: number;
  totalPrice: number;
  observation?: string;
  fulfillmentStatus?: PurchaseOrderItemFulfillmentStatus;
  vendorObservation?: string;
  originalSupplierId?: string;
  originalSupplierName?: string;
}

export interface WinnerOrderPendingItem {
  id: string;
  tenantId: string;
  quotationId: string;
  purchaseOrderId: string;
  purchaseOrderItemId: string;
  quotationItemId: string;
  productName: string;
  quantity: number;
  requestedQuantity?: number;
  billedQuantity?: number;
  unit: UnitType | string;
  originalUnitPrice: number;
  originalTotalPrice: number;
  originalSupplierId?: string;
  originalSupplierName: string;
  reason?: string;
  nextSupplierId?: string;
  nextSupplierName?: string;
  nextUnitPrice?: number;
  nextOrderId?: string;
  newQuotationId?: string;
  status: WinnerPendingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  maxUsers: number;
  maxQuotationsMonth: number;
  maxPharmacies?: number;
  modules: CustomerType;
  status: "ativo" | "inativo";
  observation?: string;
}

export interface MonthlySubscription {
  id: string;
  tenantId: string;
  planId?: string;
  referenceMonth: string;
  dueDate: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod?: string;
  paidAt?: string;
  paidAmount?: number;
  manualPaymentNote?: string;
  txid?: string;
  efiStatus?: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  monthlySubscriptionId?: string;
  provider: "efi" | "manual" | "outro";
  txid?: string;
  amount: number;
  status: PaymentStatus;
  paidAt?: string;
}

export interface AuditLog {
  id: string;
  tenantId?: string;
  actor: string;
  action: string;
  entity: string;
  severity: "info" | "warning" | "error";
  createdAt: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}
