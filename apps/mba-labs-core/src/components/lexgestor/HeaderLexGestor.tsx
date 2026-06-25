import Link from "next/link";
import { Settings } from "lucide-react";
import { LogoutButtonLexGestor } from "./LogoutButtonLexGestor";
import { ThemeToggleLexGestor } from "./ThemeToggleLexGestor";

export function HeaderLexGestor() {
  return (
    <header className="topbar topbar-mobile-v2">
      <div className="topbar-title">
        <strong>Gestão jurídica</strong>
      </div>
      <div className="topbar-actions">
        <ThemeToggleLexGestor />
        <Link className="button secondary topbar-icon-button" href="/lexgestor/configuracoes" aria-label="Configurações" title="Configurações">
          <Settings size={17} aria-hidden />
        </Link>
        <LogoutButtonLexGestor variant="topbar" />
      </div>
    </header>
  );
}
