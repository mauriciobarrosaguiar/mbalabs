"use client";
import {useEffect,useRef,useState} from "react";
import {Search,Loader2,X} from "lucide-react";
type Result={key:string;name:string;registration?:string;activeIngredient?:string;formulation?:string;officialSource?:string;verification?:{status?:string;bulletinUrl?:string};bulletinUrl?:string};
function safeLink(value?:string){try{const url=new URL(value||"");return url.protocol==="https:"?url.href:null;}catch{return null;}}
export function AgroVooProductSearch({initialQuery="",onSelect,onClose}:{initialQuery?:string;onSelect?:(name:string)=>void;onClose:()=>void}){
 const [query,setQuery]=useState(initialQuery),[items,setItems]=useState<Result[]>([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState(""),[official,setOfficial]=useState<boolean|null>(null);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 function change(value:string){request.current?.abort();request.current=null;setQuery(value);setItems([]);setNotice("");setOfficial(null);setLoading(false);}
 async function search(){
  const q=query.trim();if(q.length<2){setNotice("Digite pelo menos dois caracteres.");return;}
  request.current?.abort();const controller=new AbortController();request.current=controller;
  setLoading(true);setNotice("");setItems([]);setOfficial(null);
  try{
   const response=await fetch("/api/dronegestor/produtos?q="+encodeURIComponent(q)+"&limit=15",{cache:"no-store",signal:controller.signal});
   const payload=await response.json().catch(()=>null);
   if(controller.signal.aborted||request.current!==controller)return;
   if(!response.ok||payload?.ok!==true||!Array.isArray(payload.items))throw Error("Não foi possível consultar a biblioteca.");
   const results:Result[]=payload.items.filter((x:Result)=>x&&typeof x.name==="string"&&typeof x.key==="string");
   setItems(results);setOfficial(payload.officialAvailable===true);
   if(payload.officialAvailable!==true)setNotice("Fonte oficial indisponível. A consulta pode conter apenas revisões locais; não equivale à confirmação de registro vigente.");
   else if(!results.length)setNotice("Nenhum resultado para esta busca.");
  }catch(error){if(!controller.signal.aborted&&request.current===controller)setNotice(error instanceof Error?error.message:"Falha na consulta.");}
  finally{if(!controller.signal.aborted&&request.current===controller)setLoading(false);}
 }
 return <section className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm">Consultar produtos AGROFIT</strong><button type="button" aria-label="Fechar consulta" className="grid size-11 place-items-center rounded-md border border-slate-200" onClick={onClose}><X size={18}/></button></div>
 <div className="flex gap-2"><input aria-label="Nome, registro ou ingrediente ativo" placeholder="Nome, registro ou ingrediente ativo" className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-2 text-sm" value={query} maxLength={120} onChange={e=>change(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void search();}}}/><button type="button" disabled={loading||query.trim().length<2} aria-label="Buscar AGROFIT" onClick={()=>void search()} className="grid size-11 shrink-0 place-items-center rounded-md bg-[#185a47] text-white disabled:opacity-40">{loading?<Loader2 className="animate-spin" size={18}/>:<Search size={18}/>}</button></div>
 {notice&&<p role="status" className="rounded-md bg-amber-50 p-2 text-xs text-amber-950">{notice}</p>}
 {items.map(item=>{const link=safeLink(item.verification?.bulletinUrl||item.bulletinUrl);const fromOfficial=official===true&&item.officialSource==="AGROFIT / Dados Abertos MAPA";return <article key={item.key} className="grid gap-1.5 rounded-md border border-slate-200 p-2.5"><div className="flex flex-wrap items-start gap-2"><strong className="min-w-0 break-words text-sm">{item.name}</strong><span className="rounded bg-slate-100 px-1.5 py-1 text-[10px] font-semibold text-slate-700">{fromOfficial?"AGROFIT":"Biblioteca local"}</span></div><p className="text-xs text-slate-600">{[item.registration?"Registro "+item.registration:"Registro não informado",item.activeIngredient,item.formulation].filter(Boolean).join(" · ")}</p><p className="text-xs text-slate-600">{item.verification?.status==="verified"?"Revisão técnica registrada":item.verification?.status==="no_explicit_order"?"Fonte revisada, sem ordem explícita":"Revisão técnica necessária"}</p>{link&&<a href={link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-emerald-800 underline">Consultar fonte / bula</a>}{onSelect&&<button type="button" className="min-h-11 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-xs font-semibold text-emerald-900" onClick={()=>onSelect(item.name)}>Selecionar identificação</button>}</article>})}
 <p className="text-xs text-slate-600">A identificação não recomenda dose, mistura, cultura ou uso. Confira o receituário e a bula vigente com o RT.</p></section>;
}
