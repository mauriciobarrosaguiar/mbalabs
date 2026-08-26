"use client";

import { LayoutDashboard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/mba-escola/admin", label: "Painel ADMIN", icon: LayoutDashboard, exact: true },
  { href: "/mba-escola/admin/seguranca", label: "Segurança e LGPD", icon: ShieldCheck, exact: false }
];

export function AdminSectionNav() {
  const pathname = usePathname();

  return (
    <div className="cotacoes-module bg-[#F6F8FC] px-4 pt-4 text-[#172033]">
      <nav className="mx-auto flex max-w-7xl flex-wrap justify-end gap-2" aria-label="Navegação administrativa do MBA Escola">
        {items.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-black shadow-sm transition ${active ? "border-[#4353C7] bg-[#4353C7] text-white" : "border-[#DCE2EC] bg-white text-[#536078] hover:border-[#B9C2D3] hover:bg-[#F9FAFC]"}`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
