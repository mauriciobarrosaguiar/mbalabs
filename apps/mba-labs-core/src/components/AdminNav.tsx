"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Boxes,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileClock,
  Globe2,
  Layers3,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

type AdminNavItem = {
  href: string;
  label: string;
  icon: typeof Building2;
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const adminGroups: AdminNavGroup[] = [
  {
    label: "Visão geral",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: ChartNoAxesCombined }]
  },
  {
    label: "Clientes",
    items: [
      { href: "/admin/empresas", label: "Empresas", icon: Building2 },
      { href: "/admin/usuarios", label: "Usuários e acessos", icon: Users }
    ]
  },
  {
    label: "Produtos",
    items: [
      { href: "/admin/apps", label: "Apps", icon: Boxes },
      { href: "/admin/planos", label: "Planos", icon: Layers3 },
      { href: "/admin/categorias-empresas", label: "Categorias de empresas", icon: ShieldCheck }
    ]
  },
  {
    label: "Financeiro",
    items: [
      { href: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard },
      { href: "/admin/pagamentos", label: "Pagamentos", icon: CircleDollarSign }
    ]
  },
  {
    label: "Portal",
    items: [{ href: "/admin/site", label: "Aparência e conteúdo", icon: Globe2 }]
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/configuracoes", label: "Configurações", icon: Settings2 },
      { href: "/admin/logs", label: "Logs e auditoria", icon: FileClock }
    ]
  }
];

function isCurrentPath(pathname: string, href: string) {
  if (href === "/admin/empresas") {
    return pathname === href || pathname.startsWith("/admin/empresas/");
  }
  if (href === "/admin/configuracoes") {
    return pathname === href || pathname.startsWith("/admin/configuracoes/");
  }
  return pathname === href;
}

function NavigationContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="border-b border-white/8 px-5 py-5">
        <Link href="/admin/dashboard" onClick={onNavigate} aria-label="MBA Labs - administração">
          <BrandLogo size="sm" />
        </Link>
        <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          <ShieldCheck size={14} />
          Central administrativa
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Administração MBA Labs">
        <div className="grid gap-5">
          {adminGroups.map((group) => (
            <section className="grid gap-1" key={group.label}>
              <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isCurrentPath(pathname, item.href);
                return (
                  <Link
                    className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                      active
                        ? "bg-violet-500/14 text-white ring-1 ring-inset ring-violet-400/25"
                        : "text-slate-300 hover:bg-white/[0.05] hover:text-white"
                    }`}
                    href={item.href}
                    key={item.href}
                    onClick={onNavigate}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        active ? "bg-violet-500/18 text-violet-300" : "bg-white/[0.04] text-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      <Icon size={17} strokeWidth={2.1} />
                    </span>
                    <span className="min-w-0 flex-1 leading-5">{item.label}</span>
                    {active ? <ChevronRight className="text-violet-300" size={15} /> : null}
                  </Link>
                );
              })}
            </section>
          ))}
        </div>
      </nav>

      <div className="border-t border-white/8 p-3">
        <form action="/sair" method="post">
          <button
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-200"
            type="submit"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.04]">
              <LogOut size={17} />
            </span>
            Sair
          </button>
        </form>
      </div>
    </>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-white/8 bg-[#080c18] shadow-[20px_0_70px_rgba(0,0,0,0.16)] lg:flex">
        <NavigationContent pathname={pathname} />
      </aside>

      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#080c18]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href="/admin/dashboard" aria-label="MBA Labs - administração">
            <BrandLogo size="sm" />
          </Link>
          <button
            aria-expanded={open}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-black text-white transition hover:bg-white/[0.08]"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            {open ? <X size={19} /> : <Menu size={19} />}
            {open ? "Fechar" : "Menu"}
          </button>
        </div>
      </header>

      {open ? (
        <div className="lg:hidden">
          <button
            aria-label="Fechar menu"
            className="fixed inset-0 top-[69px] z-40 bg-black/65 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            type="button"
          />
          <aside className="fixed bottom-0 right-0 top-[69px] z-50 flex w-[min(88vw,340px)] flex-col border-l border-white/10 bg-[#080c18] shadow-2xl">
            <NavigationContent pathname={pathname} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
