"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Church,
  FileBarChart,
  HandHeart,
  HandCoins,
  Home,
  LogOut,
  Menu,
  Mic2,
  QrCode,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import type { ElshadayRole } from "@/lib/elshaday-role";

const ROLE_LABEL: Record<ElshadayRole, string> = {
  admin: "Administrador",
  pastor: "Pastor",
  tesouraria: "Tesouraria",
  secretaria: "Secretaria",
  lider: "Líder",
  membro: "Membro"
};

export function ElshadayMobileAppChrome({
  igrejaNome,
  usuarioNome,
  papel
}: {
  igrejaNome: string;
  usuarioNome: string;
  papel: ElshadayRole;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const canSeeMembers = papel !== "membro";
  const canSeeFinance = papel === "admin" || papel === "tesouraria";
  const canManageContent = papel !== "membro";
  const canManageAccess = papel === "admin";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const oldOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const mainNav = useMemo(
    () => [
      { href: "/elshaday/pregacoes", label: "Palavras", icon: Mic2 },
      { href: "/elshaday/eventos", label: "Agenda", icon: CalendarDays },
      { href: "/elshaday/gestao", label: "Home", icon: Home, exact: true },
      { href: "/elshaday/contribuir", label: "Contribua", icon: HandHeart },
      { href: "#mais", label: "Mais", icon: Menu, action: true }
    ],
    []
  );

  const moreItems = [
    { href: "/elshaday/biblia", label: "Bíblia", icon: BookOpen },
    ...(canSeeMembers
      ? [{ href: "/elshaday/membros", label: "Membros", icon: UsersRound }]
      : []),
    ...(canSeeFinance
      ? [
          { href: "/elshaday/financeiro", label: "Dízimos e ofertas", icon: HandCoins },
          {
            href: "/elshaday/financeiro/relatorios",
            label: "Relatórios financeiros",
            icon: FileBarChart
          }
        ]
      : []),
    ...(canManageContent
      ? [{ href: "/elshaday/configuracoes", label: "Configurações", icon: Settings2 }]
      : []),
    ...(canManageAccess
      ? [{ href: "/elshaday/acessos", label: "Acessos e perfis", icon: ShieldCheck }]
      : [])
  ];

  const initials = usuarioNome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const sheet = mounted
    ? createPortal(
        <div
          className={
            "fixed inset-0 z-[10000] lg:hidden " +
            (open ? "pointer-events-auto" : "pointer-events-none")
          }
          aria-hidden={!open}
        >
          <button
            aria-label="Fechar menu"
            className={
              "absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] transition-opacity duration-300 " +
              (open ? "opacity-100" : "opacity-0")
            }
            onClick={() => setOpen(false)}
            type="button"
          />

          <section
            aria-label="Menu mais"
            className={
              "absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[30px] bg-[#f7f8f4] shadow-[0_-20px_50px_rgba(15,23,42,.22)] transition-transform duration-300 ease-out " +
              (open ? "translate-y-0" : "translate-y-full")
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-slate-300" />
            <div className="flex items-center justify-between px-5 pb-4 pt-4">
              <div>
                <p className="text-xl font-black tracking-tight text-slate-950">Menu mais</p>
              </div>
              <button
                aria-label="Fechar menu"
                className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
              <div className="rounded-[24px] border border-emerald-950/10 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid size-14 shrink-0 place-items-center rounded-full bg-[#123d2d] text-base font-black text-[#f3d58e]">
                    {initials || <UserRound size={22} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-black text-slate-950">{usuarioNome}</p>
                    <p className="mt-0.5 text-sm font-semibold text-[#176445]">{ROLE_LABEL[papel]}</p>
                    <p className="mt-1 truncate text-xs text-slate-600">{igrejaNome}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {moreItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    className="flex min-h-14 items-center gap-3 rounded-[18px] border border-slate-200/80 bg-white px-4 shadow-sm transition active:scale-[.99] sm:min-h-16 sm:gap-4 sm:rounded-[20px]"
                    href={href}
                    key={href}
                  >
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#123d2d]">
                      <Icon size={21} />
                    </div>
                    <span className="flex-1 font-black text-slate-900">{label}</span>
                    <ChevronRight className="text-slate-600" size={20} />
                  </Link>
                ))}
              </div>

              <div className="mt-4 grid gap-2">
                <Link
                  className="flex min-h-12 items-center gap-3 rounded-[18px] border border-emerald-300 bg-emerald-50 px-4 font-black !text-[#123d2d]"
                  href="/elshaday/publico"
                  style={{ color: "#123d2d" }}
                >
                  <Church size={19} />
                  Ver página pública
                </Link>
                <Link
                  className="flex min-h-12 items-center gap-3 rounded-[18px] border border-slate-300 bg-white px-4 font-black !text-slate-800"
                  href="/dashboard"
                  style={{ color: "#1e293b" }}
                >
                  <ArrowLeft size={19} />
                  MBA Labs
                </Link>
                <form action="/sair" method="post">
                  <button
                    className="flex min-h-12 w-full items-center gap-3 rounded-[18px] border border-red-200 bg-red-50 px-4 text-left font-black !text-red-700"
                    type="submit"
                  >
                    <LogOut size={19} />
                    Sair do sistema
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-[#f7f8f4]/95 px-4 py-3 backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            aria-label="Ir para a Home"
            className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-[#123d2d] text-[#f3d58e] shadow-sm"
            href="/elshaday/gestao"
          >
            <Church size={25} strokeWidth={2.2} />
          </Link>
          <Link className="min-w-0 flex-1" href="/elshaday/gestao">
            <p className="truncate text-[20px] font-black leading-tight tracking-tight text-slate-950">
              Elshaday
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-600">{igrejaNome}</p>
          </Link>
          <form action="/sair" method="post">
            <button
              aria-label="Sair do sistema"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-3 font-black !text-red-700 shadow-sm"
              type="submit"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </form>
        </div>
      </header>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(15,23,42,.10)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {mainNav.map(({ href, label, icon: Icon, exact, action }) => {
            const active = action
              ? open
              : exact
                ? pathname === href
                : pathname === href || pathname.startsWith(href + "/");

            if (action) {
              return (
                <button
                  aria-label="Abrir menu mais"
                  className="flex min-h-[62px] flex-col items-center justify-center gap-1"
                  key={label}
                  onClick={() => setOpen(true)}
                  type="button"
                >
                  <Icon
                    className={active ? "text-[#123d2d]" : "text-slate-600"}
                    size={23}
                    strokeWidth={active ? 2.6 : 2}
                  />
                  <span className={"text-[11px] font-bold " + (active ? "text-[#123d2d]" : "text-slate-600")}>
                    {label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                className="flex min-h-[62px] flex-col items-center justify-center gap-1"
                href={href}
                key={href}
              >
                <Icon
                  className={active ? "text-[#123d2d]" : "text-slate-600"}
                  fill={active && label === "Home" ? "currentColor" : "none"}
                  size={23}
                  strokeWidth={active ? 2.6 : 2}
                />
                <span className={"text-[11px] font-bold " + (active ? "text-[#123d2d]" : "text-slate-600")}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {sheet}
    </>
  );
}
