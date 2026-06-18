import Link from "next/link";
import { Settings } from "lucide-react";
import { ThemeToggleLexGestor } from "./ThemeToggleLexGestor";

export function HeaderLexGestor() {
  return (
    <header className="topbar topbar-mobile-v2">
      <div className="topbar-title">
        <strong>Gestao juridica</strong>
      </div>
      <div className="topbar-actions">
        <ThemeToggleLexGestor />
        <Link className="button secondary topbar-icon-button" href="/lexgestor/configuracoes" aria-label="Configurar escritorio" title="Configurar escritorio">
          <Settings size={17} aria-hidden />
        </Link>
      </div>
    </header>
  );
}
