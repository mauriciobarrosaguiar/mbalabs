import type { ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  Church,
  FileBarChart,
  HandCoins,
  Home,
  LogOut,
  Mic2,
  QrCode,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import type { ElshadayRole } from "@/lib/elshaday";
import { roleLabel } from "@/lib/elshaday";

export function ElshadayShell({
  children,
  igrejaNome,
  usuarioNome,
  papel
}: {
  children: ReactNode;
  igrejaNome: string;
  usuarioNome: string;
  papel: ElshadayRole;
}) {
  const canSeeMembers = ["admin", "pastor", "secretaria", "lider"].includes(papel);
  const canSeeFinance = papel === "admin" || papel === "tesouraria";
  const canManageAccess = papel === "admin";
  const nav = [
    { href: "/elshaday", label: "Início", icon: Home },
    ...(canSeeMembers ? [{ href: "/elshaday/membros", label: "Membros", icon: UsersRound }] : []),
    ...(canSeeFinance ? [
      { href: "/elshaday/financeiro", label: "Dízimos e ofertas", icon: HandCoins },
      { href: "/elshaday/financeiro/relatorios", label: "Relatórios financeiros", icon: FileBarChart }
    ] : []),
    { href: "/elshaday/contribuir", label: "Contribuir via PIX", icon: QrCode },
    { href: "/elshaday/eventos", label: "Cultos e eventos", icon: CalendarDays },
    { href: "/elshaday/pregacoes", label: "Pregações", icon: Mic2 },
    { href: "/elshaday/biblia", label: "Bíblia", icon: BookOpen },
    ...(canManageAccess ? [{ href: "/elshaday/acessos", label: "Acessos e perfis", icon: ShieldCheck }] : [])
  ];

  return (
    <div className="min-h-screen bg-[#f3f6f1] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[285px_1fr]">
        <aside className="hidden border-r border-emerald-950/10 bg-[#123d2d] p-5 text-white lg:flex lg:flex-col">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#d4aa54] text-[#123d2d]">
              <Church size={27} strokeWidth={2.4} />
            </div>
            <p className="mt-4 text-xs font-black uppercase tracking-[.18em] text-emerald-100/70">
              MBA Labs
            </p>
            <h1 className="mt-1 text-2xl font-black">Elshaday Gestão</h1>
            <p className="mt-2 text-sm leading-6 text-emerald-50/75">{igrejaNome}</p>
          </div>

          <nav className="mt-6 grid gap-2">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                className="flex min-h-12 items-center gap-3 rounded-2xl px-4 font-bold text-emerald-50/85 transition hover:bg-white/10 hover:text-white"
                href={href}
                key={href}
              >
                <Icon size={20} />
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="font-black">{usuarioNome}</p>
            <p className="mt-1 text-sm text-emerald-100/70">{roleLabel(papel)}</p>
            <Link className="mt-4 flex items-center gap-2 text-sm font-bold text-[#f1d79d]" href="/dashboard">
              <LogOut size={16} />
              Voltar ao MBA Labs
            </Link>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-emerald-950/10 bg-[#f3f6f1]/95 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#123d2d] text-[#f1d79d]">
                  <Church size={22} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-black">Elshaday Gestão</p>
                  <p className="truncate text-xs text-slate-500">{igrejaNome}</p>
                </div>
              </div>
              <Link className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black" href="/dashboard">
                MBA Labs
              </Link>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {nav.map(({ href, label, icon: Icon }) => (
                <Link
                  className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
                  href={href}
                  key={href}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
