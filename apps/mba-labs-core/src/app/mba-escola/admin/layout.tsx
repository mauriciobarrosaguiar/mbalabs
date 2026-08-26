import type { ReactNode } from "react";
import { AdminSectionNav } from "@/components/mba-escola/AdminSectionNav";

export default function MbaEscolaAdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminSectionNav />
      {children}
    </>
  );
}
