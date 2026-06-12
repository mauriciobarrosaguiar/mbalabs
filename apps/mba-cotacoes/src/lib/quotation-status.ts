import type { QuotationStatus } from "@/lib/types";

const IN_PROGRESS_STATUSES = new Set<string>([
  "draft",
  "rascunho",
  "sent",
  "enviada",
  "open",
  "opened",
  "aberta",
  "em_andamento",
  "analyzing",
  "respondendo",
  "waiting_responses",
  "aguardando_respostas",
]);

const FINISHED_STATUSES = new Set<string>([
  "finished",
  "finalizada",
  "finalizado",
]);

const GENERATED_STATUSES = new Set<string>([
  "gerado",
  "generated",
  "pedido_gerado",
]);

const CANCELED_STATUSES = new Set<string>([
  "canceled",
  "cancelada",
  "cancelado",
  "encerrada",
  "encerrado",
]);

const DELETED_STATUSES = new Set<string>([
  "excluida",
  "excluída",
  "deleted",
]);

export function isQuotationInProgress(status?: string | null) {
  return IN_PROGRESS_STATUSES.has(normalizeStatus(status));
}

export function isQuotationFinished(status?: string | null) {
  return FINISHED_STATUSES.has(normalizeStatus(status));
}

export function isQuotationGenerated(status?: string | null) {
  return GENERATED_STATUSES.has(normalizeStatus(status));
}

export function isQuotationCanceled(status?: string | null) {
  return CANCELED_STATUSES.has(normalizeStatus(status));
}

export function isQuotationDeleted(status?: string | null) {
  return DELETED_STATUSES.has(normalizeStatus(status));
}

export function isQuotationClosed(status?: string | null) {
  return (
    isQuotationFinished(status) ||
    isQuotationGenerated(status) ||
    isQuotationCanceled(status) ||
    isQuotationDeleted(status)
  );
}

export function canFinishQuotation(status?: string | null) {
  return ["open", "waiting_responses", "analyzing"].includes(normalizeStatus(status));
}

export function canGenerateQuotationOrders(status?: string | null) {
  return isQuotationFinished(status) || isQuotationGenerated(status);
}

export function markQuotationGeneratedStatus(): QuotationStatus {
  return "generated";
}

function normalizeStatus(status?: string | null) {
  return String(status ?? "").trim().toLowerCase();
}
