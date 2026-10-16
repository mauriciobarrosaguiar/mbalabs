import type { SupplierQuoteSession } from "@/modules/cotacoes/lib/types";

/**
 * Respostas dos representantes permanecem abertas até todos concluírem
 * ou até o prazo da cotação. O ranking é provisório até seu encerramento.
 */
export function getRepresentativeProgress(
  sessions: Pick<SupplierQuoteSession, "status">[],
  deadlineAt?: string | null,
  now = new Date(),
) {
  const total = sessions.length;
  const submitted = sessions.filter((session) => session.status === "submitted").length;
  const dismissed = sessions.filter((session) => session.status === "expired" || session.status === "canceled").length;
  const pending = Math.max(0, total - submitted - dismissed);
  const parsed = deadlineAt ? Date.parse(deadlineAt) : NaN;
  const deadlineReached = Number.isFinite(parsed) && now.getTime() >= parsed;
  return {
    total,
    submitted,
    dismissed,
    pending,
    deadlineReached,
    /** Sem convites pendentes ou prazo atingido. Exige fechamento explícito. */
    canClose: pending === 0 || deadlineReached,
  };
}
