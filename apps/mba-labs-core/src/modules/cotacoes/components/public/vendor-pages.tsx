import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Clock, LockKeyhole } from "lucide-react";
import { StatusBadge } from "@/modules/cotacoes/components/dashboard/status-badge";
import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import { SellerResponseForm } from "@/modules/cotacoes/components/quotations/seller-response-form";
import { WinnerOrderForm } from "@/modules/cotacoes/components/quotations/winner-order-form";
import { formatCurrency, formatDate, formatDateTime } from "@/modules/cotacoes/lib/formatters";
import {
  canUsePublicResponseRepository,
  getPublicQuoteByToken,
} from "@/modules/cotacoes/lib/data/public-response-repository";
import {
  getCollections,
  getPurchaseOrderByToken,
  getQuotationById,
} from "@/modules/cotacoes/lib/data/repository";
import {
  getPurchaseOrderSupplierCompany,
  getPurchaseOrderSupplierContact,
} from "@/modules/cotacoes/lib/purchase-order-display";
import * as demoRepository from "@/modules/cotacoes/lib/data/demo-repository";
import { shouldUseDemoData } from "@/modules/cotacoes/lib/runtime-mode";
import type {
  ModuleType,
  Quotation,
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
  SupplierQuoteSession,
  Tenant,
} from "@/modules/cotacoes/lib/types";

interface PublicQuoteData {
  session?: SupplierQuoteSession;
  quotation?: Quotation;
  items: QuotationItem[];
  tenant?: Tenant;
  pharmacy?: {
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
    status: string;
  };
  response?: SupplierQuoteResponse;
  responseItems: SupplierQuoteResponseItem[];
}

export async function VendorResponsePage({
  token,
  moduleType,
}: {
  token: string;
  moduleType: ModuleType;
}) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const isLocalRequest =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");
  const useSupabase = canUsePublicResponseRepository();
  const supabasePublicData = useSupabase
    ? await getPublicQuoteByToken(token, moduleType)
    : null;
  const allowDemoFallback =
    shouldUseDemoData() ||
    (isLocalRequest && token.includes("demo-token"));
  const publicData = supabasePublicData ?? (allowDemoFallback ? await getDemoPublicData(token, moduleType) : null);

  if (!publicData?.session || !publicData.quotation) {
    return (
      <PublicShell>
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex gap-3 p-5 text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h1 className="font-semibold">Cotação não encontrada ou link inválido.</h1>
              <p className="mt-1 text-sm">
                Confirme se o link recebido está completo. O token público só abre a cotação vinculada ao seu convite.
              </p>
            </div>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  const { session, quotation, items, tenant, pharmacy, response, responseItems } = publicData;
  const isBidding = moduleType === "bidding";
  const buyerName = isBidding
    ? quotation.buyerCompanyName ?? tenant?.nomeFantasia ?? "Comprador"
    : pharmacy?.nomeFantasia ?? tenant?.nomeFantasia ?? "Farmácia";
  const lockedReason = getLockedReason(session, quotation, response);

  if (isAccessBlockedLock(lockedReason)) {
    return (
      <PublicShell>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="flex gap-3 p-5 text-slate-800">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <div>
              <h1 className="font-semibold">{lockedReason}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Entre em contato com o comprador caso precise confirmar alguma informação.
              </p>
            </div>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-teal-50 text-teal-700">
              Link público seguro
            </Badge>
            <Badge variant="outline">
              <Clock className="h-3 w-3" />
              Prazo {formatDateTime(quotation.deadlineAt)}
            </Badge>
            <Badge className={lockedReason ? "bg-slate-100 text-slate-700" : "bg-emerald-50 text-emerald-700"}>
              {lockedReason ? "Bloqueada" : response?.status === "draft" ? "Rascunho salvo" : "Em preenchimento"}
            </Badge>
          </div>
          <div>
            <CardTitle className="text-2xl">{quotation.name}</CardTitle>
            <div className="mt-2 grid gap-1 text-sm leading-6 text-muted-foreground md:grid-cols-2">
              <p>Cliente: {buyerName}</p>
              {isBidding ? (
                <p>Processo/Pregão: {quotation.processNumber ?? "-"} / {quotation.bidNumber ?? "-"}</p>
              ) : null}
              {quotation.notes ? <p className="md:col-span-2">Observação: {quotation.notes}</p> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <SellerResponseForm
            token={token}
            moduleType={moduleType}
            items={items}
            sellerDefaults={{
              name: session.sellerName,
              company: session.sellerCompany,
              whatsapp: session.sellerWhatsapp,
              email: session.sellerEmail,
            }}
            initialResponse={response}
            initialResponseItems={responseItems}
            lockedReason={lockedReason}
            buyerName={buyerName}
            quotationName={quotation.name}
            deadlineAt={quotation.deadlineAt}
          />
          <div className="flex items-start gap-3 rounded-md bg-slate-50 p-4 text-sm text-muted-foreground">
            <LockKeyhole className="mt-0.5 h-4 w-4 text-teal-700" />
            <p>
              Você só acessa esta cotação pelo token recebido. Outros fornecedores,
              rankings e preços concorrentes não são exibidos.
            </p>
          </div>
        </CardContent>
      </Card>
    </PublicShell>
  );
}

export async function PublicOrderPage({
  token,
  moduleType,
}: {
  token: string;
  moduleType: ModuleType;
}) {
  void moduleType;
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const isLocalRequest =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("[::1]");
  const useDemoOrder = shouldUseDemoData() || (isLocalRequest && isDemoPurchaseOrderToken(token));
  const order = useDemoOrder
    ? await demoRepository.getPurchaseOrderByToken(token)
    : await getPurchaseOrderByToken(token);

  if (!order) {
    return (
      <PublicShell>
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex gap-3 p-5 text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h1 className="font-semibold">Pedido não encontrado ou link expirado.</h1>
              <p className="mt-1 text-sm">
                Confirme se o link recebido está completo ou solicite um novo acesso à farmácia.
              </p>
            </div>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  const quotation = useDemoOrder
    ? await demoRepository.getQuotationById(order.quotationId)
    : await getQuotationById(order.quotationId);
  const collections = useDemoOrder
    ? await demoRepository.getCollections()
    : await getCollections();
  const tenant = collections.tenants.find((item) => item.id === order.tenantId);
  const pharmacy = collections.pharmacies.find((item) => item.id === quotation?.pharmacyId);
  const quoteItemsById = Object.fromEntries(
    collections.quotationItems
      .filter((item) => item.quotationId === quotation?.id)
      .map((item) => [item.id, { ean: item.ean, requestedLaboratory: item.requestedLaboratory }]),
  );
  const supplierCompany = getPurchaseOrderSupplierCompany(order);
  const supplierContact = getPurchaseOrderSupplierContact(order);

  return (
    <PublicShell>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge className="bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Pedido vencedor
              </Badge>
              <CardTitle className="mt-4 text-2xl">{pharmacy?.nomeFantasia ?? tenant?.nomeFantasia ?? "MBA Cotações"}</CardTitle>
              <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                <p>Cotação: {quotation?.name ?? "-"}</p>
                <p>Empresa vencedora: {supplierCompany}</p>
                {supplierContact ? <p>Vendedor: {supplierContact}</p> : null}
                {order.supplierWhatsapp ? <p>WhatsApp: {order.supplierWhatsapp}</p> : null}
                <p>Data de geração: {formatDate(order.generatedAt ?? new Date().toISOString())}</p>
                <p>Valor total previsto: {formatCurrency(order.totalAmount)}</p>
                {quotation?.notes ? <p>Observação da farmácia: {quotation.notes}</p> : null}
              </div>
            </div>
            <StatusBadge status={order.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <WinnerOrderForm initialOrder={order} quotationItemsById={quoteItemsById} />
          <Button asChild variant="outline">
            <Link href="/">
              Sair
            </Link>
          </Button>
        </CardContent>
      </Card>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="cotacoes-module min-h-screen bg-slate-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-sm font-bold text-white">
              MBA
            </span>
            <span>
              <span className="block font-semibold text-slate-950">MBA Cotações</span>
              <span className="block text-xs text-muted-foreground">Área do fornecedor</span>
            </span>
          </Link>
          <Badge variant="outline">Sem login</Badge>
        </div>
        {children}
      </div>
    </main>
  );
}

async function getDemoPublicData(token: string, moduleType: ModuleType): Promise<PublicQuoteData> {
  const data = await demoRepository.getPublicSession(token, moduleType);
  const collections = await demoRepository.getCollections();
  const response =
    token === "farmacia-demo-token"
      ? undefined
      : data.session?.status === "submitted"
      ? collections.supplierQuoteResponses.find((item) => item.sessionId === data.session?.id)
      : undefined;
  const responseItems = response
    ? collections.supplierQuoteResponseItems.filter((item) => item.responseId === response.id)
    : [];

  return {
    ...data,
    response,
    responseItems,
  };
}

function getLockedReason(
  session: SupplierQuoteSession,
  quotation: Quotation,
  response?: SupplierQuoteResponse,
) {
  if (session.status === "submitted" || response?.status === "submitted") {
    return "Resposta enviada com sucesso. A cotação está bloqueada para edição.";
  }

  if (session.status === "expired" || isExpired(session.expiresAt)) {
    return "Esta cotação expirou.";
  }

  if (session.status === "canceled" && quotation.status !== "canceled") {
    return "Este link foi revogado pela empresa compradora.";
  }

  if (quotation.status === "canceled") {
    return "Esta cotação foi cancelada pela empresa compradora.";
  }

  if (quotation.status === "finished") {
    return "Cotação finalizada. Não é mais possível enviar ou alterar respostas.";
  }

  return undefined;
}

function isAccessBlockedLock(reason?: string) {
  if (!reason) return false;
  return !reason.startsWith("Resposta enviada");
}

function isExpired(expiresAt?: string) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

function isDemoPurchaseOrderToken(token: string) {
  return (
    token.includes("demo-token") ||
    token.startsWith("farmacia-pedido") ||
    token.startsWith("licitacao-pedido") ||
    token.startsWith("pedido-pharmacy") ||
    token.startsWith("pedido-bidding")
  );
}
