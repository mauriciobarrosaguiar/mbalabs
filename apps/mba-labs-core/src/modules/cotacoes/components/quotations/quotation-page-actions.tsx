"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, MessageSquareText, ReceiptText, Send, Trophy } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/modules/cotacoes/components/dashboard/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/modules/cotacoes/components/ui/alert-dialog";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { labelFrom, quotationStatusLabels } from "@/modules/cotacoes/lib/labels";
import { canFinishQuotation, canGenerateQuotationOrders, isQuotationClosed, isQuotationGenerated } from "@/modules/cotacoes/lib/quotation-status";
import type { ModuleType, QuotationStatus } from "@/modules/cotacoes/lib/types";

type PageKey = "detail" | "new" | "edit" | "responses" | "analysis" | "orders";
type WhatsappAction = "send_quotation_links" | "send_winner_orders";
type WhatsappResult = { vendedorId?: string; status?: string };
type WhatsappSummary = { total?: number; enviado?: number; falhou?: number; ignorado?: number; results?: WhatsappResult[] };
const SEMI_AUTO_EVENT = "mba-cotacoes:whatsapp-semi-auto";

export function BackButton({ fallbackHref, label = "Voltar" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  return (
    <Button type="button" variant="outline" onClick={() => window.history.length > 1 ? router.back() : router.push(fallbackHref)}>
      <ArrowLeft className="h-4 w-4" />{label}
    </Button>
  );
}

export function QuotationPageActions({ quotationId, moduleType, status, currentPage = "detail" }: { quotationId: string; moduleType: ModuleType; status: QuotationStatus; currentPage?: PageKey }) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState<QuotationStatus>(status);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const base = moduleType === "pharmacy" ? "/cotacoes/cotacoes-farmacia" : "/cotacoes/licitacoes";
  const canSendInBulk = !isQuotationClosed(localStatus);
  const canFinish = canFinishQuotation(localStatus);
  const canViewOrders = canGenerateQuotationOrders(localStatus);
  const isDetail = currentPage === "detail";

  async function mutate(action: "finish" | "reopen_links") {
    if (loadingAction) return null;
    setLoadingAction(action);
    try {
      const response = await fetch("/api/cotacoes/quotations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: quotationId, action }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível atualizar a cotação.");
      if (payload.status) setLocalStatus(payload.status as QuotationStatus);
      if (payload.warning) toast.warning(String(payload.warning));
      router.refresh();
      return payload;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar cotação.");
      return null;
    } finally {
      setLoadingAction(null);
    }
  }

  async function runWhatsapp(action: WhatsappAction) {
    try {
      const response = await fetch("/api/whatsapp-envios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, quotationId }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Falha no envio por WhatsApp.");
      return payload.whatsapp as WhatsappSummary | undefined;
    } catch (error) {
      toast.warning(error instanceof Error ? error.message : "WhatsApp não enviado. O fluxo foi mantido.");
      return null;
    }
  }

  async function finish() {
    const payload = await mutate("finish");
    if (!payload) return;
    toast.success("Cotação finalizada.");
    showWhatsappResult(await runWhatsapp("send_winner_orders"), "Pedido enviado aos vendedores ganhadores.");
    router.push(`${base}/${quotationId}/analise`);
  }

  async function sendInBulk() {
    if (loadingAction) return;
    setLoadingAction("bulk_send");
    try {
      const response = await fetch("/api/cotacoes/quotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quotationId, action: "reopen_links" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível liberar os links da cotação.");
      if (payload.status) setLocalStatus(payload.status as QuotationStatus);

      const whatsapp = await runWhatsapp("send_quotation_links");
      showWhatsappResult(whatsapp, "Cotação enviada em massa aos vendedores.");
      const failedVendorIds = (whatsapp?.results ?? [])
        .filter((result) => result.status === "falhou" && result.vendedorId)
        .map((result) => String(result.vendedorId));
      if (failedVendorIds.length > 0) {
        toast.info("Alguns envios automáticos falharam. A fila semiautomática foi preparada abaixo.");
        window.dispatchEvent(new CustomEvent(SEMI_AUTO_EVENT, {
          detail: { quotationId, vendedorIds: failedVendorIds },
        }));
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar a cotação em massa.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <BackButton fallbackHref={base} />
          <StatusBadge status={localStatus} label={labelFrom(quotationStatusLabels, localStatus)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {!isDetail ? (
            <Button asChild variant="outline">
              <Link href={`${base}/${quotationId}`}>Cotação</Link>
            </Button>
          ) : null}

          {isDetail && canSendInBulk ? (
            <Button type="button" onClick={() => void sendInBulk()} disabled={Boolean(loadingAction)}>
              <Send className="h-4 w-4" />
              {loadingAction === "bulk_send" ? "Enviando..." : "Enviar em massa aos vendedores"}
            </Button>
          ) : null}

          {isDetail ? (
            <Button asChild variant="outline">
              <Link href={`${base}/${quotationId}/respostas`}><MessageSquareText className="h-4 w-4" />Respostas</Link>
            </Button>
          ) : null}

          {isDetail ? (
            <Button asChild variant="outline">
              <Link href={`${base}/${quotationId}/analise`}><Trophy className="h-4 w-4" />{moduleType === "pharmacy" ? "Vencedores" : "Análise"}</Link>
            </Button>
          ) : null}

          {isDetail && canFinish ? (
            <Button type="button" variant="outline" onClick={() => setConfirmFinish(true)} disabled={Boolean(loadingAction)}>
              <CheckCircle2 className="h-4 w-4" />Finalizar
            </Button>
          ) : null}

          {canViewOrders && (isDetail || currentPage === "analysis") ? (
            <Button asChild variant="outline">
              <Link href={`${base}/${quotationId}/pedidos`}><ReceiptText className="h-4 w-4" />{isQuotationGenerated(localStatus) ? "Pedidos" : "Gerar pedido"}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar cotação</AlertDialogTitle>
            <AlertDialogDescription>Deseja finalizar esta cotação? Após finalizar, fornecedores que ainda não responderam não poderão mais enviar respostas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmFinish(false); void finish(); }}>Finalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function showWhatsappResult(result: WhatsappSummary | null | undefined, message: string) {
  if (!result) return;
  if (Number(result.falhou ?? 0) > 0) return toast.warning(`${message} ${result.falhou} envio(s) falharam.`);
  if (Number(result.enviado ?? 0) > 0) return toast.success(message);
  if (Number(result.total ?? 0) === 0 || Number(result.ignorado ?? 0) > 0) toast.info("Nenhum novo WhatsApp foi enviado agora.");
}
