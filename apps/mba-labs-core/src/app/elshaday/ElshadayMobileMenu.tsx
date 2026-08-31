"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Church,
  FileBarChart,
  HandCoins,
  Home,
  LogOut,
  Mic2,
  MoreVertical,
  QrCode,
  ShieldCheck,
  UsersRound,
  X
} from "lucide-react";
import type { ElshadayRole } from "@/lib/elshaday";

const ROLE_LABEL: Record<ElshadayRole, string> = {
  admin: "Administrador",
  pastor: "Pastor",
  tesouraria: "Tesouraria",
  secretaria: "Secretaria",
  lider: "Líder",
  membro: "Membro"
};

export function ElshadayMobileMenu({
  igrejaNome,
  usuarioNome,
  papel
}: {
  igrejaNome: string;
  usuarioNome: string;
  papel: ElshadayRole;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const canSeeMembers = ["admin", "pastor", "secretaria", "lider"].includes(papel);
  const canSeeFinance = papel === "admin" || papel === "tesouraria";
  const canManageAccess = papel === "admin";

  const nav = [
    { href: "/elshaday", label: "Início", icon: Home },
    ...(canSeeMembers ? [{ href: "/elshaday/membros", label: "Membros", icon: UsersRound }] : []),
    ...(canSeeFinance
      ? [
          { href: "/elshaday/financeiro", label: "Dízimos e ofertas", icon: HandCoins },
          { href: "/elshaday/financeiro/relatorios", label: "Relatórios financeiros", icon: FileBarChart }
        ]
      : []),
    { href: "/elshaday/contribuir", label: "Contribuir via PIX", icon: QrCode },
    { href: "/elshaday/eventos", label: "Cultos e eventos", icon: CalendarDays },
    { href: "/elshaday/pregacoes", label: "Pregações", icon: Mic2 },
    { href: "/elshaday/biblia", label: "Bíblia", icon: BookOpen },
    ...(canManageAccess ? [{ href: "/elshaday/acessos", label: "Acessos e perfis", icon: ShieldCheck }] : [])
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const drawer = mounted
    ? createPortal(
        <div
          aria-hidden={!open}
          className={
            "fixed inset-0 z-[9999] lg:hidden " +
            (open ? "pointer-events-auto" : "pointer-events-none")
          }
        >
          <button
            aria-label="Fechar menu"
            className={
              "absolute inset-0 h-full w-full bg-slate-950/50 transition-opacity duration-300 " +
              (open ? "opacity-100" : "opacity-0")
            }
            onClick={() => setOpen(false)}
            type="button"
          />

          <aside
            aria-label="Menu Elshaday"
            className={
              "absolute inset-y-0 right-0 flex h-[100dvh] w-[86vw] max-w-[360px] flex-col overflow-hidden bg-[#123d2d] text-white shadow-2xl transition-transform duration-300 ease-out " +
              (open ? "translate-x-0" : "translate-x-full")
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.16em] text-[#f1d79d]">Menu</p>
                <p className="mt-2 truncate text-xl font-black">Elshaday Gestão</p>
                <p className="mt-1 truncate text-sm text-emerald-100/70">{igrejaNome}</p>
              </div>
              <button
                aria-label="Fechar menu"
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 transition hover:bg-white/15"
                onClick={() => setOpen(false)}
                type="button"
              >
                <X size={22} />
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="grid gap-1.5">
                {nav.map(({ href, label, icon: Icon }) => (
                  <Link
                    className="flex min-h-12 items-center gap-3 rounded-2xl px-4 font-bold text-emerald-50 transition hover:bg-white/10"
                    href={href}
                    key={href}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </nav>

            <div className="shrink-0 border-t border-white/10 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="truncate font-black">{usuarioNome}</p>
                <p className="mt-1 text-sm text-emerald-100/70">{ROLE_LABEL[papel]}</p>
              </div>

              <Link
                className="mt-3 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-[#f1d79d]"
                href="/dashboard"
                onClick={() => setOpen(false)}
              >
                <ArrowLeft size={17} />
                MBA Labs
              </Link>

              <form action="/sair" method="post">
                <button
                  className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold text-white"
                  type="submit"
                >
                  <LogOut size={17} />
                  Sair do sistema
                </button>
              </form>
            </div>
          </aside>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link className="flex min-w-0 items-center gap-3" href="/elshaday">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#123d2d] text-[#f1d79d]">
            <Church size={23} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black leading-tight">Elshaday Gestão</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{igrejaNome}</p>
          </div>
        </Link>

        <button
          aria-label="Abrir menu"
          aria-expanded={open}
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-emerald-950/10 bg-white text-[#123d2d] shadow-sm"
          onClick={() => setOpen(true)}
          type="button"
        >
          <MoreVertical size={24} />
        </button>
      </div>

      {drawer}
    </>
  );
}
