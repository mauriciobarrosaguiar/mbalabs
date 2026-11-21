"use client";
import { useEffect, useState } from "react";
import { calculateLoads, calculateProductForVolume, type ApplicationDoseUnit } from "@/lib/dronegestor-calculations";
import { AgroDocHero } from "../AgroDocUi";

type Product = { id:number; name:string; dose:string; unit:ApplicationDoseUnit };
type OfficialProduct = {key:string;name:string;registration:string;activeIngredient:string;officialSource?:string};
type Equipment = { id:string; entityId?:string; data:{nome:string; modelo:string; tanqueL:number} };
const units: ApplicationDoseUnit[] = ["mL/ha","L/ha","g/ha","kg/ha","mL/100L","g/100L"];
const fmt = (n:number) => new Intl.NumberFormat("pt-BR",{maximumFractionDigits:4}).format(n);
const parse = (s:string) => s.trim() ? Number(s.replace(",",".")) : NaN;
const inputClass = "min-h-12 rounded-xl border border-emerald-200 px-3 py-2 text-lg font-bold";
function Field({label,value,set,unit}:{label:string;value:string;set:(v:string)=>void;unit:string}) {
  return <label className="grid gap-2 rounded-2xl border border-emerald-100 bg-white p-4 text-sm font-bold text-emerald-950">{label}<span className="flex items-center gap-2"><input className={inputClass} inputMode="decimal" value={value} onChange={e=>set(e.target.value)}/><span className="shrink-0">{unit}</span></span></label>;
}
function Step({n,title}:{n:number;title:string}) {
  return <h2 className="flex items-center gap-3 text-lg font-black text-emerald-950"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-700 text-white">{n}</span>{title}</h2>;
}
export function MbaCalda() {
  const [mixer,setMixer]=useState(""),[rate,setRate]=useState(""),[tank,setTank]=useState(""),[area,setArea]=useState("");
  const [products,setProducts]=useState<Product[]>([{id:1,name:"",dose:"",unit:"mL/ha"}]);
  const [nextId,setNextId]=useState(2);
  const [searchTarget,setSearchTarget]=useState<number|null>(null),[officialQuery,setOfficialQuery]=useState(""),[officialResults,setOfficialResults]=useState<OfficialProduct[]>([]),[officialMessage,setOfficialMessage]=useState(""),[searching,setSearching]=useState(false);
  async function searchProducts(){if(officialQuery.trim().length<2||searching)return;setSearching(true);setOfficialResults([]);setOfficialMessage("");try{const res=await fetch("/api/dronegestor/produtos?q="+encodeURIComponent(officialQuery.trim())+"&limit=10",{cache:"no-store"}),data=await res.json();if(!res.ok)throw new Error("Não foi possível consultar o AGROFIT.");setOfficialResults(data.items||[]);if(data.officialAvailable===false)setOfficialMessage("Fonte oficial indisponível; podem existir apenas revisões locais.");else if(!data.items?.length)setOfficialMessage("Nenhum produto encontrado.");}catch(e){setOfficialMessage(e instanceof Error?e.message:"Consulta indisponível.");}finally{setSearching(false);}}
  const [equipment,setEquipment]=useState<Equipment[]>([]),[selected,setSelected]=useState(""),[equipmentError,setEquipmentError]=useState("");
  useEffect(()=>{
    let active=true;
    fetch("/api/dronegestor/equipamentos",{cache:"no-store"}).then(async r=>{
      const p=await r.json();if(!r.ok)throw new Error("Não foi possível consultar os drones cadastrados.");
      if(active)setEquipment((p.items||[]).filter((e:Equipment)=>e.data?.tanqueL>0));
    }).catch(()=>{if(active)setEquipmentError("Drones indisponíveis. Informe a capacidade útil manualmente.");});
    return()=>{active=false;};
  },[]);
  const m=parse(mixer),r=parse(rate),t=parse(tank),a=parse(area);
  let single:ReturnType<typeof calculateLoads>|null=null, mission:ReturnType<typeof calculateLoads>|null=null,drone:ReturnType<typeof calculateLoads>|null=null,perMix:ReturnType<typeof calculateLoads>|null=null;
  let error="";
  try {
    if(mixer&&rate){single=calculateLoads(m/r,r,m);if(tank)perMix=calculateLoads(m/r,r,t);}
    if(area&&mixer&&rate){mission=calculateLoads(a,r,m);if(tank)drone=calculateLoads(a,r,t);}
    if(area&&(!Number.isFinite(a)||a<=0))throw new Error("Informe uma área total positiva.");
  }catch(e){error=e instanceof Error?e.message:"Confira os valores.";}
  const usable=Boolean(single&&!error),effective=usable?Math.min(m,mission?.totalL??m):0;
  const productRows=products.map(p=>{
    try {
      if(!usable||!p.name.trim()||!p.dose.trim()||parse(p.dose)<=0) return null;
      const amount=(v:number)=>{const x=calculateProductForVolume(parse(p.dose),p.unit,v,r);return fmt(x.amount)+" "+x.unit;};
      return {id:p.id,name:p.name,first:amount(effective),full:amount(m),tank:t>0?amount(t):"—",lastMix:mission?amount(mission.lastL):"—",lastTank:drone?amount(drone.lastL):perMix?amount(perMix.lastL):"—",total:mission?amount(mission.totalL):"—"};
    }catch{return null;}
  });
  const complete=usable&&products.every((_,i)=>productRows[i]!==null);
  function update(id:number,patch:Partial<Product>){setProducts(old=>old.map(p=>p.id===id?{...p,...patch}:p));}
  return <div className="grid gap-5">
    <AgroDocHero title="MBA Calda" description="Do misturador ao tanque do drone. Cálculo por hectare, produtos e abastecimentos."/>
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950">Informe o volume final da calda, não o volume inicial de água. A taxa em L/ha não é a vazão da bomba em L/min.</section>
    <Step n={1} title="Quantos hectares o misturador faz?"/>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Misturador útil" value={mixer} set={setMixer} unit="L"/><Field label="Taxa de aplicação" value={rate} set={setRate} unit="L/ha"/></div>
    <div className="rounded-2xl border border-emerald-200 bg-[#e5f5db] p-5"><p className="text-sm font-bold text-emerald-800">Área atendida por mistura cheia</p><strong className="text-4xl font-black text-emerald-900">{usable?fmt(m/r):"—"} ha</strong><p className="mt-2 text-sm text-emerald-900">Volume final ÷ taxa de aplicação.</p></div>
    <Step n={2} title="Quantos tanques do drone ele abastece?"/>
    <label className="grid gap-2 rounded-2xl border bg-white p-4 text-sm font-semibold">Drone cadastrado (opcional)<select className="min-h-12 rounded-xl border px-3" value={selected} onChange={e=>{setSelected(e.target.value);const d=equipment.find(x=>(x.entityId||x.id)===e.target.value);if(d)setTank(String(d.data.tanqueL));}}><option value="">Capacidade personalizada</option>{equipment.map(e=><option key={e.entityId||e.id} value={e.entityId||e.id}>{e.data.nome} — {e.data.modelo} ({e.data.tanqueL} L cadastrado)</option>)}</select>{equipmentError&&<small>{equipmentError}</small>}</label>
    <Field label="Capacidade útil do tanque (confirme antes de calcular)" value={tank} set={setTank} unit="L"/>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border bg-white p-4"><small>Tanques completos por mistura cheia</small><strong className="block text-3xl text-emerald-900">{!error&&perMix?perMix.fullLoads:"—"}</strong></div>
      <div className="rounded-2xl border bg-white p-4"><small>Saldo para carga parcial ou próxima mistura</small><strong className="block text-3xl text-emerald-900">{!error&&perMix?fmt(perMix.partialL):"—"} L</strong></div>
    </div>
    <Field label="Área total da missão (opcional)" value={area} set={setArea} unit="ha"/>
    {mission&&!error&&<div className="rounded-2xl border bg-white p-4 text-sm leading-7"><strong>Plano da missão</strong><p>Calda total: {fmt(mission.totalL)} L • misturas completas: {mission.fullLoads} • parciais: {mission.partialLoads}</p><p>Última mistura: {fmt(mission.lastL)} L</p>{drone&&<p>Tanques completos: {drone.fullLoads} • carga parcial: {drone.partialLoads} • última carga: {fmt(drone.lastL)} L</p>}<p className="text-slate-600">As cargas totais pressupõem aproveitamento do saldo de calda da mesma missão, somente quando tecnicamente permitido. Se preparar ou descarregar cada mistura separadamente, o número de cargas pode mudar.</p></div>}
    <Step n={3} title="Produtos e doses prescritas"/>
    {products.map((p,i)=><section key={p.id} className="grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4">
      <div className="flex justify-between gap-2"><strong>Produto {i+1}</strong><button type="button" disabled={products.length===1} onClick={()=>setProducts(old=>old.filter(x=>x.id!==p.id))} className="text-sm font-semibold text-red-700 disabled:opacity-40">Remover</button></div>
      <label className="grid gap-1 text-sm">Nome<input className={inputClass} value={p.name} onChange={e=>update(p.id,{name:e.target.value})} placeholder="Nome comercial"/></label>
      <button type="button" className="min-h-11 rounded-xl border border-emerald-200 text-sm font-bold text-emerald-800" disabled={searching} onClick={()=>{setSearchTarget(searchTarget===p.id?null:p.id);setOfficialQuery(p.name);setOfficialResults([]);setOfficialMessage("");}}>Buscar nome no AGROFIT</button>
      {searchTarget===p.id&&<section className="grid gap-2 rounded-xl bg-slate-50 p-3"><label className="grid gap-1 text-sm">Nome, ingrediente ativo ou registro<input className={inputClass} value={officialQuery} onChange={e=>{setOfficialQuery(e.target.value);setOfficialResults([]);}} /></label><button type="button" className="min-h-11 rounded-xl bg-emerald-800 font-bold text-white disabled:opacity-50" disabled={searching||officialQuery.trim().length<2} onClick={()=>void searchProducts()}>{searching?"Buscando…":"Buscar"}</button>{officialMessage&&<p role="status" className="text-sm">{officialMessage}</p>}{officialResults.map(x=><button type="button" key={x.key} className="rounded-xl border bg-white p-3 text-left" onClick={()=>{update(p.id,{name:x.name});setSearchTarget(null);setOfficialResults([]);}}><strong className="block">{x.name}</strong><small>{x.registration} · {x.activeIngredient} · {x.officialSource||"AGROFIT"}</small></button>)}<small>A seleção identifica o produto; não confirma autorização para a cultura ou dose.</small></section>}
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Dose prescrita<input className={inputClass} value={p.dose} inputMode="decimal" onChange={e=>update(p.id,{dose:e.target.value})}/></label><label className="grid gap-1 text-sm">Unidade<select className={inputClass} value={p.unit} onChange={e=>update(p.id,{unit:e.target.value as ApplicationDoseUnit})}>{units.map(u=><option key={u}>{u}</option>)}</select></label></div>
    </section>)}
    <button type="button" className="min-h-12 rounded-xl border border-emerald-200 bg-emerald-50 font-bold text-emerald-900" onClick={()=>{setProducts(old=>[...old,{id:nextId,name:"",dose:"",unit:"mL/ha"}]);setNextId(old=>old+1);}}>+ Adicionar outro produto</button>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    <Step n={4} title="Quanto colocar no misturador?"/>
    <section aria-live="polite" className="grid gap-3 rounded-2xl bg-emerald-950 p-5 text-white">
      <h2 className="text-xl font-black">POR MISTURADOR — {usable?fmt(effective):"—"} L de calda final</h2>
      {!complete?<p className="text-sm text-emerald-100">Preencha a capacidade, a taxa e todos os produtos com doses positivas.</p>:productRows.map(p=>p&&<article key={p.id} className="rounded-xl bg-white/10 p-4"><h3 className="font-bold">{p.name}</h3><strong className="block text-3xl text-white">{p.first}</strong><p className="mt-2 text-sm text-emerald-100">Mistura cheia: {p.full} • por tanque cheio (referência): {p.tank}</p>{mission&&<p className="text-sm text-emerald-100">Última mistura: {p.lastMix} • última carga: {p.lastTank} • total da missão: {p.total}</p>}</article>)}
    </section>
    <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Cálculo matemático, não prescrição. Confira receituário, bula, compatibilidade, EPI, ordem de mistura e orientação técnica. Complete até o volume final, sem ultrapassar a capacidade útil.</p>
  </div>;
}
