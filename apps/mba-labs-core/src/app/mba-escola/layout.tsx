import type { ReactNode } from "react";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function MbaEscolaLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("mba-escola", "/mba-escola");
  return children;
}
