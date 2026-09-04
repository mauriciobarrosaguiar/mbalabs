import type { ReactNode } from "react";
import { requireElshadayContext } from "@/lib/elshaday";
import { MemberFunctionEnhancer } from "./MemberFunctionEnhancer";

export const dynamic = "force-dynamic";

export default async function ElshadayMembersLayout({ children }: { children: ReactNode }) {
  const context = await requireElshadayContext("/elshaday/membros");

  return (
    <>
      {children}
      <MemberFunctionEnhancer actorRole={context.papel} />
    </>
  );
}
