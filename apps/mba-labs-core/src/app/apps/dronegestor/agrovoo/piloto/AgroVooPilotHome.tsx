"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {ArrowRight,BookOpen,Calculator,ClipboardList,Clock,Folder,History,MapPin,RefreshCw,Wifi,WifiOff} from "lucide-react";
import {AgroDocDroneIcon as Drone} from "../../AgroDocDroneIcon";
import {useAgroData,ROOT} from "../../AgroDocUi";
import {ownPilotOrders,pilotOrderState,sortPilotOrders,pilotOrderHref,type PilotOrder} from "@/lib/agrovoo-pilot-view";
import {formatFinanceDate} from "@/lib/agrovoo-finance";

export function AgroVooPilotHome({userId,userName}:{userId:string;userName:string}){
 const source=useAgroData<{ok:boolean;items:PilotOrder[];canManage:boolean}>("/api/dronegestor/cadastros?type=os");
 const [online,setOnline]=useState<boolean|null>(null);
 const [filter,setFilter]=useState<"ativas"|"todas">("ativas");
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};},[]);
 useEffect(()=>{const refresh=()=>source.refresh();window.addEventListener("dronegestor:cadastros-updated",refresh);return()=>window.removeEventListener("dronegestor:cadastros-updated",refresh);},[source.refresh]);
 const authorized=source.data?.ok===true&&source.data.canManage===false&&Array.isArray(source.data.items);
 const orders=authorized?sortPilotOrders(ownPilotOrders(source.data!.items,userId)):[];
 const active=orders.filter(o=>pilotOrderState(o.data?.status).active);
 const field=orders.filter(o=>o.data?.status==="em_execucao"||o.data?.status==="suspensa");
 const completed=orders.filter(o=>o.data?.status==="campo_concluido"||o.data?.status==="concluida");
 const selected=filter==="ativas"?active:orders;
 const links=[
 {title:"Minhas OS",desc:"Receber e conferir serviços",href:ROOT+"/gestao",icon:ClipboardList,color:"bg-emerald-50 text-emerald-800"},
 {title:"Modo campo",desc:"Retomar operação selecionada",href:ROOT+"/campo",icon:Drone,color:"bg-teal-50 text-teal-800"},
 {title:"MBA Calda",desc:"Calcular misturas e doses",href:ROOT+"/ferramentas",icon:Calculator,color:"bg-blue-50 text-blue-800"},
 {title:"Documentos",desc:"Mapa e evidências da OS",href:ROOT+"/documentos",icon:Folder,color:"bg-amber-50 text-amber-900"},
 {title:"Histórico",desc:"Consultar minhas aplicações",href:ROOT+"/historico",icon:History,color:"bg-slate-100 text-slate-700"},
 {title:"Piloto Pro",desc:"Consultar guias técnicos",href:ROOT+"/piloto-pro",icon:BookOpen,color:"bg-indigo-50 text-indigo-800"},
 ];
 return <main className="mx-auto grid w-full max-w-5xl gap-3 pb-4 text-slate-900 sm:gap-4">
  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
   <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Área do piloto</p><h1 className="mt-1 text-2xl font-bold">Olá, {userName}</h1><p className="mt-1 text-sm text-slate-600">Acompanhe suas ordens de serviço e operações.</p></div>
   <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold "+(online===false?"bg-amber-100 text-amber-900":online===true?"bg-emerald-50 text-emerald-800":"bg-slate-100 text-slate-600")}>{online===false?<WifiOff size={14}/>:<Wifi size={14}/>} {online===false?"Sem conexão":online===true?"Conectado à rede":"Verificando rede"}</span>
  </header>
  {online===false&&<p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Sem conexão. Consulte a operação já carregada no modo campo; não selecione outra OS até confirmar a sincronização.</p>}
  {source.error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Não foi possível consultar suas OS. {source.error}</p>}
  {source.data&&!authorized&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Não foi possível confirmar a consulta exclusiva do piloto.</p>}
  <section aria-label="Resumo de minhas ordens" className="grid grid-cols-3 gap-2">
   {[{label:"OS ativas",value:active.length},{label:"Em campo / suspensas",value:field.length},{label:"Campo concluído",value:completed.length}].map(m=><div key={m.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 sm:p-3"><span className="block text-[11px] font-semibold leading-4 text-slate-600 sm:text-xs">{m.label}</span><strong className="mt-1 block text-2xl font-bold tabular-nums text-emerald-900">{authorized?m.value:"—"}</strong></div>)}
  </section>
  <section aria-label="Acesso rápido" className="overflow-hidden rounded-lg border border-slate-200 bg-white">
   <h2 className="bg-[#123e38] px-3 py-2.5 text-base font-semibold text-white">Acesso rápido</h2>
   <div className="agro-compact-grid grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">{links.map(({title,desc,href,icon:Icon,color})=><Link key={href} href={href} className="grid min-w-0 gap-1.5 rounded-lg border border-slate-200 p-3 hover:border-emerald-500 focus-visible:outline-emerald-700"><span className={"grid h-9 w-9 place-items-center rounded-lg "+color}><Icon size={21}/></span><strong className="text-sm text-slate-900">{title}</strong><span className="text-xs leading-4 text-slate-600">{desc}</span></Link>)}</div>
  </section>
  <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
   <div className="flex flex-wrap items-center justify-between gap-2 bg-[#123e38] px-3 py-2.5 text-white"><h2 className="text-base font-semibold">Minhas ordens de serviço</h2><button type="button" onClick={()=>source.refresh()} aria-label="Atualizar minhas ordens" className="inline-flex min-h-11 items-center gap-1 rounded-md border border-white/30 px-2 text-xs font-semibold"><RefreshCw size={15}/> Atualizar</button></div>
   <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">{(["ativas","todas"] as const).map(f=><button key={f} type="button" aria-pressed={filter===f} onClick={()=>setFilter(f)} className={"min-h-11 rounded-md border px-3 text-sm font-semibold "+(filter===f?"border-emerald-700 bg-emerald-50 text-emerald-900":"border-slate-200 text-slate-600")}>{f==="ativas"?"Ativas":"Todas"}</button>)}</div>
   {!authorized?<p className="p-4 text-sm text-slate-600">{source.error||source.data?"Consulta indisponível.":"Carregando ordens atribuídas a você..."}</p>:selected.length===0?<p className="p-4 text-sm text-slate-600">Nenhuma OS {filter==="ativas"?"ativa atribuída":"atribuída"} a você.</p>:<div className="grid gap-2 p-3">{selected.map(o=>{const d=o.data??{},state=pilotOrderState(d.status);const area=Number(d.areaHa);return <article key={o.entityId} className="grid min-w-0 gap-2 rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="break-words text-sm">{d.numero||"Ordem de serviço"}</strong><span className={"rounded-full px-2 py-1 text-[11px] font-semibold "+(state.tone==="green"?"bg-emerald-50 text-emerald-800":state.tone==="amber"?"bg-amber-50 text-amber-900":"bg-slate-100 text-slate-700")}>{state.label}</span></div><div className="grid gap-1 text-sm"><span>{d.clienteNome||"Cliente não informado"}</span><span className="flex items-start gap-1 text-xs text-slate-600"><MapPin size={15} className="shrink-0"/>{[d.fazendaNome,d.talhaoNome,d.municipio,d.uf].filter(Boolean).join(" · ")||"Local não informado"}</span><span className="flex items-center gap-1 text-xs text-slate-600"><Clock size={14}/>{formatFinanceDate(d.dataPrevista)} · {Number.isFinite(area)&&area>0?area.toLocaleString("pt-BR",{maximumFractionDigits:3})+" ha planejados":"Área não informada"}</span></div><Link href={pilotOrderHref(o.entityId)} className="flex min-h-11 items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 text-sm font-semibold text-emerald-900">{state.active?"Conferir OS":"Consultar OS"}<ArrowRight size={16}/></Link></article>})}</div>}
  </section>
  <p className="text-xs leading-5 text-slate-500">Consultar uma OS não autoriza o voo. A preparação, a segurança e a autorização legal continuam obrigatórias no fluxo operacional.</p>
 </main>;
}
