"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {BookOpen,ClipboardList,FileText,FlaskConical,Grid3X3,History,MapPin,Plus,RefreshCw,Search,UserRound} from "lucide-react";
import {AgroDocDroneIcon as Drone} from "../../AgroDocDroneIcon";
import {useAgroData,ROOT} from "../../AgroDocUi";
import {ownPilotOrders,pilotOrderState,sortPilotOrders,pilotOrderHref,type PilotOrder} from "@/lib/agrovoo-pilot-view";
import {usePilotPendingSync} from "./usePilotPendingSync";
import {formatFinanceDate} from "@/lib/agrovoo-finance";

type Application={id:string;usuario_id?:string;created_at?:string;detalhes?:{operationId?:string;finalizedAt?:string;summary?:{ordemServicoId?:string;ordemServicoNumero?:string;areaConcluidaHa?:number;iniciadaEm?:string;finalizadaEm?:string;piloto?:string;clienteNome?:string}}};
type Product={nome?:string;dose?:number;unidade?:string};
type Plan={drone?:string;equipamentoNome?:string;registroAnac?:string;produtos?:Product[]};
const fmt=(v:number)=>v.toLocaleString("pt-BR",{maximumFractionDigits:3});
const day=(v:string)=>{const d=new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("en-CA",{timeZone:"America/Araguaina",year:"numeric",month:"2-digit",day:"2-digit"}).format(d):""};
const time=(v?:string)=>{const d=new Date(v||"");return Number.isFinite(d.getTime())?d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Araguaina"}):"—"};
const panel="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";
const header="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-800";
const primary="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#185a47] px-3 py-2 text-sm font-semibold text-white";
const secondary="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700";
function Field({label,value,icon:Icon}:{label:string;value:string;icon:typeof UserRound}){return <div className="flex min-w-0 items-start gap-2"><Icon size={16} className="mt-1 shrink-0 text-emerald-700"/><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="break-words text-xs font-semibold text-slate-800">{value||"Não informado"}</p></div></div>;}
function ApplicationCard({row}:{row:Application}){const s=row.detalhes?.summary??{};return <article className="grid gap-1.5 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-1"><strong className="text-sm">Aplicação {formatFinanceDate(day(s.iniciadaEm||row.detalhes?.finalizedAt||row.created_at||""))}</strong><span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 bg-emerald-50">Salvo no sistema</span></div><p className="text-xs text-slate-600">OS: {s.ordemServicoNumero||"—"}</p><p className="text-xs text-slate-600">Horário: {time(s.iniciadaEm)} – {time(s.finalizadaEm)}</p><p className="text-xs text-slate-600">Área aplicada: {typeof s.areaConcluidaHa==="number"?fmt(s.areaConcluidaHa)+" ha":"Não informada"}</p><p className="text-xs text-slate-600">Piloto: {s.piloto||"Não informado"}</p></article>;}

export function AgroVooPilotHome({userId,userName,deviceOwner,trainingEnabled=false}:{userId:string;userName:string;deviceOwner:string;trainingEnabled?:boolean}){
 const pending=usePilotPendingSync(deviceOwner);
 const source=useAgroData<{ok:boolean;items:PilotOrder[];canManage:boolean}>("/api/dronegestor/cadastros?type=os");
 const history=useAgroData<{ok:boolean;items:Application[];hasMore:boolean}>("/api/dronegestor/state?history=1&limit=500");
 const [online,setOnline]=useState<boolean|null>(null);
 const [orderId,setOrderId]=useState("");
 const [tab,setTab]=useState<"receituario"|"aplicacoes"|"historico">("receituario");
 const [applicationTab,setApplicationTab]=useState<"lista"|"nova">("lista");
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};},[]);
 useEffect(()=>{const refresh=()=>{source.refresh();history.refresh();};window.addEventListener("dronegestor:cadastros-updated",refresh);return()=>window.removeEventListener("dronegestor:cadastros-updated",refresh);},[source.refresh,history.refresh]);
 const authorized=source.data?.ok===true&&source.data.canManage===false&&Array.isArray(source.data.items);
 const orders=authorized?sortPilotOrders(ownPilotOrders(source.data!.items,userId)):[];
 const active=orders.filter(o=>pilotOrderState(o.data?.status).active);
 const order=orders.find(o=>o.entityId===orderId);
 const d=order?.data;
 const plan=(d?.missaoPlanejada&&typeof d.missaoPlanejada==="object"&&!Array.isArray(d.missaoPlanejada)?d.missaoPlanejada:{}) as Plan;
 const products=Array.isArray(plan.produtos)?plan.produtos:[];
 const historyReady=history.data?.ok===true&&Array.isArray(history.data.items);
 const all=historyReady?history.data!.items.filter(x=>x.usuario_id===userId):[];
 const selected=all.filter(x=>x.detalhes?.summary?.ordemServicoId===order?.entityId&&Boolean(order));
 const today=day(new Date().toISOString());
 const todayRows=all.filter(x=>day(x.detalhes?.summary?.finalizadaEm||x.detalhes?.finalizedAt||"")===today);
 const area=all.reduce((sum,x)=>sum+(typeof x.detalhes?.summary?.areaConcluidaHa==="number"?Math.max(0,x.detalhes.summary.areaConcluidaHa):0),0);
 const fullHistory=historyReady&&!history.data!.hasMore;
 const docs=order?ROOT+"/documentos?osId="+encodeURIComponent(order.entityId):ROOT+"/documentos";
 return <main className="mx-auto grid w-full max-w-lg gap-3 pb-6 text-slate-900 sm:max-w-2xl" aria-label={"Painel de "+userName}>
  <h1 className="sr-only">AgroVoo Piloto</h1>
  <div className="agro-compact-grid grid grid-cols-2 gap-2">
   {[{label:"Aplicações hoje",value:fullHistory?String(todayRows.length):"—",color:"text-blue-700"},{label:"Área aplicada (histórico)",value:fullHistory?fmt(area)+" ha":"—",color:"text-emerald-700"},{label:"Envios pendentes neste aparelho",value:pending===null?"—":String(pending),color:pending?"text-amber-700":"text-slate-700"},{label:"Ordens ativas",value:authorized?String(active.length):"—",color:"text-cyan-700"}].map(m=><div key={m.label} className="grid min-h-[76px] place-content-center gap-1 rounded-xl border border-slate-200 bg-white p-2 text-center shadow-sm"><strong className={"text-lg tabular-nums "+m.color}>{m.value}</strong><span className="text-[11px] text-slate-600">{m.label}</span></div>)}
  </div>
  {online===false&&<p role="status" className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Sem conexão. O modo campo preserva a operação já carregada. Não troque de OS enquanto houver registros pendentes.</p>}
  {pending!==null&&pending>0&&<p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">Existem registros aguardando envio. <Link href={ROOT+"/campo"} className="font-semibold underline">Abrir modo campo para sincronizar</Link>.</p>}
  {history.error&&<p role="alert" className="text-xs text-slate-600">Histórico indisponível. Atualize os dados quando houver conexão.</p>}
  {history.data?.hasMore&&<p className="text-xs text-slate-500">Histórico parcial nesta consulta. Consulte a página de histórico completo para os totais.</p>}
  <section className={panel}>
   <h2 className={header}><ClipboardList size={16} className="text-emerald-700"/> Ordem de referência</h2>
   <div className="grid gap-2 p-3"><label htmlFor="pilot-reference-order" className="flex items-center gap-1 text-xs font-semibold text-slate-700"><Search size={15}/> Ordem de serviço</label>
    <div className="grid grid-cols-[minmax(0,1fr)_52px] gap-2"><select id="pilot-reference-order" className="min-h-11 rounded-md border border-slate-300 bg-white px-2 text-sm" value={order?.entityId||""} onChange={e=>{setOrderId(e.target.value);setApplicationTab("lista");}}><option value="">Escolha uma ordem...</option>{orders.map(o=><option key={o.entityId} value={o.entityId}>{o.data?.numero||"OS"} – {o.data?.clienteNome||"Cliente"}</option>)}</select><button type="button" disabled={online===false} aria-label="Atualizar ordens e aplicações" onClick={()=>{source.refresh();history.refresh();}} className={secondary}><RefreshCw size={17}/></button></div>
    <p className="text-center text-[11px] text-slate-500">Selecione uma ordem ou atualize os dados.</p>
    {source.error&&<p role="alert" className="text-xs text-red-700">Não foi possível consultar suas OS. {source.error}</p>}
    {!authorized&&!source.error&&<p className="text-xs text-slate-500">{source.data?"Consulta indisponível.":"Consultando ordens atribuídas..."}</p>}
    {order&&d&&<div className="grid gap-3 rounded-lg border border-slate-100 p-3 shadow-sm"><Field label="Cliente" value={d.clienteNome||""} icon={UserRound}/><div className="agro-compact-grid grid grid-cols-2 gap-3"><Field label="Propriedade" value={d.fazendaNome||""} icon={MapPin}/><Field label="Talhão / gleba" value={d.talhaoNome||""} icon={Grid3X3}/><Field label="Aeronave" value={plan.registroAnac||plan.drone||plan.equipamentoNome||""} icon={Drone}/><Field label="Cultura" value={String((d as {cultura?:string}).cultura||"")} icon={Grid3X3}/><Field label="Receituário" value={products.length?products.length+" produto(s) no plano":"Consultar documentos"} icon={FileText}/><Field label="Área planejada" value={typeof d.areaHa==="number"?fmt(d.areaHa)+" ha":""} icon={Grid3X3}/></div><p className="text-xs text-slate-600">{pilotOrderState(d.status).label} · {d.dataPrevista?formatFinanceDate(d.dataPrevista):"Sem data prevista"}</p></div>}
   </div>
  </section>
  <div role="group" aria-label="Abas da ordem" className="grid grid-cols-3 gap-1">{([{id:"receituario",label:"Receituário",icon:BookOpen},{id:"aplicacoes",label:"Aplicações",icon:Plus},{id:"historico",label:"Histórico",icon:History}] as const).map(({id,label,icon:Icon})=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)} className={"flex min-h-11 items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold "+(tab===id?"bg-[#185a47] text-white":"text-emerald-800")}><Icon size={14}/>{label}</button>)}</div>
  {tab==="receituario"&&<section className={panel}><h2 className={header}>Receituário da ordem</h2><div className="grid gap-2 p-3">{!order?<p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">Selecione uma ordem de referência para ver o receituário.</p>:<>{products.length?products.map((p,i)=><article key={i} className="rounded-lg border border-slate-200 p-3"><strong className="text-sm">{p.nome||"Produto"}</strong><p className="mt-1 text-xs text-slate-600">Dose prevista</p><strong className="text-sm">{p.dose??"—"} {p.unidade||""}</strong></article>):<p className="rounded-md bg-amber-50 p-3 text-xs">Nenhum produto no planejamento disponível.</p>}<Link href={docs} className={secondary}>Consultar receituário e documentos</Link>{pilotOrderState(d?.status).active&&<Link href={pilotOrderHref(order.entityId)} className={secondary}>Conferir parâmetros e produtos no campo</Link>}<p className="text-[11px] text-slate-500">Dados do planejamento. Alterações continuam sujeitas às permissões do piloto e do RT.</p></>}</div></section>}
  {tab==="aplicacoes"&&<><div className="agro-compact-grid grid grid-cols-2 gap-1 border-b border-slate-200">{(["lista","nova"] as const).map(id=><button type="button" key={id} aria-pressed={applicationTab===id} onClick={()=>setApplicationTab(id)} className={"min-h-11 rounded-t-md border px-2 text-xs font-semibold "+(applicationTab===id?"border-slate-200 bg-white text-slate-800":"border-transparent text-emerald-800")}>{id==="lista"?"Aplicações da ordem":"＋ Nova aplicação"}</button>)}</div><section className={panel}><h2 className={header}>{applicationTab==="lista"?"Aplicações desta ordem":"Nova aplicação"}</h2><div className="grid gap-2 p-3">{!order?<p className="rounded-md bg-amber-50 p-3 text-xs">Selecione uma ordem de referência.</p>:applicationTab==="lista"?<>{!historyReady?<p className="text-xs text-slate-600">Histórico indisponível ou em consulta.</p>:selected.length?selected.map(row=><ApplicationCard key={row.id} row={row}/>):<p className="text-xs text-slate-600">Nenhuma aplicação finalizada encontrada nesta consulta.</p>}<Link href={pilotOrderHref(order.entityId)} className={primary}>{pilotOrderState(d?.status).active?"Conferir e continuar OS":"Consultar OS"}</Link></>:<><p className="text-xs text-slate-600">A aplicação será aberta no fluxo existente, com conferência de atribuição, segurança e retomada de registros.</p><Link href={pilotOrderHref(order.entityId)} className={primary}>{pilotOrderState(d?.status).active?"Preparar / continuar aplicação":"Consultar OS encerrada"}</Link></>}</div></section></>}
  {tab==="historico"&&<section className={panel}><h2 className={header}><History size={16}/> Histórico do piloto</h2><div className="grid gap-2 p-3">{historyReady?all.slice(0,10).map(row=><ApplicationCard key={row.id} row={row}/>):<p className="text-xs text-slate-600">Histórico indisponível ou em consulta.</p>}{historyReady&&!all.length&&<p className="text-xs text-slate-600">Nenhum registro finalizado encontrado.</p>}<Link href={ROOT+"/historico"} className={secondary}>Abrir histórico completo</Link></div></section>}
  <div className="agro-compact-grid grid grid-cols-2 gap-2"><Link href={ROOT+"/campo"} className={secondary}><Drone size={16}/> Modo campo</Link><Link href={ROOT+"/ferramentas"} className={secondary}>MBA Calda</Link></div>
  {trainingEnabled&&<Link href={ROOT+"/agrovoo/piloto/treinamento"} className="flex min-h-11 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs font-semibold text-amber-950"><FlaskConical size={17}/> Treinamento — sem voo real</Link>}
  <p className="text-[11px] text-slate-500">Consultar uma OS não autoriza o voo. A conexão à rede não confirma sincronização com o servidor.</p>
 </main>;
}
