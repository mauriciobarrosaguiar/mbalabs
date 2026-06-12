"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
