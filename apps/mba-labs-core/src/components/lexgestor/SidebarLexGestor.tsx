"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Printer,
  Settings,
  UsersRound,
} from "lucide-react";

const navItems = [
  { href: "/lexgestor/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lexgestor/clientes", label: "Clientes", icon: UsersRound },
  { href: "/lexgestor/casos", label: "Casos", icon: BriefcaseBusiness },
  { href: "/lexgestor/documentos", label: "Documentos", icon: FileText },
  { href: "/lexgestor/checklists", label: "Checklists", icon: ClipboardList },
  { href: "/lexgestor/relatorios", label: "Relatorios", icon: Printer },
  { href: "/lexgestor/configuracoes", label: "Configuracoes", icon: Settings },
];

export function SidebarLexGestor() {
  const pathname = usePathname();

  return (
    <aside className="sidebar" aria-label="Navegacao LexGestor">
      <Link href="/lexgestor" className="sidebar-brand">
        <FolderKanban size={28} aria-hidden />
        <strong>LexGestor</strong>
        <span>Sistema juridico para escritorios de advocacia</span>
      </Link>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
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
