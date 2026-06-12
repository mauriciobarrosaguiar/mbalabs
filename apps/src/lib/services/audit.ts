import type { AuditLog } from "@/lib/types";

export function buildAuditLog(
  input: Omit<AuditLog, "id" | "createdAt">,
): AuditLog {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}
