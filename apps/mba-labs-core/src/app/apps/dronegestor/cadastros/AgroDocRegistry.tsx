"use client";
import Link from "next/link";
import { AgroDocDroneIcon as Drone } from "../AgroDocDroneIcon";
import { Users, Map, Handshake, UserRound, Zap, Layers } from "lucide-react";
import { AgroDocError, useAgroData } from "../AgroDocUi";
type Entity={entityId:string;data:{nome?:string;modelo?:string;registroAnac?:string;municipio?:string;uf?:string;culturaPadrao?:string;tanqueL?:number}};
type Entities={items:Entity[];canManage?:boolean};
type Pilots={items:{id:string;nome:string;ativo:boolean;funcao?:string}[];canAdministerTeam?:boolean};
const ROOT="/apps/agrovoo";
const link="inline-flex min-h-11 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold !text-emerald-800";
const panel="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm";
export function AgroDocRegistry(){
 const drones=useAgroData<Entities>("/api/dronegestor/equipamentos"),pilots=useAgroData<Pilots>("/api/dronegestor/pilotos"),farms=useAgroData<Entities>("/api/dronegestor/cadastros?type=fazenda"),clients=useAgroData<Entities>("/api/dronegestor/cadastros?type=cliente"),fields=useAgroData<Entities>("/api/dronegestor/cadastros?type=talhao");
 return <main className="grid gap-4 pb-8">
 <header><p className="text-xs font-bold uppercase text-emerald-800">Cadastros</p><h1 className="text-2xl font-bold">Visão dos cadastros</h1><p className="mt-1 text-sm text-slate-600">Bases reutilizáveis da sua operação.</p></header>
 <div className="agro-compact-grid grid grid-cols-2 gap-2 lg:grid-cols-5">{[
 {title:"Aeronaves",data:drones,icon:Drone,path:"cadastros/aeronaves"},
 {title:"Pilotos",data:pilots,icon:Users,path:"cadastros/pilotos"},
 {title:"Propriedades",data:farms,icon:Map,path:"cadastros/propriedades"},
 {title:"Clientes",data:clients,icon:Handshake,path:"cadastros/clientes"},
 {title:"Talhões",data:fields,icon:Layers,path:"cadastros/talhoes"}
 ].map(({title,data,icon:Icon,path})=><Link key={path} href={ROOT+"/"+path} className={panel}><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-600">{title}</span><Icon size={19} className="shrink-0 text-emerald-700"/></div><strong className="text-2xl text-slate-900">{data.data?.items.length??"—"}</strong></Link>)}</div>
 <AgroDocError error={[drones.error,pilots.error,farms.error,clients.error,fields.error].filter(Boolean).join(" · ")}/>
 <section className={panel}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Aeronaves e equipamentos</h2><Link className={link} href={ROOT+"/cadastros/aeronaves"}>Ver todos</Link></div>
 {drones.data?.items.slice(0,3).map(x=><article key={x.entityId} className="grid gap-1 rounded-md border border-slate-200 p-3"><strong className="break-words">{x.data.nome||x.data.modelo}</strong><span className="break-words text-sm text-slate-600">Modelo: {x.data.modelo||"Não informado"}</span><span className="break-words text-sm">ANAC: {x.data.registroAnac||"Não informado"}</span><span className="text-xs text-slate-600">ANATEL e situação documental: conferir documentos.</span></article>)}
 {drones.data?.items.length===0&&<p className="text-sm text-slate-500">Nenhum equipamento cadastrado.</p>}</section>
 <section className={panel}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Equipe operacional</h2><Link className={link} href={ROOT+"/cadastros/pilotos"}>Ver pilotos</Link></div>{pilots.data?.items.slice(0,4).map(x=><article key={x.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-3"><UserRound size={23} className="shrink-0 text-emerald-700"/><div className="min-w-0"><strong className="break-words">{x.nome}</strong><p className="text-xs text-slate-600">{x.funcao||"Piloto"} · {x.ativo?"Ativo":"Inativo"}</p></div></article>)}{pilots.data?.items.length===0&&<p className="text-sm text-slate-500">Nenhum piloto disponível.</p>}</section>
 <section className={panel}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Propriedades e clientes</h2><Link className={link} href={ROOT+"/cadastros/propriedades"}>Propriedades</Link><Link className={link} href={ROOT+"/cadastros/clientes"}>Clientes</Link></div>{farms.data?.items.slice(0,3).map(x=><article key={x.entityId} className="grid gap-1 rounded-md border border-slate-200 p-3"><strong className="break-words">{x.data.nome}</strong><span className="text-sm text-slate-600">{[x.data.municipio,x.data.uf].filter(Boolean).join(" · ")||"Localização não informada"}</span><span className="text-xs text-slate-600">Cultura: {x.data.culturaPadrao||"Não informada"}</span></article>)}{farms.data?.items.length===0&&<p className="text-sm text-slate-500">Nenhuma propriedade disponível.</p>}</section>
 <section className={panel}><h2 className="flex items-center gap-2 font-bold"><Zap size={18} className="text-emerald-700"/> Ações rápidas</h2><div className="grid gap-2 sm:grid-cols-2">
 {["Novo drone|cadastros/aeronaves?novo=1","Novo cliente|cadastros/clientes?novo=1","Nova propriedade|cadastros/propriedades?novo=1","Novo talhão|cadastros/talhoes?novo=1","Responsável técnico e empresa|perfil-operacional"].map(entry=>{const [title,path]=entry.split("|");return <Link key={path} className={link} href={ROOT+"/"+path}>{title} →</Link>})}
 {pilots.data?.canAdministerTeam&&<Link className={link} href={ROOT+"/funcionarios"}>Novo colaborador →</Link>}</div></section></main>;
}
