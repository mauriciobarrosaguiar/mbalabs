"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PublicOrderActions } from "@/components/quotations/public-order-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrencyBRL, formatInteger } from "@/lib/formatters";
import { labelFrom, statusLabels } from "@/lib/labels";
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderItemFulfillmentStatus } from "@/lib/types";

const finalStatuses = new Set(["finalizado_pelo_vendedor", "parcialmente_faturado", "nao_faturado", "cancelado", "confirmed", "canceled"]);
type PersistAction = "save" | "finalize";

export function WinnerOrderForm({
  initialOrder,
  quotationItemsById,
}: {
  initialOrder: PurchaseOrder;
  quotationItemsById: Record<string, { ean?: string; requestedLaboratory?: string }>;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [items, setItems] = useState(() => initialOrder.items.map(normalizeItem));
  const [pendingAction, setPendingAction] = useState<PersistAction | null>(null);
  const savingRef = useRef(false);
  const locked = finalStatuses.has(order.status);
  const saving = pendingAction !== null;

  useEffect(() => {
    if (locked) return;
    void fetch(`/api/public-order/${order.publicToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open" }),
    }).catch(() => undefined);
  }, [locked, order.publicToken]);

  const totals = useMemo(() => {
    const billedItems = items.filter((item) => item.fulfillmentStatus === "faturado" && (item.missingQuantity ?? 0) <= 0);
    const partialItems = items.filter((item) => item.fulfillmentStatus === "parcial");
    const notBilledItems = items.filter((item) => item.fulfillmentStatus === "nao_faturado");
    return {
      billedItems: billedItems.length,
      partialItems: partialItems.length,
      notBilledItems: notBilledItems.length,
      billedAmount: items.reduce((total, item) => total + (item.billedQuantity ?? 0) * item.unitPrice, 0),
    };
  }, [items]);

  function updateItem(id: string, patch: Partial<PurchaseOrderItem>) {
    setItems((current) => current.map((item) => item.id === id ? normalizeItem({ ...item, ...patch }) : item));
  }

  function updateAllFulfillmentStatus(fulfillmentStatus: PurchaseOrderItemFulfillmentStatus) {
    setItems((current) => current.map((item) => normalizeItem({ ...item, fulfillmentStatus })));
  }

  async function persist(action: "save" | "finalize") {
    if (locked || savingRef.current) return;
    if (action === "finalize" && items.some((item) => item.fulfillmentStatus === "pendente")) {
      const confirmed = window.confirm("Existem itens pendentes. Deseja finalizar mesmo assim?");
      if (!confirmed) return;
    }

    savingRef.current = true;
    setPendingAction(action);
    try {
      const response = await fetch(`/api/public-order/${order.publicToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          items: items.map((item) => ({
            id: item.id,
            fulfillmentStatus: normalizeFulfillmentStatus(item.fulfillmentStatus),
            billedQuantity: item.billedQuantity ?? 0,
            vendorObservation: item.vendorObservation ?? "",
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error ??
            (action === "finalize"
              ? "Não foi possível finalizar o pedido. Verifique os itens e tente novamente."
              : "Não foi possível salvar a conferência do pedido. Verifique os itens e tente novamente."),
        );
      }
      if (!payload.order) {
        throw new Error("Pedido não encontrado ou link expirado.");
      }
      setOrder(payload.order);
      setItems(payload.order.items.map(normalizeItem));
      toast.success(
        action === "finalize"
          ? "Pedido finalizado com sucesso."
          : "Conferência salva com sucesso.",
      );
    } catch (error) {
      console.error("Erro ao atualizar pedido vencedor", error);
      toast.error(
        error instanceof Error
          ? error.message
          : action === "finalize"
          ? "Não foi possível finalizar o pedido. Verifique os itens e tente novamente."
          : "Não foi possível salvar a conferência do pedido. Verifique os itens e tente novamente.",
      );
    } finally {
      savingRef.current = false;
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-md bg-slate-50 p-4 md:grid-cols-6">
        <Summary label="Total de itens" value={String(items.length)} />
        <Summary label="Itens faturados" value={String(totals.billedItems)} />
        <Summary label="Itens parciais" value={String(totals.partialItems)} />
        <Summary label="Itens não faturados" value={String(totals.notBilledItems)} />
        <Summary label="Valor previsto" value={formatCurrencyBRL(order.totalAmount)} />
        <Summary label="Valor faturado" value={formatCurrencyBRL(totals.billedAmount)} />
      </div>

      {!locked ? (
        <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-950">Status de faturamento em massa</p>
            <p className="mt-1 text-xs text-muted-foreground">Atualiza todos os itens da tabela e preserva as observações.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" disabled={saving} onClick={() => updateAllFulfillmentStatus("faturado")}>
              <CheckCircle2 className="h-4 w-4" />
              Marcar todos como Faturado
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => updateAllFulfillmentStatus("parcial")}>
              <RotateCcw className="h-4 w-4" />
              Marcar todos como Parcial
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => updateAllFulfillmentStatus("nao_faturado")}>
              <XCircle className="h-4 w-4" />
              Marcar todos como Não faturado
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => updateAllFulfillmentStatus("pendente")}>
              <RotateCcw className="h-4 w-4" />
              Marcar todos como Pendente
            </Button>
          </div>
        </div>
      ) : null}

      <div className="hidden rounded-md border border-slate-200 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cód.</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Laboratório solicitado</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Qtd faturada</TableHead>
              <TableHead>Qtd faltante</TableHead>
              <TableHead className="text-right">Preço unitário</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status faturamento</TableHead>
              <TableHead>Observação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const quoteItem = quotationItemsById[item.quotationItemId];
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                  <TableCell className="font-medium">
                    {item.productName}
                    {quoteItem?.ean ? <span className="mt-1 block text-xs text-muted-foreground">EAN em detalhes: {quoteItem.ean}</span> : null}
                  </TableCell>
                  <TableCell>{quoteItem?.requestedLaboratory ?? item.laboratory ?? "Qualquer"}</TableCell>
                  <TableCell>{formatInteger(item.quantityToBuy)} {item.unit}</TableCell>
                  <TableCell>
                    <QuantityInput
                      value={item.billedQuantity ?? 0}
                      max={item.quantityToBuy}
                      disabled={locked || saving || item.fulfillmentStatus !== "parcial"}
                      onChange={(billedQuantity) => updateItem(item.id, { billedQuantity })}
                    />
                  </TableCell>
                  <TableCell>{formatInteger(item.missingQuantity ?? 0)} {item.unit}</TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyBRL(item.totalPrice)}</TableCell>
                  <TableCell>
                    <FulfillmentSelect value={item.fulfillmentStatus} disabled={locked || saving} onChange={(value) => updateItem(item.id, { fulfillmentStatus: value })} />
                  </TableCell>
                  <TableCell>
                    <Textarea
                      value={item.vendorObservation ?? ""}
                      disabled={locked || saving}
                      onChange={(event) => updateItem(item.id, { vendorObservation: event.target.value })}
                      className="min-h-16"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {items.map((item, index) => {
          const quoteItem = quotationItemsById[item.quotationItemId];
          return (
            <div key={item.id} className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
              <div>
                <p className="text-xs text-muted-foreground">Item {index + 1}</p>
                <h3 className="font-semibold text-slate-950">{item.productName}</h3>
                <p className="text-sm text-muted-foreground">{formatInteger(item.quantityToBuy)} {item.unit} · {formatCurrencyBRL(item.totalPrice)}</p>
                <p className="text-sm text-muted-foreground">
                  Faturado: {formatInteger(item.billedQuantity ?? 0)} {item.unit} · Falta: {formatInteger(item.missingQuantity ?? 0)} {item.unit}
                </p>
                <p className="text-sm text-muted-foreground">Lab.: {quoteItem?.requestedLaboratory ?? item.laboratory ?? "Qualquer"}</p>
              </div>
              <div className="space-y-2">
                <Label>Status faturamento</Label>
                <FulfillmentSelect value={item.fulfillmentStatus} disabled={locked || saving} onChange={(value) => updateItem(item.id, { fulfillmentStatus: value })} />
              </div>
              <div className="space-y-2">
                <Label>Qtd faturada</Label>
                <QuantityInput
                  value={item.billedQuantity ?? 0}
                  max={item.quantityToBuy}
                  disabled={locked || saving || item.fulfillmentStatus !== "parcial"}
                  onChange={(billedQuantity) => updateItem(item.id, { billedQuantity })}
                />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea value={item.vendorObservation ?? ""} disabled={locked || saving} onChange={(event) => updateItem(item.id, { vendorObservation: event.target.value })} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Status atual: <span className="font-medium text-slate-950">{labelFrom(statusLabels, order.status)}</span>
          </p>
          {locked ? <p className="text-emerald-700">Pedido já finalizado. Alterações bloqueadas.</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <PublicOrderActions order={{ ...order, items }} />
          <Button type="button" variant="outline" disabled={locked || saving} onClick={() => void persist("save")}>
            {pendingAction === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {pendingAction === "save" ? "Salvando..." : "Salvar conferência"}
          </Button>
          <Button type="button" disabled={locked || saving} onClick={() => void persist("finalize")}>
            {pendingAction === "finalize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {pendingAction === "finalize" ? "Finalizando..." : "Finalizar pedido"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FulfillmentSelect({
  value,
  disabled,
  onChange,
}: {
  value?: PurchaseOrderItemFulfillmentStatus;
  disabled?: boolean;
  onChange: (value: PurchaseOrderItemFulfillmentStatus) => void;
}) {
  return (
    <Select value={normalizeFulfillmentStatus(value)} disabled={disabled} onValueChange={(next) => onChange(normalizeFulfillmentStatus(next))}>
      <SelectTrigger className="min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pendente">Pendente</SelectItem>
        <SelectItem value="faturado">Faturado</SelectItem>
        <SelectItem value="parcial">Parcial</SelectItem>
        <SelectItem value="nao_faturado">Não faturado</SelectItem>
      </SelectContent>
    </Select>
  );
}

function QuantityInput({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      max={max}
      step="1"
      value={Number.isFinite(value) ? value : 0}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-32"
    />
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function normalizeItem(item: PurchaseOrderItem): PurchaseOrderItem {
  const fulfillmentStatus = normalizeFulfillmentStatus(item.fulfillmentStatus);
  const billedQuantity = normalizeBilledQuantity(item.quantityToBuy, fulfillmentStatus, item.billedQuantity);
  return {
    ...item,
    fulfillmentStatus,
    billedQuantity,
    missingQuantity: Math.max(0, item.quantityToBuy - billedQuantity),
    vendorObservation: item.vendorObservation ?? "",
  };
}

function normalizeFulfillmentStatus(value: unknown): PurchaseOrderItemFulfillmentStatus {
  if (value === "faturado" || value === "parcial" || value === "nao_faturado" || value === "pendente") {
    return value;
  }
  if (value === "a_faturar") return "pendente";
  return "pendente";
}

function normalizeBilledQuantity(
  requestedQuantity: number,
  status: PurchaseOrderItemFulfillmentStatus,
  value?: number,
) {
  if (status === "faturado") return requestedQuantity;
  if (status === "nao_faturado" || status === "pendente") return 0;
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), requestedQuantity);
}
