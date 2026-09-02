import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getOptionalElshadayContext, getPublicElshadayContext } from "@/lib/elshaday";
import { ElshadayAdaptiveShell } from "./ElshadayAdaptiveShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elshaday | Igreja Assembleia de Deus",
  description: "Agenda, contribuições, palavras e acesso ao aplicativo da Igreja Elshaday."
};

export default async function ElshadayLayout({ children }: { children: ReactNode }) {
  const [context, publicContext] = await Promise.all([
    getOptionalElshadayContext(),
    getPublicElshadayContext()
  ]);

  return (
    <ElshadayAdaptiveShell
      igrejaNome={publicContext.igreja.nome}
      igrejaNomeCurto={publicContext.igreja.nome_curto}
      usuarioNome={context?.current.usuario.nome ?? null}
      papel={context?.papel ?? null}
      hasInternalAccess={Boolean(context)}
    >
      {children}
    </ElshadayAdaptiveShell>
  );
}
