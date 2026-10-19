"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Input } from "@/modules/cotacoes/components/ui/input";
import { formatCurrency } from "@/modules/cotacoes/lib/formatters";
import {
  calculateMinimumOrderShortfalls,
  type MinimumOrderRule,
} from "@/modules/cotacoes/lib/services/minimum-order";
import type { PurchaseOrder } from "@/modules/cotacoes/lib/types";

type ItemEdit = { orderId: string; itemId: string; quantity: string; note: string };
type MinimumConfirmation = { confirmed: boolean; reason: string };
type Props = {
  quotationId: string;
  orders: PurchaseOrder[];
  minimumEnabled: boolean;
  minimumRules: MinimumOrderRule[];
};

const editingEnabled = (order: PurchaseOrder) =>
  order.buyerReviewStatus === "pending" &&
  !order.buyerSentAt &&
  ["gerado","draft"].includes(order.status);

export function BulkBuyerOrderReview({
  quotationId, orders, minimumEnabled, minimumRules,
}: Props) {
  const router = useRouter();
  const pendingOrders = useMemo(() => orders.filter(editingEnabled), [orders]);
  const [edits, setEdits] = useState<Record<string, ItemEdit>>(() =>
    Object.fromEntries(pendingOrders.flatMap((order) => order.items.map((item) => [
      item.id,
      {
        orderId: order.id, itemId: item.id,
        quantity: String(item.quantityToBuy),
        note: item.buyerChangeNote ?? "",
      },
    ]))),
  );
  const [busy, setBusy] = useState<"save" | "approve_send" | null>(null);
  const [queued, setQueued] = useState(false);
  const [minimumConfirmations, setMinimumConfirmations] = useState<Record<string, MinimumConfirmation>>({});
  const editableRules = minimumRules.filter((rule) =>
    pendingOrders.some((order) => order.id === rule.orderId));
  const quantityChanges = Object.fromEntries(
    Object.values(edits).map((edit) => [edit.itemId, edit.quantity]),
  );
  const minimumShortfalls = minimumEnabled
    ? calculateMinimumOrderShortfalls(pendingOrders, editableRules, quantityChanges)
    : [];
  const unlinkedItems = minimumEnabled
    ? pendingOrders.flatMap((order) => order.items).filter((item) => !item.distributorId).length
    : 0;

  const items = pendingOrders.flatMap((order) => order.items);
  const totals = pendingOrders.map((order) => ({
    id: order.id,
    amount: order.items.reduce((total, item) => {
      const raw = edits[item.id]?.quantity ?? String(item.quantityToBuy);
      const n = Number(raw.replace(",", "."));
      return total + (Number.isFinite(n) && n > 0 ? n * item.unitPrice : 0);
    }, 0),
  }));
  const grandTotal = totals.reduce((sum, row) => sum + row.amount, 0);
  const changes = items.filter((item) => {
    const edit = edits[item.id];
    return edit && (Number(edit.quantity.replace(",", ".")) !== item.quantityToBuy ||
      (edit.note.trim() !== (item.buyerChangeNote ?? "")));
  });
  const increased = items.some((item) =>
    Number((edits[item.id]?.quantity ?? item.quantityToBuy).toString().replace(",", ".")) >
    (item.initialQuantityToBuy ?? item.quantityToBuy),
  );

  function update(id: string, field: "quantity" | "note", value: string) {
    setEdits((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  }

  async function submit(action: "save" | "approve_send") {
    if (busy || pendingOrders.length === 0) return;
    const payload = items.map((item) => {
      const edit = edits[item.id];
      return {
        orderId: edit?.orderId,
        itemId: item.id,
        quantity: Number((edit?.quantity ?? "").replace(",", ".")),
        note: edit?.note ?? "",
      };
    });
    const invalid = payload.some((item) => !Number.isFinite(item.quantity) ||
      item.quantity < 0 || item.quantity > 1000000 ||
      Math.round(item.quantity * 1000) / 1000 !== item.quantity);
    if (invalid) {
      toast.error("Confira as quantidades: use valores de 0 até 1.000.000 e no máximo três casas decimais.");
      return;
    }
    for (const order of pendingOrders) {
      if (!order.items.some((item) =>
        payload.some((p) => p.itemId === item.id && p.quantity > 0))) {
        toast.error("Um dos representantes ficaria com um pedido vazio. Mantenha pelo menos um item positivo.");
        return;
      }
    }
    const minimumExceptions = action === "approve_send"
      ? minimumShortfalls.map((shortfall) => {
        const confirmation = minimumConfirmations[`${shortfall.orderId}:${shortfall.distributorId}`];
        return {
          orderId: shortfall.orderId,
          distributorId: shortfall.distributorId,
          confirmed: confirmation?.confirmed === true,
          reason: confirmation?.reason?.trim() ?? "",
        };
      }) : [];
    if (action === "approve_send" && minimumExceptions.some((exception) =>
      !exception.confirmed || exception.reason.length < 10 || exception.reason.length > 500)) {
      toast.error("Confirme cada pedido abaixo do mínimo e explique a exceção (10 a 500 caracteres).");
      return;
    }
    if (action === "approve_send" && !window.confirm(
      `Aprovar todos os ${pendingOrders.length} pedidos vencedores? ${minimumExceptions.length
        ? `Você autorizou ${minimumExceptions.length} exceção(ões) de pedido mínimo, registradas para auditoria. `
        : ""}Os pedidos serão enviados automaticamente pelo WhatsApp da farmácia. Após aprovar, as quantidades não poderão mais ser editadas.`
    )) return;
    setBusy(action);
    try {
      const response = await fetch(`/api/cotacoes/purchase-orders/${quotationId}/bulk-review`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, items: payload, minimumExceptions }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Erro ao revisar pedidos.");
      if (action === "approve_send") {
        setQueued(true);
        toast.success("Todos os pedidos foram aprovados. Envio automático iniciado.");
        toast.info("O status de cada envio aparecerá nesta página. Se o WhatsApp estiver desconectado, o pedido permanece aprovado para reenvio.");
      } else toast.success("Todas as quantidades foram salvas em uma única operação.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível revisar os pedidos.");
    } finally {
      setBusy(null);
    }
  }

  if (pendingOrders.length === 0) {
    return (
      <div className="rounded-xl border border-teal-200 bg-white p-5 text-sm text-slate-800">
        <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-teal-700" />
          Não há pedidos pendentes de aprovação.
        </p>
        <p className="mt-2 text-slate-600">
          Os pedidos aprovados são enviados automaticamente quando a conexão WhatsApp da farmácia está disponível.
          Verifique o histórico de envio de cada representante abaixo; uma falha não deve ser tratada como pedido enviado.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border-2 border-teal-300 bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-950">Revisão conjunta dos vencedores</h2>
          <p className="text-sm text-slate-700">
            Confira e altere todos os pedidos nesta tela. Você pode aumentar ou diminuir as quantidades.
            Os preços unitários das propostas originais não são alterados.
          </p>
        </div>
        <div className="rounded-lg bg-teal-50 px-4 py-3">
          <p className="text-xs text-teal-900">Total geral dos {pendingOrders.length} pedidos</p>
          <p className="text-xl font-bold text-teal-950">{formatCurrency(grandTotal)}</p>
        </div>
      </div>
      {increased ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Algumas quantidades foram aumentadas em relação às propostas. Nenhuma confirmação prévia
          do representante é exigida. Os valores são calculados pelo preço unitário cotado,
          mas a disponibilidade do estoque e as condições comerciais precisarão ser verificadas pelo destinatário.
        </p>
      ) : null}

      {pendingOrders.map((order) => {
        const amount = totals.find((row) => row.id === order.id)?.amount ?? 0;
        return (
          <div key={order.id} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {order.supplierCompany || order.supplierName || "Representante"}
                  {order.supplierContactName ? ` — ${order.supplierContactName}` : ""}
                </h3>
                <p className="text-xs text-slate-600">
                  {order.supplierWhatsapp || "Sem WhatsApp informado"} · {order.items.length} itens
                </p>
              </div>
              <p className="font-semibold text-slate-950">{formatCurrency(amount)}</p>
            </div>
            <div className="space-y-3">
              {order.items.map((item) => {
                const edit = edits[item.id];
                if (!edit) return null;
                return (
                  <div key={item.id} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 lg:grid-cols-[minmax(0,1fr)_140px_210px] lg:items-end">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-950">{item.productName}</p>
                      <p className="text-xs text-slate-600">
                        Original: {item.initialQuantityToBuy ?? item.quantityToBuy} {item.unit}
                        {" · "}Preço unitário: {formatCurrency(item.unitPrice)}
                      </p>
                      <label className="block space-y-1">
                        <span className="text-xs text-slate-700">Observação para a alteração (opcional)</span>
                        <Input value={edit.note} maxLength={500} disabled={Boolean(busy)}
                          placeholder="Ex.: ajustar para necessidade da loja"
                          onChange={(e) => update(item.id, "note", e.target.value)} />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-xs font-medium text-slate-900">Qtde. a comprar</span>
                      <Input type="number" min="0" max="1000000" step="1"
                        value={edit.quantity} disabled={Boolean(busy)}
                        onChange={(e) => update(item.id, "quantity", e.target.value)} />
                    </label>
                    <div className="text-sm">
                      <span className="text-xs text-slate-600">Subtotal revisado</span>
                      <p className="font-semibold text-slate-950">
                        {formatCurrency(Number(edit.quantity.replace(",", ".")) * item.unitPrice || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {minimumEnabled && unlinkedItems > 0 ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Atenção: {unlinkedItems} produto(s) ainda não possuem distribuidora identificada.
          Não é possível calcular automaticamente um pedido mínimo para esses itens.
          Identifique a distribuidora no cadastro da resposta para validar essa condição comercial.
        </p>
      ) : null}
      {minimumEnabled && minimumShortfalls.length > 0 ? (
        <div className="space-y-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
          <h3 className="text-base font-bold text-amber-950">
            Pedido mínimo abaixo do exigido — confirmação excepcional
          </h3>
          <p className="text-sm text-amber-900">
            Estas exceções não garantem que a distribuidora aceite o pedido. A aprovação
            registra quem autorizou, o valor aprovado, o mínimo cadastrado e a justificativa.
            Sem todas as confirmações, nenhum pedido será aprovado.
          </p>
          {minimumShortfalls.map((shortfall) => {
            const key = `${shortfall.orderId}:${shortfall.distributorId}`;
            const confirmation = minimumConfirmations[key] ?? { confirmed: false, reason: "" };
            const order = pendingOrders.find((candidate) => candidate.id === shortfall.orderId);
            return (
              <div key={key} className="space-y-3 rounded-lg border border-amber-300 bg-white p-3">
                <p className="font-semibold text-slate-950">
                  {shortfall.distributorName} — {order?.supplierName ?? "Representante"}
                </p>
                <div className="grid gap-2 text-sm sm:grid-cols-3">
                  <p>Pedido: <strong>{formatCurrency(shortfall.amount)}</strong></p>
                  <p>Mínimo: <strong>{formatCurrency(shortfall.minimum)}</strong></p>
                  <p className="text-amber-900">Diferença: <strong>{formatCurrency(shortfall.shortfall)}</strong></p>
                </div>
                <label className="flex items-start gap-2 text-sm font-medium text-slate-900">
                  <input
                    type="checkbox" className="mt-0.5 size-4 accent-teal-700"
                    checked={confirmation.confirmed} disabled={Boolean(busy)}
                    onChange={(event) => setMinimumConfirmations((current) => ({
                      ...current, [key]: { ...confirmation, confirmed: event.target.checked },
                    }))}
                  />
                  Confirmo excepcionalmente o pedido abaixo do mínimo desta distribuidora
                </label>
                <label className="block space-y-1 text-sm font-medium text-slate-900">
                  <span>Justificativa obrigatória (10 a 500 caracteres)</span>
                  <Input
                    value={confirmation.reason} maxLength={500} disabled={Boolean(busy)}
                    placeholder="Ex.: distribuidora autorizou exceção comercial por telefone"
                    onChange={(event) => setMinimumConfirmations((current) => ({
                      ...current, [key]: { ...confirmation, reason: event.target.value },
                    }))}
                  />
                </label>
              </div>
            );
          })}
        </div>
      ) : minimumEnabled && editableRules.length > 0 ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Os mínimos das distribuidoras identificadas estão atendidos nas quantidades atuais.
          O servidor fará uma nova verificação na aprovação.
        </p>
      ) : null}

      {queued ? (
        <p role="status" className="rounded-md bg-teal-50 p-3 text-sm font-medium text-teal-950">
          Aprovação registrada. Os envios estão sendo processados. Consulte os resultados por representante abaixo.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-slate-700">
          {changes.length} alteração(ões) nesta revisão · {items.length} produtos ·
          {" "}{formatCurrency(grandTotal)} ao todo
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={Boolean(busy) || queued}
            onClick={() => void submit("save")}>
            {busy === "save" && <Loader2 className="size-4 animate-spin" />}
            {busy === "save" ? "Salvando todos..." : "Salvar todas as quantidades"}
          </Button>
          <Button type="button" disabled={Boolean(busy) || queued}
            onClick={() => void submit("approve_send")}>
            {busy === "approve_send" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {busy === "approve_send" ? "Aprovando..." : "Aprovar e enviar todos os pedidos"}
          </Button>
        </div>
      </div>
    </section>
  );
}
