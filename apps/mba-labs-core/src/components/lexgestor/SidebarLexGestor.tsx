"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  ClipboardList,
  Gavel,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Printer,
  Settings,
  UsersRound,
} from "lucide-react";

const navItems = [
  { href: "/lexgestor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lexgestor/processos", label: "Processos", icon: Gavel },
  { href: "/lexgestor/documentos", label: "Documentos", icon: FileText },
  { href: "/lexgestor/clientes", label: "Clientes", icon: UsersRound },
  { href: "/lexgestor/casos", label: "Casos", icon: BriefcaseBusiness },
  { href: "/lexgestor/checklists", label: "Checklists", icon: ClipboardList },
  { href: "/lexgestor/equipe", label: "Equipe", icon: UsersRound, requiresTeamManager: true },
  { href: "/lexgestor/relatorios", label: "Relatórios", icon: Printer },
  { href: "/lexgestor/configuracoes", label: "Configurações", icon: Settings },
];

export function SidebarLexGestor({ canManageTeam = false }: { canManageTeam?: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar" aria-label="Navegacao LexGestor">
      <Link href="/lexgestor" className="sidebar-brand">
        <FolderKanban size={28} aria-hidden />
        <strong>LexGestor</strong>
        <span>Sistema jurídico para escritórios de advocacia</span>
      </Link>
      <nav className="sidebar-nav">
        {navItems.filter((item) => !item.requiresTeamManager || canManageTeam).map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              className={`nav-link${active ? " active" : ""}`}
              href={item.href}
            >
              <Icon size={18} aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
