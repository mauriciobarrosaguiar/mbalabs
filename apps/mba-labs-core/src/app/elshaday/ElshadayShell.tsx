import type { ReactNode } from "react";
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
  QrCode,
  Settings2,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { elshadayRoleLabel, type ElshadayRole } from "@/lib/elshaday-role";
import { ElshadayMobileAppChrome } from "./ElshadayMobileAppChrome";

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
  const canSeeMembers = papel !== "membro";
  const canSeeFinance = papel === "admin" || papel === "tesouraria";
  const canManageContent = papel !== "membro";
  const canManageAccess = papel === "admin";
  const nav = [
    { href: "/elshaday/gestao", label: "Início", icon: Home },
    ...(canSeeMembers ? [{ href: "/elshaday/membros", label: "Membros", icon: UsersRound }] : []),
    ...(canSeeFinance ? [
      { href: "/elshaday/financeiro", label: "Dízimos e ofertas", icon: HandCoins },
      { href: "/elshaday/financeiro/relatorios", label: "Relatórios financeiros", icon: FileBarChart }
    ] : []),
    { href: "/elshaday/contribuir", label: "Contribuir via PIX", icon: QrCode },
    { href: "/elshaday/eventos", label: "Cultos e eventos", icon: CalendarDays },
    { href: "/elshaday/pregacoes", label: "Pregações", icon: Mic2 },
    { href: "/elshaday/biblia", label: "Bíblia", icon: BookOpen },
    ...(canManageContent ? [{ href: "/elshaday/configuracoes", label: "Configurações", icon: Settings2 }] : []),
    ...(canManageAccess ? [{ href: "/elshaday/acessos", label: "Acessos e perfis", icon: ShieldCheck }] : [])
  ];

  return (
    <div className="elshaday-app min-h-screen overflow-x-hidden bg-[#f3f6f1] text-slate-900">
      <div className="mx-auto grid min-h-screen w-full min-w-0 max-w-[1600px] lg:grid-cols-[285px_minmax(0,1fr)]">
        <aside className="hidden border-r border-emerald-950/10 bg-[#123d2d] p-5 text-white lg:flex lg:flex-col">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#d4aa54] text-[#123d2d]">
              <Church size={27} strokeWidth={2.4} />
            </div>
            <h1 className="mt-4 text-2xl font-black">Elshaday Gestão</h1>
            <p className="mt-2 text-sm leading-6 text-emerald-50/85">{igrejaNome}</p>
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
            <p className="mt-1 text-sm text-emerald-100/85">{elshadayRoleLabel(papel)}</p>
            <Link className="mt-4 flex items-center gap-2 text-sm font-bold text-[#f1d79d]" href="/elshaday/publico">
              <Church size={16} />
              Ver página pública
            </Link>
            <Link className="mt-3 flex items-center gap-2 text-sm font-bold text-[#f1d79d]" href="/dashboard">
              <ArrowLeft size={16} />
              Voltar ao MBA Labs
            </Link>
            <form action="/sair" className="mt-3" method="post">
              <button className="flex w-full items-center gap-2 text-sm font-bold text-white" type="submit">
                <LogOut size={16} />
                Sair do sistema
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 max-w-full overflow-x-hidden">
          <ElshadayMobileAppChrome
            igrejaNome={igrejaNome}
            usuarioNome={usuarioNome}
            papel={papel}
          />

          <main className="min-w-0 max-w-full overflow-x-hidden px-3 pb-28 pt-4 sm:px-6 sm:pt-6 lg:p-8">{children}</main>
        </div>
      </div>
      <style>{`
        .elshaday-app input,
        .elshaday-app select,
        .elshaday-app textarea {
          box-sizing: border-box;
          min-width: 0;
          max-width: 100%;
          color: #0f172a;
          -webkit-text-fill-color: #0f172a;
          opacity: 1;
          color-scheme: light;
        }
        .elshaday-app input::placeholder,
        .elshaday-app textarea::placeholder {
          color: #64748b;
          -webkit-text-fill-color: #64748b;
          opacity: 1;
        }
        .elshaday-app select option {
          color: #0f172a;
          background: #ffffff;
        }
        .elshaday-app h1,
        .elshaday-app h2,
        .elshaday-app h3,
        .elshaday-app p,
        .elshaday-app span,
        .elshaday-app a,
        .elshaday-app button {
          overflow-wrap: anywhere;
        }
        .elshaday-app img,
        .elshaday-app video {
          max-width: 100%;
          height: auto;
        }
        @media (max-width: 1023px) {
          .elshaday-app input:not([type="file"]),
          .elshaday-app select,
          .elshaday-app textarea {
            font-size: 16px;
          }
          .elshaday-app input[type="file"] {
            width: 100%;
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}
