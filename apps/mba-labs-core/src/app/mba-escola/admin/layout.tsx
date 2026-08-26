import type { ReactNode } from "react";
import { AdminMfaGate } from "@/components/mba-escola/AdminMfaGate";

export default function MbaEscolaAdminLayout({ children }: { children: ReactNode }) {
  return <AdminMfaGate>{children}</AdminMfaGate>;
}
