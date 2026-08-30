import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireElshadayContext } from "@/lib/elshaday";
import { ElshadayShell } from "./ElshadayShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elshaday Gestão | MBA Labs",
  description: "Gestão de membros, dízimos, ofertas, cultos, eventos, pregações e Bíblia."
};

export default async function ElshadayLayout({ children }: { children: ReactNode }) {
  const context = await requireElshadayContext("/elshaday");

  return (
    <ElshadayShell
      igrejaNome={context.igreja.nome}
      usuarioNome={context.current.usuario.nome}
      papel={context.papel}
    >
      {children}
    </ElshadayShell>
  );
}
