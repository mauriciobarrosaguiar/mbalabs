"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FilePlus2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ModuleType } from "@/lib/types";

export function WinnerPendingActions({
  quotationId,
  pendingId,
  moduleType,
  disabled,
}: {
  quotationId: string;
  pendingId: string;
  moduleType: ModuleType;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function run(action: "send_next" | "new_quotation" | "resolve" | "cancel") {
    setLoading(action);
    try {
      const response = await fetch(`/api/winner-pendencies/${quotationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, pendingId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar a pendência.");
      toast.success(successMessage(action));
      if (action === "new_quotation" && payload.quotation?.id) {
        router.push(`/app/${moduleType === "bidding" ? "licitacoes" : "cotacoes-farmacia"}/${payload.quotation.id}`);
        router.refresh();
        return;
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar pendência.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(loading)} onClick={() => void run("send_next")}>
        <ArrowRight className="h-4 w-4" />
        Enviar faltante para próximo vendedor
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(loading)} onClick={() => void run("new_quotation")}>
        <FilePlus2 className="h-4 w-4" />
        Gerar nova cotação com falta
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(loading)} onClick={() => void run("resolve")}>
        <CheckCircle2 className="h-4 w-4" />
        Resolver
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled || Boolean(loading)} onClick={() => void run("cancel")}>
        <XCircle className="h-4 w-4" />
        Cancelar
      </Button>
    </div>
  );
}

export function CreateMissingQuotationButton({
  quotationId,
  pendingIds,
  moduleType,
  disabled,
}: {
  quotationId: string;
  pendingIds?: string[];
  moduleType: ModuleType;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function createQuotation() {
    setLoading(true);
    try {
      const response = await fetch(`/api/winner-pendencies/${quotationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "new_quotation", pendingIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível criar a nova cotação.");
      toast.success("Nova cotação criada com os produtos faltantes.");
      if (payload.quotation?.id) {
        router.push(`/app/${moduleType === "bidding" ? "licitacoes" : "cotacoes-farmacia"}/${payload.quotation.id}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar nova cotação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={disabled || loading} onClick={() => void createQuotation()}>
      <FilePlus2 className="h-4 w-4" />
      Gerar nova cotação com faltas
    </Button>
  );
}

function successMessage(action: string) {
  if (action === "send_next") return "Item enviado para o próximo vendedor.";
  if (action === "new_quotation") return "Nova cotação criada com o item pendente.";
  if (action === "resolve") return "Pendência marcada como resolvida.";
  return "Pendência cancelada.";
}
