import { ReactNode } from "react";
import "./lexgestor.css";
import "./lexgestor-documents.css";
import "./lexgestor-mobile.css";
import "./lexgestor-mobile-compact.css";
import "./lexgestor-mobile-compact-v2.css";
import "./lexgestor-polish.css";
import "./lexgestor-layout-fix.css";
import { HeaderLexGestor } from "@/components/lexgestor/HeaderLexGestor";
import { MobileNavLexGestor } from "@/components/lexgestor/MobileNavLexGestor";
import { SidebarLexGestor } from "@/components/lexgestor/SidebarLexGestor";
import { requireAppAccess } from "@/lib/core-data";
import { obterUsuarioLexGestorAtual } from "@/lib/lexgestor/auth";
import { possuiPermissao } from "@/lib/lexgestor/permissions";

export const dynamic = "force-dynamic";

export default async function LexGestorLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("lexgestor");
  const usuarioLex = await obterUsuarioLexGestorAtual();
  const canManageTeam = possuiPermissao(usuarioLex, "lex:equipe:gerenciar");

  return (
    <div className="lexgestor-module">
      <div className="lex-shell">
        <SidebarLexGestor canManageTeam={canManageTeam} />
        <div className="lex-main">
          <HeaderLexGestor />
          <div className="lex-content">{children}</div>
          <MobileNavLexGestor canManageTeam={canManageTeam} />
        </div>
      </div>
    </div>
  );
}
