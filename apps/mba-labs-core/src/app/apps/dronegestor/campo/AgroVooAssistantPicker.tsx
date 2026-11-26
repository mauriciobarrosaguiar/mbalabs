"use client";
import {useEffect,useRef,useState} from "react";
export function AgroVooAssistantPicker({osId,disabled,value,onChange}:{osId:string;disabled:boolean;value:string;onChange:(name:string)=>void}){
 const [names,setNames]=useState<string[]>([]),[loading,setLoading]=useState(false),[notice,setNotice]=useState(""),[loaded,setLoaded]=useState(false);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{controller.current?.abort();setNames([]);setLoaded(false);setLoading(false);setNotice("");},[osId,disabled]);
 async function load(){
  if(disabled||!osId)return;
  controller.current?.abort();const req=new AbortController();controller.current=req;
  setLoading(true);setNames([]);setLoaded(false);setNotice("");
  try{
   const response=await fetch("/api/dronegestor/ajudantes?osId="+encodeURIComponent(osId),{cache:"no-store",signal:req.signal});
   const result=await response.json().catch(()=>null);
   if(req.signal.aborted||controller.current!==req)return;
   if(!response.ok||result?.ok!==true||!Array.isArray(result.names))throw Error(result?.error||"Consulta indisponível.");
   const next=result.names.filter((n:unknown):n is string=>typeof n==="string"&&n.length>0);
   setNames(next);setLoaded(true);
   if(!next.length)setNotice("Nenhum funcionário disponível nesta consulta. Você pode manter o nome informado manualmente.");
  }catch(error){if(!req.signal.aborted&&controller.current===req)setNotice(error instanceof Error?error.message:"Consulta indisponível.");}
  finally{if(!req.signal.aborted&&controller.current===req)setLoading(false);}
 }
 return <div className="grid gap-2"><label className="grid gap-1 text-sm font-semibold text-slate-700">Ajudante (opcional)<input maxLength={120} disabled={disabled} className="min-h-11 rounded-md border border-slate-300 px-3 disabled:bg-slate-100" value={value} onChange={e=>onChange(e.target.value)} placeholder="Nome do ajudante"/></label>
 {!disabled&&osId&&<><button type="button" disabled={loading} className="min-h-11 rounded-md border border-emerald-200 px-2 text-xs font-semibold text-emerald-800" onClick={()=>void load()}>{loading?"Consultando…":loaded?"Atualizar funcionários":"Selecionar funcionário cadastrado"}</button>{loaded&&names.length>0&&<label className="grid gap-1 text-xs font-semibold">Funcionários disponíveis<select value={names.includes(value)?value:""} className="min-h-11 rounded-md border border-slate-300 px-2" onChange={e=>{if(e.target.value&&names.includes(e.target.value))onChange(e.target.value);}}><option value="">Selecione o nome...</option>{names.map(name=><option key={name} value={name}>{name}</option>)}</select></label>}</>}
 {notice&&<p role="status" className="text-xs text-slate-600">{notice}</p>}
 <p className="text-xs text-slate-600">Somente o nome declarado será registrado. Selecionar um funcionário não comprova habilitação, presença ou autorização de voo.</p></div>;
}
