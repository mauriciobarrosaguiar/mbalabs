"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, BookOpen, Calculator, ChevronDown, ClipboardCheck, CircleHelp, FileText, Folder, Home, Layers, Leaf, LogOut, Menu, Settings, ShieldCheck, UserRound, Users, X, ChartNoAxesColumn } from "lucide-react";
import { AgroDocDroneIcon as Drone } from "../AgroDocDroneIcon";

const ROOT = "/apps/dronegestor";
const items = [
  { label: "Principal", links: [{ title: "Dashboard", path: "agrovoo", icon: Home }] },
  { label: "Cadastros", links: [
    { title: "Clientes", path: "gestao?tab=cliente", icon: Users },
    { title: "Propriedades", path: "gestao?tab=fazenda", icon: Layers },
    { title: "Aeronaves e equipamentos", path: "equipamentos", icon: Drone },
    { title: "Pilotos", path: "pilotos", icon: UserRound },
    { title: "Equipe", path: "equipe", icon: Users },
    { title: "Defensivos e AGROFIT", path: "produtos", icon: Leaf },
    { title: "Visão dos cadastros", path: "cadastros", icon: Folder },
  ] },
  { label: "Operacional", links: [
    { title: "Ordens de serviço", path: "gestao", icon: ClipboardCheck },
    { title: "Modo campo", path: "campo", icon: Drone },
    { title: "Histórico", path: "historico", icon: Folder },
    { title: "Fichas de aplicação", path: "fichas", icon: FileText },
    { title: "Conferência", path: "conferencia", icon: ClipboardCheck },
    { title: "Relatório mensal MAPA", path: "relatorio-mensal", icon: ChartNoAxesColumn },
  ] },
  { label: "Documentação", links: [
    { title: "Regularização", path: "diagnostico", icon: ShieldCheck },
    { title: "Documentos", path: "documentos", icon: Folder },
    { title: "Legislação e fontes", path: "regulacao", icon: BookOpen },
  ] },
  { label: "Ferramentas", links: [
    { title: "Calculadora de calda", path: "ferramentas", icon: Calculator },
    { title: "Piloto Pro", path: "piloto-pro", icon: BookOpen },
  ] },
  { label: "Conta", links: [
    { title: "Perfil operacional", path: "perfil-operacional", icon: UserRound },
    { title: "Configurações", path: "configuracoes", icon: Settings },
    { title: "Ajuda", path: "ajuda", icon: CircleHelp },
  ] },
];

export function AgroVooAdminShell({ children, userName, canAdministerCompany, isSystemAdmin }: { children: ReactNode; userName: string; canAdministerCompany: boolean; isSystemAdmin: boolean }) {
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState(false);
  useEffect(() => { setMobileOpen(false); setNotice(false); }, [pathname]);
  useEffect(() => {
    if (!mobileOpen) return;
    function keydown(event: KeyboardEvent) { if (event.key === "Escape") setMobileOpen(false); }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [mobileOpen]);
  const linkClass = "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 focus-visible:outline-emerald-600";
  return <div className="agro-shell agrovoo-admin min-h-screen bg-slate-50">
    <header className="sticky top-0 z-[75] flex min-h-16 items-center justify-between gap-2 bg-[#123e38] px-3 py-2 text-white shadow-sm sm:px-5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setMobileOpen(v => !v)} aria-label="Abrir menu AgroVoo" aria-expanded={mobileOpen} className="grid h-11 w-11 shrink-0 place-items-center rounded-md hover:bg-white/15 lg:hidden"><Menu size={22}/></button>
        <button type="button" onClick={() => setCompact(v => !v)} aria-label={compact ? "Expandir menu AgroVoo" : "Recolher menu AgroVoo"} aria-expanded={!compact} className="hidden h-11 w-11 shrink-0 place-items-center rounded-md hover:bg-white/15 lg:grid"><Menu size={22}/></button>
        <Link href={ROOT + "/agrovoo"} className="flex items-center gap-2 text-xl font-bold tracking-tight text-white"><Drone size={27}/><span>Agro<span className="text-lime-300">Voo</span></span></Link>
      </div>
      <div className="flex items-center gap-1 sm:gap-3">
        <Link href={ROOT + "/diagnostico"} className="hidden min-h-11 items-center gap-2 px-2 text-sm font-semibold text-white sm:flex"><ShieldCheck size={18}/> Regularização</Link>
        <Link href={ROOT + "/ajuda"} className="grid h-11 w-11 place-items-center rounded-md text-white hover:bg-white/15" aria-label="Ajuda"><CircleHelp size={21}/></Link>
        <div className="relative">
          <button type="button" onClick={() => setNotice(v => !v)} aria-label="Pendências" aria-expanded={notice} className="grid h-11 w-11 place-items-center rounded-md hover:bg-white/15"><Bell size={21}/></button>
          {notice && <div className="absolute right-0 top-12 z-[95] grid w-60 gap-1 rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-lg"><strong>Pendências</strong><Link onClick={() => setNotice(false)} className={linkClass} href={ROOT + "/diagnostico"}>Documentos e vencimentos</Link><Link onClick={() => setNotice(false)} className={linkClass} href={ROOT + "/conferencia"}>Conferência operacional</Link></div>}
        </div>
        <details className="relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-2 hover:bg-white/15"><UserRound size={22}/><span className="hidden max-w-36 truncate text-sm font-semibold md:block">{userName}</span><ChevronDown size={14}/></summary>
          <div className="absolute right-0 top-12 z-[95] grid w-56 rounded-lg border border-slate-200 bg-white p-2 text-slate-900 shadow-lg"><Link className={linkClass} href={ROOT + "/perfil-operacional"}>Meu perfil</Link><Link className={linkClass} href="/dashboard">Voltar à MBA Labs</Link><form action="/sair" method="post"><button type="submit" className={linkClass + " w-full"}><LogOut size={18}/> Sair</button></form></div>
        </details>
      </div>
    </header>
    {mobileOpen && <button type="button" aria-label="Fechar menu" className="fixed inset-0 z-[79] bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)}/>}
    <aside className={"fixed bottom-0 left-0 top-0 z-[80] flex w-[270px] max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform lg:top-16 lg:z-[65] lg:max-w-none lg:translate-x-0 " + (mobileOpen ? "translate-x-0 " : "-translate-x-full ") + (compact ? "lg:w-[76px]" : "lg:w-[250px]")}>
      <div className="flex min-h-16 items-center justify-between border-b border-slate-100 px-4 lg:hidden"><strong className="text-lg text-emerald-950">AgroVoo</strong><button type="button" className="grid h-11 w-11 place-items-center" onClick={() => setMobileOpen(false)} aria-label="Fechar menu AgroVoo"><X/></button></div>
      <nav aria-label="Menu de gestão AgroVoo" className="flex-1 overflow-y-auto p-3">
        {items.map(group => <details key={group.label} open={group.label === "Principal" || group.label === "Operacional" || compact} className="mb-3">
          <summary className={"flex min-h-9 cursor-pointer list-none items-center justify-between gap-1 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 " + (compact ? "lg:justify-center lg:px-0" : "")}><span className={compact ? "lg:sr-only" : ""}>{group.label}</span><ChevronDown size={14}/></summary>
          {group.links.map(({title,path,icon:Icon}) => { const selected = path === "agrovoo" && pathname === ROOT + "/agrovoo"; return <Link key={path} title={title} href={ROOT + "/" + path} onClick={() => setMobileOpen(false)} aria-current={selected ? "page" : undefined} className={linkClass + (selected ? " bg-emerald-100 !text-emerald-950" : "") + (compact ? " lg:justify-center lg:px-0" : "")}><Icon size={19} className="shrink-0"/><span className={compact ? "lg:sr-only" : ""}>{title}</span></Link>; })}
        </details>)}
        {canAdministerCompany && <Link href={ROOT + "/funcionarios"} title="Funcionários e acessos" className={linkClass}><Users size={19}/><span className={compact ? "lg:sr-only" : ""}>Funcionários e acessos</span></Link>}
        {isSystemAdmin && <Link href={ROOT + "/administracao"} title="Administração do sistema" className={linkClass}><ShieldCheck size={19}/><span className={compact ? "lg:sr-only" : ""}>Administração do sistema</span></Link>}
      </nav>
      <div className={"border-t border-slate-200 bg-slate-50 p-3 text-slate-600 " + (compact ? "lg:hidden" : "")}><small className="block text-[11px] font-semibold uppercase">Conectado como</small><strong className="block truncate text-sm text-slate-900">{userName}</strong><Link className="mt-2 inline-flex min-h-9 items-center text-xs font-semibold text-emerald-800" href={ROOT}>Painel anterior</Link></div>
    </aside>
    <div className={"min-w-0 transition-[margin] " + (compact ? "lg:ml-[76px]" : "lg:ml-[250px]")}>
      <div className="mx-auto max-w-[1600px] p-3 sm:p-5">{children}</div>
    </div>
  </div>;
}
