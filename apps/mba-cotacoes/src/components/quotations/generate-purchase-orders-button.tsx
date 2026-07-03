"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type WhatsappSummary = { enviado?: number; falhou?: number };

export function GeneratePurchaseOrdersButton({
  quotationId,
  disabled,
}: {
  quotationId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function generateOrders() {
    setLoading(true);
    try {
      const response = await fetch(`/api/purchase-orders/${quotationId}`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível gerar os pedidos.");
      }

      const count = Array.isArray(payload.orders) ? payload.orders.length : 0;
      toast.success(
        count > 0
          ? "Pedidos gerados com sucesso."
          : "Nenhum pedido foi gerado.",
      );

      if (count > 0) {
        const whatsapp = await notifyWinners(quotationId);
        if (whatsapp?.falhou) {
          toast.warning(`${whatsapp.falhou} envio(s) de WhatsApp falharam.`);
        } else if (whatsapp?.enviado) {
          toast.success("Links dos pedidos enviados aos vendedores ganhadores.");
        }
      }

      router.refresh();
    } catch (error) {
      console.error("Erro ao gerar/recalcular pedidos dos vencedores", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar os pedidos dos vencedores.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={() => void generateOrders()}
      disabled={disabled || loading}
    >
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      Gerar pedido
    </Button>
  );
}

async function notifyWinners(quotationId: string) {
  try {
    const response = await fetch("/api/whatsapp-envios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_winner_orders", quotationId }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível enviar WhatsApp.");
    return payload.whatsapp as WhatsappSummary | undefined;
  } catch (error) {
    toast.warning(error instanceof Error ? error.message : "Pedidos gerados, mas WhatsApp não enviado.");
    return null;
  }
}
