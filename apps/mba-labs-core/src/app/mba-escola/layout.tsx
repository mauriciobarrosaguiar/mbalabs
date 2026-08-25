import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import MbaEscolaSsoShell from "./mba-escola-sso-shell";

export const dynamic = "force-dynamic";

export default async function MbaEscolaLayout({ children }: { children: ReactNode }) {
  const current = await requireAppAccess("mba-escola", "/mba-escola");

  if (current.usuario.status !== "ativo") {
    redirect("/acesso-bloqueado?motivo=usuario");
  }

  return (
    <MbaEscolaSsoShell
      identity={{
        id: current.authUser.id,
        email: current.authUser.email ?? "",
        nome: current.usuario.nome
      }}
    >
      {children}
    </MbaEscolaSsoShell>
  );
}
