"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { ElshadayRole } from "@/lib/elshaday-role";
import { ElshadayPublicShell } from "./ElshadayPublicShell";
import { ElshadayShell } from "./ElshadayShell";

const PUBLIC_PATHS = new Set([
  "/elshaday",
  "/elshaday/contribuir"
]);

export function ElshadayAdaptiveShell({
  children,
  igrejaNome,
  igrejaNomeCurto,
  usuarioNome,
  papel,
  hasInternalAccess
}: {
  children: ReactNode;
  igrejaNome: string;
  igrejaNomeCurto: string;
  usuarioNome: string | null;
  papel: ElshadayRole | null;
  hasInternalAccess: boolean;
}) {
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.has(pathname);

  if (isPublicPath || !hasInternalAccess || !usuarioNome || !papel) {
    return (
      <ElshadayPublicShell
        igrejaNome={igrejaNome}
        igrejaNomeCurto={igrejaNomeCurto}
        hasInternalAccess={hasInternalAccess}
      >
        {children}
      </ElshadayPublicShell>
    );
  }

  return (
    <ElshadayShell
      igrejaNome={igrejaNome}
      usuarioNome={usuarioNome}
      papel={papel}
    >
      {children}
    </ElshadayShell>
  );
}
