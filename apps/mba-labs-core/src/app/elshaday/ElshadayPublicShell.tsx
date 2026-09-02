import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Church, HandCoins, LogIn, ShieldCheck, UserRoundPlus } from "lucide-react";

export function ElshadayPublicShell({
  children,
  igrejaNome,
  igrejaNomeCurto,
  hasInternalAccess
}: {
  children: ReactNode;
  igrejaNome: string;
  igrejaNomeCurto: string;
  hasInternalAccess: boolean;
}) {
  const internalHref = hasInternalAccess
    ? "/elshaday/gestao"
    : "/login?next=%2Felshaday%2Fgestao";
  const internalLabel = hasInternalAccess ? "Área interna" : "Entrar";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f3f6f1] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-[#123d2d]/95 text-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link className="flex min-w-0 items-center gap-3" href="/elshaday">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#d4aa54] text-[#123d2d]">
              <Church size={22} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-black">{igrejaNomeCurto}</span>
              <span className="block text-[11px] font-semibold text-emerald-50/85">Palmas - TO</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link className="rounded-xl px-3 py-2 text-sm font-bold text-emerald-50/85 hover:bg-white/10" href="/elshaday#agenda">
              Agenda
            </Link>
            <Link className="rounded-xl px-3 py-2 text-sm font-bold text-emerald-50/85 hover:bg-white/10" href="/elshaday/contribuir">
              Contribuir
            </Link>
            <Link className="rounded-xl px-3 py-2 text-sm font-bold text-emerald-50/85 hover:bg-white/10" href="/cadastro-membro">
              Cadastro
            </Link>
            <Link className="ml-2 inline-flex items-center gap-2 rounded-xl bg-[#d4aa54] px-4 py-2 text-sm font-black text-[#123d2d]" href={internalHref}>
              {hasInternalAccess ? <ShieldCheck size={16} /> : <LogIn size={16} />}
              {internalLabel}
            </Link>
          </nav>

          <Link className="inline-flex items-center gap-2 rounded-xl bg-[#d4aa54] px-3 py-2 text-sm font-black text-[#123d2d] md:hidden" href={internalHref}>
            {hasInternalAccess ? <ShieldCheck size={16} /> : <LogIn size={16} />}
            {internalLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-130px)] min-w-0 max-w-6xl overflow-x-hidden px-4 py-4 sm:px-6 sm:py-8">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-950/10 bg-white/95 px-2 py-2 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          <Link className="grid place-items-center gap-1 py-1 text-[11px] font-black text-[#123d2d]" href="/elshaday">
            <Church size={20} /> Início
          </Link>
          <Link className="grid place-items-center gap-1 py-1 text-[11px] font-black text-[#123d2d]" href="/elshaday#agenda">
            <CalendarDays size={20} /> Agenda
          </Link>
          <Link className="grid place-items-center gap-1 py-1 text-[11px] font-black text-[#123d2d]" href="/elshaday/contribuir">
            <HandCoins size={20} /> Contribuir
          </Link>
          <Link className="grid place-items-center gap-1 py-1 text-[11px] font-black text-[#123d2d]" href="/cadastro-membro">
            <UserRoundPlus size={20} /> Membro
          </Link>
        </div>
      </nav>

      <footer className="mb-16 border-t border-emerald-950/10 bg-white px-4 py-6 text-center text-xs text-slate-600 md:mb-0">
        {igrejaNome}
      </footer>
    </div>
  );
}
