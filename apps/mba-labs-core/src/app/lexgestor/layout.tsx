import { ReactNode } from "react";
import "./lexgestor.css";
import "./lexgestor-documents.css";
import "./lexgestor-mobile.css";
import "./lexgestor-mobile-compact.css";
import "./lexgestor-mobile-compact-v2.css";
import "./lexgestor-polish.css";
import { HeaderLexGestor } from "@/components/lexgestor/HeaderLexGestor";
import { MobileNavLexGestor } from "@/components/lexgestor/MobileNavLexGestor";
import { SidebarLexGestor } from "@/components/lexgestor/SidebarLexGestor";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function LexGestorLayout({ children }: { children: ReactNode }) {
  await requireAppAccess("lexgestor");

  return (
    <div className="lexgestor-module">
      <div className="lex-shell">
        <SidebarLexGestor />
        <div className="lex-main">
          <HeaderLexGestor />
          <div className="lex-content">{children}</div>
          <MobileNavLexGestor />
        </div>
      </div>
    </div>
  );
}
