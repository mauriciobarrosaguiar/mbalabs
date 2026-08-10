"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, MessageSquareText, ReceiptText, Send, Trophy } from "lucide-react";
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
type WhatsappResult = {
  vendedorId?: string;
  status?: string;
  skipped?: boolean;
  enviadoPor?: string;
  enviadoEm?: string;
  erro?: string;
};
type WhatsappSummary = {
  total?: number;
  enviado?: number;
  falhou?: number;
  pendente?: number;
  ignorado?: number;
  results?: WhatsappResult[];
};
const SEMI_AUTO_EVENT = "mba-cotacoes:whatsapp-semi-auto";
const PREPARE_WHATSAPP_EVENT = "mba-cotacoes:whatsapp-prepare-window";
const RELEASE_WHATSAPP_EVENT = "mba-cotacoes:whatsapp-release-window";

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
  const [whatsappSummary, setWhatsappSummary] = useState<WhatsappSummary | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const base = moduleType === "pharmacy" ? "/cotacoes/cotacoes-farmacia" : "/cotacoes/licitacoes";
  const canSendInBulk = !isQuotationClosed(localStatus);
  const canFinish = canFinishQuotation(localStatus);
  const canViewOrders = canGenerateQuotationOrders(localStatus);
  const isDetail = currentPage === "detail";

  useEffect(() => {
    if (!isDetail) return;
    let active = true;
    const query = new URLSearchParams({ quotationId, tipoEnvio: "link_cotacao" });
    fetch(`/api/whatsapp-envios?${query.toString()}`)
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const envios = Array.isArray(payload.envios) ? payload.envios as WhatsappResult[] : [];
        if (envios.length > 0) setWhatsappSummary(summaryFromEnvios(envios));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isDetail, quotationId]);

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

    setWhatsappError(null);
    window.dispatchEvent(new CustomEvent(PREPARE_WHATSAPP_EVENT, { detail: { quotationId } }));
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
      if (!whatsapp) {
        setWhatsappError("Não foi possível confirmar o disparo automático pela Evolution. Nenhum envio manual foi marcado automaticamente.");
        window.dispatchEvent(new CustomEvent(RELEASE_WHATSAPP_EVENT, { detail: { quotationId } }));
        return;
      }

      setWhatsappSummary(whatsapp);
      showWhatsappResult(whatsapp, "Cotação enviada em massa aos vendedores.");

      const failedVendorIds = (whatsapp.results ?? [])
        .filter((result) => result.status === "falhou" && result.vendedorId)
        .map((result) => String(result.vendedorId));

      if (failedVendorIds.length > 0) {
        toast.info("A Evolution não confirmou todos os envios. Abrindo a fila manual no WhatsApp.");
        window.dispatchEvent(new CustomEvent(SEMI_AUTO_EVENT, {
          detail: { quotationId, vendedorIds: failedVendorIds, autoOpen: true },
        }));
      } else {
        window.dispatchEvent(new CustomEvent(RELEASE_WHATSAPP_EVENT, { detail: { quotationId } }));
      }

      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar a cotação em massa.";
      setWhatsappError(message);
      window.dispatchEvent(new CustomEvent(RELEASE_WHATSAPP_EVENT, { detail: { quotationId } }));
      toast.error(message);
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <div className="space-y-2">
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

        {isDetail && whatsappSummary ? <WhatsappSendSummary summary={whatsappSummary} /> : null}
        {isDetail && whatsappError ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{whatsappError}</span>
          </div>
        ) : null}
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

function WhatsappSendSummary({ summary }: { summary: WhatsappSummary }) {
  const results = summary.results ?? [];
  const evolutionSent = results.filter((result) => result.status === "enviado" && result.enviadoPor === "evolution_api").length;
  const manualSent = results.filter((result) => result.status === "enviado" && result.enviadoPor === "manual_whatsapp").length;
  const alreadySent = results.filter((result) => result.status === "enviado" && result.skipped).length;
  const failed = Number(summary.falhou ?? results.filter((result) => result.status === "falhou").length);
  const totalSent = Number(summary.enviado ?? results.filter((result) => result.status === "enviado").length);
  const currentEvolutionSent = results.filter((result) => result.status === "enviado" && result.enviadoPor === "evolution_api" && !result.skipped).length;
  const success = failed === 0 && totalSent > 0;

  return (
    <div className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-sm ${success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
      <div className="flex items-center gap-2 font-semibold">
        {success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        <span>{currentEvolutionSent > 0 ? `Evolution confirmou ${currentEvolutionSent} novo(s) disparo(s)` : totalSent > 0 ? `${totalSent} envio(s) já registrado(s)` : "Nenhum envio confirmado"}</span>
      </div>
      <p className="text-xs leading-5 opacity-90">
        {evolutionSent > 0 ? `Via Evolution: ${evolutionSent}. ` : ""}
        {manualSent > 0 ? `Manual: ${manualSent}. ` : ""}
        {alreadySent > 0 ? `Já enviados anteriormente: ${alreadySent}. ` : ""}
        {failed > 0 ? `Falharam: ${failed}. A fila manual será usada somente para estes vendedores.` : "Nenhuma falha pendente neste resultado."}
      </p>
    </div>
  );
}

function summaryFromEnvios(envios: WhatsappResult[]): WhatsappSummary {
  return {
    total: envios.length,
    enviado: envios.filter((envio) => envio.status === "enviado").length,
    falhou: envios.filter((envio) => envio.status === "falhou").length,
    pendente: envios.filter((envio) => envio.status === "pendente").length,
    ignorado: 0,
    results: envios,
  };
}

function showWhatsappResult(result: WhatsappSummary | null | undefined, message: string) {
  if (!result) return;
  const freshSent = (result.results ?? []).filter((item) => item.status === "enviado" && !item.skipped).length;
  const alreadySent = (result.results ?? []).filter((item) => item.status === "enviado" && item.skipped).length;
  if (Number(result.falhou ?? 0) > 0) return toast.warning(`${message} ${result.falhou} envio(s) falharam.`);
  if (freshSent > 0) return toast.success(`${message} ${freshSent} novo(s) disparo(s) confirmado(s).`);
  if (alreadySent > 0) return toast.info(`${alreadySent} vendedor(es) já constavam como enviados. Nenhuma mensagem duplicada foi disparada.`);
  if (Number(result.total ?? 0) === 0 || Number(result.ignorado ?? 0) > 0) toast.info("Nenhum novo WhatsApp foi enviado agora.");
}
