export type DistributorIntegrationStatus =
  | "not_configured"
  | "homologation"
  | "active"
  | "error";

export type DistributorConnectionMode =
  | "to_define"
  | "api"
  | "edi_van"
  | "communicator"
  | "portal";

export interface DistributorDefinition {
  key: string;
  name: string;
  unitName: string;
  city?: string;
  state: string;
  status: DistributorIntegrationStatus;
  preferredConnectionMode: DistributorConnectionMode;
  customerCodeRequired: boolean;
  supportsAutomaticQuote: boolean;
  supportsAutomaticOrder: boolean;
  notes?: string;
}

export interface DistributorQuoteRequestItem {
  quotationItemId: string;
  ean?: string;
  productName: string;
  quantity: number;
}

export interface DistributorQuoteRequest {
  tenantId: string;
  pharmacyId?: string;
  customerCnpj: string;
  customerCode?: string;
  items: DistributorQuoteRequestItem[];
}

export interface DistributorQuoteOffer {
  quotationItemId: string;
  ean?: string;
  distributorProductCode?: string;
  offeredProductName: string;
  availableStock: number;
  unitPrice: number;
  packagePrice?: number;
  packageQuantity?: number;
  paymentTerms?: string;
  minimumOrderAmount?: number;
  observation?: string;
}

export interface DistributorQuoteResult {
  distributorKey: string;
  requestedAt: string;
  receivedAt: string;
  offers: DistributorQuoteOffer[];
}

export interface DistributorOrderItem {
  quotationItemId: string;
  ean?: string;
  distributorProductCode?: string;
  quantity: number;
  expectedUnitPrice: number;
}

export interface DistributorOrderRequest {
  tenantId: string;
  pharmacyId?: string;
  customerCnpj: string;
  customerCode?: string;
  purchaseOrderId: string;
  items: DistributorOrderItem[];
}

export interface DistributorOrderResult {
  distributorKey: string;
  accepted: boolean;
  externalOrderId?: string;
  message?: string;
  submittedAt: string;
}

export interface DistributorConnector {
  readonly distributorKey: string;
  checkConnection(): Promise<{ ok: boolean; message?: string }>;
  requestQuote(request: DistributorQuoteRequest): Promise<DistributorQuoteResult>;
  submitOrder(request: DistributorOrderRequest): Promise<DistributorOrderResult>;
}
