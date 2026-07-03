"use client";

import { useEffect, useState } from "react";
import { Copy, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import type { PurchaseOrder } from "@/lib/types";

type WhatsappStatus = "pendente" | "enviado" | "falhou";
type WhatsappEnvio = {
  vendedorId: string;
  status: WhatsappStatus;
  erro?: string;
};

const whatsappStatusLabels: Record<WhatsappStatus, string> = {
  pendente: "pendente",
  enviado: "enviado",
  falhou: "falhou",
};

export function WinnerOrderLinks({ order }: { order?: PurchaseOrder }) {
  const [envio, setEnvio] = useState<WhatsappEnvio | null>(null);

  useEffect(() => {
    if (!order) return;
    let active = true;
    const vendedorId = vendorIdFor(order);
    const query = new URLSearchParams({
      quotationId: order.quotationId,
      tipoEnvio: "resultado_cotacao",
      vendedorId,
    });

    fetch(`/api/whatsapp-envios?${query.toString()}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const first = Array.isArray(payload.envios) ? payload.envios[0] as WhatsappEnvio | undefined : undefined;
        if (first) setEnvio(first);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [order]);

  if (!order) {
    return <span className="text-sm text-muted-foreground">Pedido pendente</span>;
  }

  const path = `/${order.moduleType === "bidding" ? "licitacao" : "cotacao"}/pedido/${order.publicToken}`;
  const status = envio?.status ?? "pendente";

  function buildPublicLink() {
    return `${window.location.origin}${path}`;
  }

  function copyLink() {
    void navigator.clipboard.writeText(buildPublicLink());
    toast.success("Link copiado");
  }

  async function resend() {
    try {
      const response = await fetch("/api/whatsapp-envios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resend",
          quotationId: order.quotationId,
          tipoEnvio: "resultado_cotacao",
          vendedorId: vendorIdFor(order),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível reenviar.");
      const result = payload.whatsapp?.results?.[0] as WhatsappEnvio | undefined;
      if (result) setEnvio(result);
      if (payload.whatsapp?.falhou) {
        toast.warning("Reenvio falhou.");
      } else {
        toast.success("WhatsApp reenviado.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível reenviar WhatsApp.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <StatusBadge status={status} label={whatsappStatusLabels[status]} />
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={copyLink}>
          <Copy className="h-4 w-4" />
          Copiar link
        </Button>
        {status === "falhou" ? (
          <Button type="button" variant="outline" size="sm" onClick={() => void resend()}>
            <RefreshCcw className="h-4 w-4" />
            Reenviar WhatsApp
          </Button>
        ) : null}
      </div>
      {envio?.erro ? <p className="max-w-xs text-right text-xs text-red-700">{envio.erro}</p> : null}
    </div>
  );
}

function vendorIdFor(order: PurchaseOrder) {
  return order.supplierId || order.id;
}
