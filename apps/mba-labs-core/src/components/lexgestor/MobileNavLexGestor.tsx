"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  FileText,
  Gavel,
  LayoutDashboard,
  UsersRound,
} from "lucide-react";
import { LogoutButtonLexGestor } from "./LogoutButtonLexGestor";

const items = [
  { href: "/lexgestor/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/lexgestor/clientes", label: "Clientes", icon: UsersRound },
  { href: "/lexgestor/casos", label: "Casos", icon: BriefcaseBusiness },
  { href: "/lexgestor/processos", label: "Proc.", icon: Gavel },
  { href: "/lexgestor/documentos", label: "Docs", icon: FileText },
];

export function MobileNavLexGestor(_props: { canManageTeam?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="mobile-nav" aria-label="Navegacao movel LexGestor">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link key={item.href} href={item.href} className={active ? "active" : undefined} title={item.label}>
            <Icon size={18} aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <LogoutButtonLexGestor variant="mobile" />
    </nav>
  );
}
