"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Input } from "@/modules/cotacoes/components/ui/input";
import { formatCurrency } from "@/modules/cotacoes/lib/formatters";
import type { PurchaseOrder, PurchaseOrderItem } from "@/modules/cotacoes/lib/types";

type Props = { order: PurchaseOrder };
type ItemEdit = { quantity: string; note: string; supplierConfirmationNote: string };

export function BuyerOrderReview({ order }: Props) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, ItemEdit>>(() =>
    Object.fromEntries(order.items.map((item) => [item.id, {
      quantity: String(item.quantityToBuy),
      note: item.buyerChangeNote ?? "",
      supplierConfirmationNote: item.supplierConfirmationNote ?? "",
    }])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [minimumOrderChecked, setMinimumOrderChecked] = useState(false);
  const isPending = order.buyerReviewStatus === "pending";

  function patch(id: string, update: Partial<ItemEdit>) {
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...update } }));
  }

  async function callReview(method: "PATCH" | "POST", payload: Record<string, unknown>) {
    const response = await fetch(`/api/cotacoes/purchase-orders/${order.quotationId}/review`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, ...payload }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Não foi possível revisar o pedido.");
    return result;
  }

  async function saveItem(item: PurchaseOrderItem) {
    const edit = edits[item.id];
    const quantity = Number(edit.quantity.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity < 0) { toast.error("Informe uma quantidade válida."); return; }
    setBusy(item.id);
    try {
      const result = await callReview("PATCH", {
        itemId: item.id,
        quantity,
        note: edit.note,
        supplierConfirmationNote: edit.supplierConfirmationNote,
      });
      toast.success(String(result.message ?? "Quantidade atualizada."));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar o produto.");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    const dirty = order.items.some((item) => {
      const current = edits[item.id];
      return Number(current.quantity.replace(",", ".")) !== item.quantityToBuy ||
        (current.supplierConfirmationNote.trim() !== (item.supplierConfirmationNote ?? "")) ||
        (current.note.trim() !== (item.buyerChangeNote ?? ""));
    });
    if (dirty) { toast.warning("Existem alterações não salvas. Salve cada produto antes de aprovar."); return; }
    if (!window.confirm("Aprovar este pedido com as quantidades revisadas? Após aprovar, não será possível editar os itens.")) return;
    setBusy("approve");
    try {
      const result = await callReview("POST", { minimumOrderChecked });
      toast.success(String(result.message ?? "Pedido aprovado."));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível aprovar o pedido.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!window.confirm("Enviar agora este pedido aprovado ao representante ou à distribuidora pelo WhatsApp?")) return;
    setBusy("send");
    try {
      const response = await fetch("/api/whatsapp-envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_winner_orders", quotationId: order.quotationId, orderId: order.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível transmitir o pedido.");
      if (Number(result.whatsapp?.enviado ?? 0) > 0) {
        toast.success("Pedido enviado ao representante pelo WhatsApp.");
      } else {
        toast.warning("O WhatsApp não confirmou a entrega. Use as opções manuais do link do pedido.");
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o pedido.");
    } finally {
      setBusy(null);
    }
  }

  const totalDraft = order.items.reduce((sum, item) => {
    const raw = edits[item.id]?.quantity ?? String(item.quantityToBuy);
    const quantity = Number(raw.replace(",", "."));
    return sum + (Number.isFinite(quantity) && quantity >= 0 ? quantity * item.unitPrice : 0);
  }, 0);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold text-slate-950">{isPending ? "Revisar quantidades antes do envio" : "Pedido aprovado pelo comprador"}</h3>
          <p className="text-xs text-slate-600">
            {isPending
              ? "A cotação original não será alterada. Salve cada linha, confira o total e aprove o pedido."
              : "Alterações bloqueadas após aprovação. O envio ao vendedor é uma ação separada."}
          </p>
        </div>
        <p className="text-sm font-semibold">Total {formatCurrency(totalDraft)}</p>
      </div>

      {isPending ? order.items.map((item) => {
        const edit = edits[item.id];
        const quantity = Number(edit.quantity.replace(",", "."));
        const initial = item.initialQuantityToBuy ?? item.quantityToBuy;
        const increased = Number.isFinite(quantity) && quantity > initial;
        const changed = Number.isFinite(quantity) && quantity !== item.quantityToBuy;
        return (
          <div key={item.id} className="space-y-2 rounded-md border bg-white p-3">
            <div className="font-medium text-sm">{item.productName}</div>
            <p className="text-xs text-slate-600">Cotado: {initial} {item.unit} · Valor unitário: {formatCurrency(item.unitPrice)} · Atual: {item.quantityToBuy}</p>
            <label className="block space-y-1 text-sm">
              <span>Quantidade do pedido (use 0 para retirar o item)</span>
              <Input type="number" min="0" step="1" value={edit.quantity}
                onChange={(event) => patch(item.id, { quantity: event.target.value })} />
            </label>
            {changed ? (
              <label className="block space-y-1 text-sm">
                <span>Motivo da alteração</span>
                <Input value={edit.note} placeholder="Ex.: ajuste de necessidade da loja"
                  onChange={(event) => patch(item.id, { note: event.target.value })} />
              </label>
            ) : null}
            {increased ? (
              <label className="block space-y-1 text-sm text-amber-900">
                <span>Confirmação do representante sobre estoque e preço (obrigatório)</span>
                <Input value={edit.supplierConfirmationNote}
                  placeholder="Ex.: Representante confirmou 150 caixas ao preço cotado"
                  onChange={(event) => patch(item.id, { supplierConfirmationNote: event.target.value })} />
                <span className="block text-xs">O comprador registra a confirmação recebida; o sistema não consulta o estoque em tempo real.</span>
              </label>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">Subtotal estimado: {formatCurrency((Number.isFinite(quantity) ? quantity : 0) * item.unitPrice)}</span>
              <Button type="button" variant="outline" disabled={Boolean(busy)}
                onClick={() => void saveItem(item)}>{busy === item.id ? "Salvando..." : "Salvar quantidade"}</Button>
            </div>
          </div>
        );
      }) : (
        <p className="text-sm text-slate-600">O pedido está pronto para o envio, sem alteração das propostas recebidas na cotação.</p>
      )}
      {isPending && order.items.some((item) => Number((edits[item.id]?.quantity ?? item.quantityToBuy).toString().replace(",", ".")) < (item.initialQuantityToBuy ?? item.quantityToBuy)) ? (
        <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" checked={minimumOrderChecked} onChange={(e) => setMinimumOrderChecked(e.target.checked)} />
          <span>Verifiquei com a distribuidora/representante o pedido mínimo, frete e descontos após reduzir as quantidades.</span>
        </label>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {isPending ? (
          <Button type="button" disabled={Boolean(busy)} onClick={() => void approve()}>
            {busy === "approve" ? "Aprovando..." : "Aprovar pedido revisado"}
          </Button>
        ) : (
          <Button type="button" disabled={Boolean(busy)} onClick={() => void send()}>
            {busy === "send" ? "Enviando..." : "Enviar pedido por WhatsApp"}
          </Button>
        )}
      </div>
    </div>
  );
}
