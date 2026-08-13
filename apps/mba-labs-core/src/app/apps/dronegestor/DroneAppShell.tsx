"use client";

import Link from "next/link";
import { BookOpenCheck, ClipboardList, Drone, FileSpreadsheet, FileText, Home, Map, Settings2, SlidersHorizontal, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

const primary = [
  { href: "/apps/dronegestor", label: "Início", icon: Home, match: (p:string)=>p === "/apps/dronegestor" },
  { href: "/apps/dronegestor/campo", label: "Operação", icon: Drone, match: (p:string)=>p.startsWith("/apps/dronegestor/campo") },
  { href: "/apps/dronegestor/regulacao", label: "Segurança", icon: Map, match: (p:string)=>p.startsWith("/apps/dronegestor/regulacao") },
  { href: "/apps/dronegestor/fichas", label: "Dados", icon: FileText, match: (p:string)=>p.startsWith("/apps/dronegestor/fichas") || p.startsWith("/apps/dronegestor/historico") },
] as const;

const moreItems = [
  { href: "/apps/dronegestor/gestao", title: "Clientes, áreas e OS", text: "Prepare a operação antes de ir ao campo.", icon: ClipboardList },
  { href: "/apps/dronegestor/produtos", title: "Produtos e bulas", text: "Consulte cadastro e revisão técnica.", icon: BookOpenCheck },
  { href: "/apps/dronegestor/equipamentos", title: "Drones e equipamentos", text: "Cadastre os equipamentos e padrões.", icon: Settings2 },
  { href: "/apps/dronegestor/perfil-operacional", title: "Perfil operacional", text: "Dados da empresa, operador e RT.", icon: FileText },
  { href: "/apps/dronegestor/relatorio-mensal", title: "Relatório mensal MAPA", text: "Consolidação mensal e impressão.", icon: FileSpreadsheet },
] as const;

export function DroneAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const publicCalculator = pathname === "/apps/dronegestor/calculadora";
  const printView = pathname.startsWith("/apps/dronegestor/relatorio-mensal");

  if (publicCalculator) return <>{children}</>;

  const moreActive = moreItems.some((item)=>pathname.startsWith(item.href));

  return <div className="min-h-screen pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-0">
    {children}

    <nav className={`drone-mobile-nav fixed inset-x-0 bottom-0 z-[80] border-t border-[#d8e4db] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_26px_rgba(4,50,35,.08)] backdrop-blur-xl md:hidden ${printView ? "print:hidden" : ""}`} aria-label="Navegação do DroneGestor">
      <div className="mx-auto grid h-[74px] max-w-lg grid-cols-5">
        {primary.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className={`flex min-w-0 flex-col items-center justify-center gap-1 no-underline ${active ? "text-[#087a55]" : "text-[#6d7b74]"}`}>
            <Icon size={23} strokeWidth={active ? 2.5 : 2}/>
            <span className="text-[11px] font-bold leading-none">{item.label}</span>
          </Link>;
        })}
        <button type="button" onClick={()=>setMoreOpen(true)} className={`flex min-w-0 flex-col items-center justify-center gap-1 ${moreActive ? "text-[#087a55]" : "text-[#6d7b74]"}`}>
          <SlidersHorizontal size={23} strokeWidth={moreActive ? 2.5 : 2}/>
          <span className="text-[11px] font-bold leading-none">Mais</span>
        </button>
      </div>
    </nav>

    {moreOpen && <div className="fixed inset-0 z-[120] flex items-end bg-slate-950/40 backdrop-blur-[2px] md:hidden" onClick={()=>setMoreOpen(false)}>
      <section className="w-full rounded-t-[30px] bg-[#f7faf5] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl" onClick={(e)=>e.stopPropagation()}>
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#087a55]">DroneGestor</p><h2 className="text-xl font-black text-[#103d2f]">Mais opções</h2></div>
            <button type="button" aria-label="Fechar" onClick={()=>setMoreOpen(false)} className="grid size-10 place-items-center rounded-full border border-[#dbe6de] bg-white text-slate-600"><X size={19}/></button>
          </div>
          <div className="grid gap-2">
            {moreItems.map((item)=>{ const Icon=item.icon; return <Link key={item.href} href={item.href} onClick={()=>setMoreOpen(false)} className="flex items-center gap-3 rounded-2xl border border-[#dce8df] bg-white p-3 no-underline shadow-sm">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e9f5ed] text-[#087a55]"><Icon size={21}/></span>
              <span className="min-w-0"><strong className="block text-sm font-black text-[#103d2f]">{item.title}</strong><span className="mt-0.5 block text-xs leading-4 text-[#708077]">{item.text}</span></span>
            </Link>; })}
          </div>
        </div>
      </section>
    </div>}
  </div>;
}
