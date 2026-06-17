import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { ThemeToggleLexGestor } from "./ThemeToggleLexGestor";

export function HeaderLexGestor() {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <strong>Gestao juridica</strong>
        <span>Clientes, casos, documentos e relatorios</span>
      </div>
      <div className="topbar-actions">
        <ThemeToggleLexGestor />
        <Link className="button secondary" href="/lexgestor/configuracoes">
          <Settings size={17} aria-hidden />
          Configurar escritorio
        </Link>
        <Link className="button" href="/lexgestor/casos/novo">
          <Plus size={17} aria-hidden />
          Abrir caso
        </Link>
      </div>
    </header>
  );
}
