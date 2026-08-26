import type { ReactNode } from "react";
import { AdminMfaGate } from "@/components/mba-escola/AdminMfaGate";
import { AdminSectionNav } from "@/components/mba-escola/AdminSectionNav";

export default function MbaEscolaAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminMfaGate>
      <AdminSectionNav />
      {children}
    </AdminMfaGate>
  );
}
