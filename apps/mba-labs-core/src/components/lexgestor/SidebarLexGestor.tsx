"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  Gavel,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Printer,
  Settings,
  UsersRound,
} from "lucide-react";
import { LogoutButtonLexGestor } from "./LogoutButtonLexGestor";

const navItems = [
  { href: "/lexgestor/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/lexgestor/clientes", label: "Clientes", icon: UsersRound },
  { href: "/lexgestor/casos", label: "Casos", icon: BriefcaseBusiness },
  { href: "/lexgestor/processos", label: "Processos", icon: Gavel },
  { href: "/lexgestor/documentos", label: "Documentos", icon: FileText },
  { href: "/lexgestor/relatorios", label: "Relatórios", icon: Printer },
  { href: "/lexgestor/configuracoes", label: "Configurações", icon: Settings },
];

export function SidebarLexGestor(_props: { canManageTeam?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar" aria-label="Navegacao LexGestor">
      <Link href="/lexgestor" className="sidebar-brand">
        <FolderKanban size={28} aria-hidden />
        <strong>LexGestor</strong>
        <span>Gestão jurídica</span>
      </Link>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link key={item.href} className={`nav-link${active ? " active" : ""}`} href={item.href}>
              <Icon size={18} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
        <LogoutButtonLexGestor />
      </nav>
    </aside>
  );
}
