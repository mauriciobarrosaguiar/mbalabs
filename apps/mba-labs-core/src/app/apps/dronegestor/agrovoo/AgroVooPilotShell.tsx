"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState,type ReactNode} from "react";
import {BookOpen,Calculator,ChevronDown,ClipboardList,Folder,History,Home,Menu,UserRound,X,CircleHelp,LogOut} from "lucide-react";
import {AgroDocDroneIcon as Drone} from "../AgroDocDroneIcon";
const ROOT="/apps/dronegestor";
const HOME=ROOT+"/agrovoo/piloto";
const links=[
 {label:"Início",href:HOME,icon:Home},
 {label:"Minhas OS",href:ROOT+"/gestao",icon:ClipboardList},
 {label:"Campo",href:ROOT+"/campo",icon:Drone},
 {label:"Calda",href:ROOT+"/ferramentas",icon:Calculator},
 {label:"Documentos",href:ROOT+"/documentos",icon:Folder},
 {label:"Histórico",href:ROOT+"/historico",icon:History},
 {label:"Piloto Pro",href:ROOT+"/piloto-pro",icon:BookOpen},
 {label:"Meu perfil",href:ROOT+"/perfil-operacional",icon:UserRound},
 {label:"Ajuda",href:ROOT+"/ajuda",icon:CircleHelp},
];
export function AgroVooPilotShell({children,userName}:{children:ReactNode;userName:string}){
 const path=usePathname();
 const [open,setOpen]=useState(false);
 useEffect(()=>{setOpen(false);},[path]);
 useEffect(()=>{if(!open)return;const close=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false);};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close);},[open]);
 const selected=(href:string)=>path===href||(href!==HOME&&path.startsWith(href+"/"));
 const navClass="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium";
 return <div className="min-h-screen bg-[#f5f7f8] text-slate-900">
  <header className="sticky top-0 z-[75] flex min-h-16 items-center justify-between gap-2 bg-[#123e38] px-3 text-white shadow-sm sm:px-5">
   <div className="flex min-w-0 items-center gap-2">
    <button type="button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label="Abrir menu do piloto" className="grid h-11 w-11 shrink-0 place-items-center rounded-md hover:bg-white/10 lg:hidden"><Menu size={22}/></button>
    <Link href={HOME} className="flex min-w-0 items-center gap-1.5 text-white"><Drone size={26} className="shrink-0"/><span className="text-lg font-bold tracking-tight">Agro<span className="text-lime-300">Voo</span><small className="ml-1 text-xs font-medium text-white/80">Piloto</small></span></Link>
   </div>
   <div className="flex items-center gap-1"><Link href={ROOT+"/ajuda"} aria-label="Ajuda" className="grid h-11 w-11 place-items-center rounded-md hover:bg-white/10"><CircleHelp size={20}/></Link><details className="relative"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-1 hover:bg-white/10"><UserRound size={21}/><span className="hidden max-w-32 truncate text-sm sm:block">{userName}</span><ChevronDown size={14}/></summary><div className="absolute right-0 top-12 z-[95] grid w-52 rounded-lg border border-slate-200 bg-white p-2 text-slate-900 shadow-lg"><Link href={ROOT+"/perfil-operacional"} className={navClass}>Meu perfil</Link><Link href="/dashboard" className={navClass}>Voltar à MBA Labs</Link><form action="/sair" method="post"><button type="submit" className={navClass+" w-full"}><LogOut size={17}/> Sair</button></form></div></details></div>
  </header>
  {open&&<button type="button" aria-label="Fechar menu do piloto" onClick={()=>setOpen(false)} className="fixed inset-0 z-[79] bg-black/40 lg:hidden"/>}
  <aside className={"fixed bottom-0 left-0 top-0 z-[80] flex w-[250px] max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform lg:visible lg:top-16 lg:z-[65] lg:translate-x-0 "+(open?"visible translate-x-0":"invisible -translate-x-full")}>
   <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4 lg:hidden"><strong className="text-emerald-950">AgroVoo Piloto</strong><button type="button" aria-label="Fechar menu" className="grid h-11 w-11 place-items-center" onClick={()=>setOpen(false)}><X size={22}/></button></div>
   <div className="border-b border-slate-100 p-4"><span className="block text-xs font-semibold uppercase text-slate-500">Minha conta</span><strong className="block break-words text-sm">{userName}</strong></div>
   <nav aria-label="Menu do piloto" className="flex-1 overflow-y-auto p-3">{links.map(({label,href,icon:Icon})=><Link key={href} href={href} aria-current={selected(href)?"page":undefined} onClick={()=>setOpen(false)} className={navClass+(selected(href)?" bg-emerald-100 text-emerald-950":" text-slate-700 hover:bg-slate-50")}><Icon size={19} className="shrink-0"/>{label}</Link>)}</nav>
   <form action="/sair" method="post" className="border-t border-slate-100 p-3"><button type="submit" className={navClass+" w-full text-slate-700"}><LogOut size={18}/> Sair</button></form>
  </aside>
  <div className="min-w-0 px-2 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-5 lg:ml-[250px] lg:pb-6">{children}</div>
  <nav aria-label="Navegação do piloto AgroVoo" className="drone-mobile-nav fixed inset-x-0 bottom-0 z-[70] grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-sm lg:hidden">{links.slice(0,4).map(({label,href,icon:Icon})=><Link key={href} href={href} aria-current={selected(href)?"page":undefined} className={"flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-center text-[10px] font-semibold "+(selected(href)?"bg-emerald-50 text-emerald-900":"text-slate-600")}><Icon size={21}/>{label}</Link>)}<button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-slate-600"><Menu size={21}/>Mais</button></nav>
 </div>;
}
