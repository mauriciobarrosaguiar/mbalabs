import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/modules/cotacoes/components/layout/app-shell";
import { StatusBadge } from "@/modules/cotacoes/components/dashboard/status-badge";
import { SupplierLinksTable } from "@/modules/cotacoes/components/quotations/supplier-links-table";
import { WinnerOrderLinks } from "@/modules/cotacoes/components/quotations/winner-order-links";
import { QuotationPageActions } from "@/modules/cotacoes/components/quotations/quotation-page-actions";
import {
  CreateMissingQuotationButton,
  WinnerPendingActions,
} from "@/modules/cotacoes/components/quotations/winner-pending-actions";
import { CompanyRoutePage } from "@/modules/cotacoes/components/dashboard/pages";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/cotacoes/components/ui/table";
import { getUnitLabel, productTypeLabels } from "@/modules/cotacoes/lib/constants";
import { formatCurrency, formatInteger } from "@/modules/cotacoes/lib/formatters";
import {
  getPurchaseOrdersByQuotation,
  getQuotationBundle,
  getSupplierSessions,
  getWinnerOrderPendingItems,
} from "@/modules/cotacoes/lib/data/repository";
import {
  canGenerateQuotationOrders,
  isQuotationClosed,
} from "@/modules/cotacoes/lib/quotation-status";
import {
  canAccessModule,
  requireCompanyAccess,
} from "@/modules/cotacoes/lib/auth/session";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  QuotationItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
} from "@/modules/cotacoes/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageParams = {
  id: string;
};

export default async function PharmacyQuotationDetailRoute({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { id } = await params;
  const path = `/cotacoes/cotacoes-farmacia/${id}`;
  const auth = await requireCompanyAccess(path);
  const blockedByTenant =
    Boolean(auth && !auth.isSuperAdmin) &&
    !canAccessModule(auth.tenantAccess?.tenantType, "pharmacy");
  const slug = blockedByTenant ? ["sem-permissao"] : ["cotacoes-farmacia", id];

  return (
    <AppShell
      mode="app"
      currentPath={path}
      title={blockedByTenant ? "Sem permissão" : id === "nova" ? "Nova cotação" : "Detalhes da cotação"}
      subtitle={auth.tenantAccess?.tenantName ?? "Painel da empresa"}
      profileRole={auth.profile.role}
      tenantType={auth.tenantAccess?.tenantType}
      tenantName={auth.tenantAccess?.tenantName}
    >
      {blockedByTenant || id === "nova" ? (
        <CompanyRoutePage
          slug={slug}
          tenantType={auth.tenantAccess?.tenantType}
          tenantId={auth.tenantAccess?.tenantId}
        />
      ) : (
        <PharmacyQuotationDetail quotationId={id} tenantId={auth.tenantAccess?.tenantId} />
      )}
    </AppShell>
  );
}

async function PharmacyQuotationDetail({ quotationId, tenantId }: { quotationId: string; tenantId?: string }) {
  const [{ quotation, items, responses, responseItems }, sessions, orders, pendencies] = await Promise.all([
    getQuotationBundle(quotationId, tenantId),
    getSupplierSessions(quotationId, tenantId),
    getPurchaseOrdersByQuotation(quotationId, tenantId),
    getWinnerOrderPendingItems(quotationId).catch(() => []),
  ]);

  if (quotation.moduleType !== "pharmacy") notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-normal text-slate-950">{quotation.name}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {quotation.notes ?? "Detalhes da cotação"}
          </p>
        </div>
      </div>

      <QuotationPageActions
        quotationId={quotation.id}
        moduleType="pharmacy"
        status={quotation.status}
        currentPage="detail"
      />

      <div className="flex flex-wrap gap-2">
        {!isQuotationClosed(quotation.status) ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/cotacoes/cotacoes-farmacia/${quotation.id}/editar`}>Editar</Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle>Itens solicitados</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ItemsTable
            items={items}
            orders={orders}
            responses={responses}
            responseItems={responseItems}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Links dos fornecedores</CardTitle></CardHeader>
        <CardContent className="p-0">
          <SupplierLinksTable moduleType="pharmacy" sessions={sessions} deadlineAt={quotation.deadlineAt} />
        </CardContent>
      </Card>

      {canGenerateQuotationOrders(quotation.status) ? (
        <Card>
          <CardHeader><CardTitle>Links dos vendedores vencedores</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido gerado ainda. Use Gerar pedido para criar os links dos vencedores.
              </p>
            ) : orders.map((order) => (
              <div key={order.id} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{order.supplierName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{order.supplierWhatsapp ?? "WhatsApp não informado"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.items.length} itens ganhos · {formatCurrency(order.totalAmount)}
                    </p>
                  </div>
                  <WinnerOrderLinks order={order} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canGenerateQuotationOrders(quotation.status) && pendencies.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Produtos com falta</CardTitle>
              <CreateMissingQuotationButton
                quotationId={quotation.id}
                moduleType="pharmacy"
                pendingIds={pendencies.filter((pending) => pending.status === "pendente").map((pending) => pending.id)}
                disabled={!pendencies.some((pending) => pending.status === "pendente")}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendencies.map((pending) => (
              <div key={pending.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{pending.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      Solicitado: {formatInteger(pending.requestedQuantity ?? pending.quantity)} · Faturado: {formatInteger(pending.billedQuantity ?? 0)} · Falta: {formatInteger(pending.quantity)} {getUnitLabel(pending.unit)}
                    </p>
                  </div>
                  <WinnerPendingActions
                    quotationId={quotation.id}
                    pendingId={pending.id}
                    moduleType="pharmacy"
                    disabled={pending.status !== "pendente"}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ItemsTable({
  items,
  orders,
  responses,
  responseItems,
}: {
  items: QuotationItem[];
  orders: PurchaseOrder[];
  responses: SupplierQuoteResponse[];
  responseItems: SupplierQuoteResponseItem[];
}) {
  const submittedResponseIds = new Set(
    responses
      .filter((response) => response.status === "submitted")
      .map((response) => response.id),
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Produto</TableHead>
          <TableHead>Quantidade</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Laboratório</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const displayStatus = getQuotationItemDisplayStatus({
            item,
            orders,
            responseItems,
            submittedResponseIds,
          });

          return (
            <TableRow key={item.id}>
              <TableCell>{item.itemNumber}</TableCell>
              <TableCell className="font-medium">{item.productName}</TableCell>
              <TableCell>{formatInteger(item.requestedQuantity)}</TableCell>
              <TableCell>{getUnitLabel(item.requestedUnit)}</TableCell>
              <TableCell>{item.requestedLaboratory ?? "-"}</TableCell>
              <TableCell>{productTypeLabels[item.productType]}</TableCell>
              <TableCell>
                <StatusBadge status={displayStatus.status} label={displayStatus.label} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function getQuotationItemDisplayStatus({
  item,
  orders,
  responseItems,
  submittedResponseIds,
}: {
  item: QuotationItem;
  orders: PurchaseOrder[];
  responseItems: SupplierQuoteResponseItem[];
  submittedResponseIds: Set<string>;
}) {
  const orderEntries = orders
    .flatMap((order) =>
      order.items
        .filter((orderItem) => orderItem.quotationItemId === item.id)
        .map((orderItem) => ({ order, orderItem })),
    )
    .filter(({ order }) => order.status !== "cancelado" && order.status !== "canceled");

  if (orderEntries.length > 0) {
    const finishedEntry = orderEntries.find(({ order }) =>
      ["finalizado_pelo_vendedor", "parcialmente_faturado", "nao_faturado", "confirmed"].includes(order.status),
    );
    const { order, orderItem } = finishedEntry ?? orderEntries[0];
    const billedQuantity = getOrderItemBilledQuantity(orderItem);
    const missingQuantity = getOrderItemMissingQuantity(orderItem);

    if (orderItem.fulfillmentStatus === "faturado" || (billedQuantity > 0 && missingQuantity <= 0)) {
      return { status: "paid", label: "Faturado" };
    }

    if (orderItem.fulfillmentStatus === "parcial" || (billedQuantity > 0 && missingQuantity > 0)) {
      return { status: "falta_parcial", label: "Parcial" };
    }

    if (orderItem.fulfillmentStatus === "nao_faturado" || order.status === "nao_faturado") {
      return { status: "nao_faturado", label: "Não faturado" };
    }

    if (["finalizado_pelo_vendedor", "parcialmente_faturado", "confirmed"].includes(order.status)) {
      return { status: "nao_faturado", label: "Não faturado" };
    }

    return { status: "gerado", label: "Pedido gerado" };
  }

  const hasSubmittedResponse = responseItems.some(
    (responseItem) =>
      responseItem.quotationItemId === item.id &&
      submittedResponseIds.has(responseItem.responseId),
  );

  if (hasSubmittedResponse) {
    return { status: "submitted", label: "Respondido" };
  }

  return { status: "waiting_responses", label: "Aguardando respostas" };
}

function getOrderItemBilledQuantity(item: PurchaseOrderItem) {
  if (item.fulfillmentStatus === "faturado") return item.quantityToBuy;
  if (item.fulfillmentStatus === "nao_faturado" || item.fulfillmentStatus === "pendente") return 0;
  const numeric = Number(item.billedQuantity ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), item.quantityToBuy);
}

function getOrderItemMissingQuantity(item: PurchaseOrderItem) {
  const storedMissing = Number(item.missingQuantity);
  if (Number.isFinite(storedMissing)) return Math.max(0, storedMissing);
  return Math.max(0, item.quantityToBuy - getOrderItemBilledQuantity(item));
}
