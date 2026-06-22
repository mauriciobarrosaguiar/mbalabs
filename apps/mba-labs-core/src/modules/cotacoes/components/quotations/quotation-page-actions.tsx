"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Link2, MessageSquareText, ReceiptText, Trophy } from "lucide-react";
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
type WhatsappSummary = { total?: number; enviado?: number; falhou?: number; ignorado?: number };

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
  const canGenerateLinks = !isQuotationClosed(localStatus);
  const canFinish = canFinishQuotation(localStatus);
  const canViewOrders = canGenerateQuotationOrders(localStatus);

  async function mutate(action: "finish" | "reopen_links") {
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

  async function generateLinks() {
    const payload = await mutate("reopen_links");
    if (!payload) return;
    showWhatsappResult(await runWhatsapp("send_quotation_links"), "Cotação enviada aos vendedores.");
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <BackButton fallbackHref={base} />
          <StatusBadge status={localStatus} label={labelFrom(quotationStatusLabels, localStatus)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {currentPage !== "detail" ? <Button asChild variant="outline"><Link href={`${base}/${quotationId}`}>Ver cotação</Link></Button> : null}
          {canGenerateLinks ? <Button type="button" variant="outline" onClick={() => void generateLinks()} disabled={loadingAction === "reopen_links"}><Link2 className="h-4 w-4" />Enviar cotação aos vendedores</Button> : null}
          {currentPage !== "responses" ? <Button asChild variant="outline"><Link href={`${base}/${quotationId}/respostas`}><MessageSquareText className="h-4 w-4" />Ver respostas</Link></Button> : null}
          {currentPage !== "analysis" ? <Button asChild variant="outline"><Link href={`${base}/${quotationId}/analise`}><Trophy className="h-4 w-4" />{moduleType === "pharmacy" ? "Ver vencedores" : "Ver análise"}</Link></Button> : null}
          {canFinish ? <Button type="button" onClick={() => setConfirmFinish(true)} disabled={loadingAction === "finish"}><CheckCircle2 className="h-4 w-4" />Finalizar Cotação</Button> : null}
          {canViewOrders && currentPage !== "orders" ? <Button asChild><Link href={`${base}/${quotationId}/pedidos`}><ReceiptText className="h-4 w-4" />{isQuotationGenerated(localStatus) ? "Ver pedidos" : "Gerar pedido"}</Link></Button> : null}
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
