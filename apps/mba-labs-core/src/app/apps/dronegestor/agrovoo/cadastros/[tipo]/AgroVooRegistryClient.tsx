"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useAgroData } from "../../../AgroDocUi";
import { paginateAgroVooOrders } from "@/lib/agrovoo-board-view";

export type RegistryKind = "clientes" | "propriedades" | "talhoes" | "aeronaves";
type RecordData = Record<string,string|number|undefined>;
type Item = {entityId:string; data:RecordData};
type Payload = {ok:boolean; items:Item[]; canManage?:boolean; error?:string};
type Field = {key:string; label:string; required?:boolean; type?:"text"|"email"|"tel"|"number"|"select"|"textarea"; min?:string; options?:"clientes"|"propriedades"; maxLength?:number};
type Config = {title:string; singular:string; type:string; columns: [string,string][]; fields:Field[]};
const ROOT="/apps/dronegestor/agrovoo";
const name:Field={key:"nome",label:"Nome",required:true,maxLength:120};
const note:Field={key:"observacoes",label:"Observações",type:"textarea",maxLength:500};
const configs:Record<RegistryKind,Config>={
  clientes:{title:"Clientes",singular:"cliente",type:"cliente",columns:[["nome","Nome / razão social"],["cpfCnpj","CPF / CNPJ"],["telefone","Telefone"],["email","E-mail"]],fields:[{...name,label:"Nome / razão social"},{key:"cpfCnpj",label:"CPF / CNPJ",maxLength:30},{key:"telefone",label:"Telefone",type:"tel",maxLength:40},{key:"email",label:"E-mail",type:"email",maxLength:120},note]},
  propriedades:{title:"Propriedades",singular:"propriedade",type:"fazenda",columns:[["nome","Propriedade"],["clienteId","Cliente"],["municipio","Município"],["uf","UF"]],fields:[{...name,label:"Nome da propriedade"},{key:"clienteId",label:"Cliente",type:"select",required:true,options:"clientes"},{key:"municipio",label:"Município",required:true,maxLength:120},{key:"uf",label:"UF",required:true,maxLength:2},{key:"endereco",label:"Endereço",maxLength:240},note]},
  talhoes:{title:"Talhões",singular:"talhão",type:"talhao",columns:[["nome","Talhão"],["fazendaId","Propriedade"],["areaHa","Área (ha)"],["culturaPadrao","Cultura"]],fields:[name,{key:"fazendaId",label:"Propriedade",type:"select",required:true,options:"propriedades"},{key:"areaHa",label:"Área (ha)",type:"number",required:true,min:"0.01"},{key:"culturaPadrao",label:"Cultura padrão",maxLength:120},note]},
  aeronaves:{title:"Aeronaves e equipamentos",singular:"equipamento",type:"equipamento",columns:[["nome","Equipamento"],["modelo","Modelo"],["registroAnac","Registro ANAC"],["tanqueL","Tanque (L)"]],fields:[{...name,label:"Apelido do equipamento"},{key:"marca",label:"Marca",maxLength:80},{key:"modelo",label:"Modelo",required:true,maxLength:100},{key:"numeroSerie",label:"Número de série",maxLength:120},{key:"registroAnac",label:"Identificação / registro ANAC",required:true,maxLength:120},{key:"tanqueL",label:"Capacidade do tanque (L)",type:"number",required:true,min:"0.01"},{key:"pontaModelo",label:"Bico / atomizador padrão",required:true,maxLength:160},{key:"faixaPadraoM",label:"Faixa padrão (m)",type:"number"},{key:"velocidadePadraoKmh",label:"Velocidade padrão (km/h)",type:"number"},{key:"alturaPadraoM",label:"Altura padrão (m)",type:"number"},{key:"volumePadraoLHa",label:"Volume padrão (L/ha)",type:"number"},{...note,maxLength:800}]},
};
const normalize=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
const control="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100";
const secondary="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-40";
const primary="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#185a47] px-4 text-sm font-semibold text-white disabled:opacity-40";

export function AgroVooRegistryClient({kind}:{kind:RegistryKind}){
  const config=configs[kind], equipment=kind==="aeronaves";
  const endpoint=equipment?"/api/dronegestor/equipamentos":"/api/dronegestor/cadastros";
  const list=useAgroData<Payload>(equipment?endpoint:endpoint+"?type="+config.type);
  const clients=useAgroData<Payload>(kind==="propriedades"?"/api/dronegestor/cadastros?type=cliente":null);
  const farms=useAgroData<Payload>(kind==="talhoes"?"/api/dronegestor/cadastros?type=fazenda":null);
  const [query,setQuery]=useState(""),[page,setPage]=useState(0),[size,setSize]=useState(10);
  const [draft,setDraft]=useState<RecordData|null>(null),[editing,setEditing]=useState(""),[saving,setSaving]=useState(false);
  const [error,setError]=useState(""),[success,setSuccess]=useState("");
  const formRef=useRef<HTMLFormElement>(null);
  const items=list.data?.items??[];
  const related=kind==="propriedades"?clients:farms;
  const needsRelated=kind==="propriedades"||kind==="talhoes";
  const canWrite=list.data?.ok===true&&list.data.canManage!==false;
  const relatedName=(key:string,value:unknown)=>key==="clienteId"||key==="fazendaId" ? related.data?.items.find(x=>x.entityId===value)?.data.nome||"Não disponível" : String(value??"—")||"—";
  const filtered=items.filter(item=>config.columns.some(([key])=>normalize(relatedName(key,item.data[key])).includes(normalize(query.trim()))));
  const {currentPage,totalPages,visibleOrders}=paginateAgroVooOrders(filtered,page,size);
  useEffect(()=>{if(draft)formRef.current?.focus();},[editing,draft!==null]);
  function open(item?:Item){if(!canWrite||saving)return;setError("");setSuccess("");setEditing(item?.entityId||"");setDraft(item?{...item.data}:equipment?{marca:"DJI"}:{});}
  function close(){if(saving)return;setDraft(null);setEditing("");setError("");}
  async function mutate(method:"POST"|"PATCH"|"DELETE",data?:RecordData,entityId?:string){
    if(!canWrite||saving)return;
    setSaving(true);setError("");setSuccess("");
    try{
      const body={...(equipment?{}:{type:config.type}),...(entityId?{entityId}:{}),...(data?{data}:{})};
      const response=await fetch(endpoint,{method,cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const payload=await response.json().catch(()=>null);
      if(!response.ok||payload?.ok!==true)throw new Error(payload?.error||"Não foi possível concluir a operação.");
      setDraft(null);setEditing("");setSuccess(method==="DELETE"?"Registro inativado.":method==="PATCH"?"Alterações salvas.":"Cadastro realizado.");
      list.refresh();window.dispatchEvent(new Event("dronegestor:cadastros-updated"));
    }catch(cause){setError(cause instanceof Error?cause.message:"Falha na operação.");}finally{setSaving(false);}
  }
  function submit(event:FormEvent){event.preventDefault();if(!draft||!canWrite||saving)return;
    if(needsRelated&&(!related.data||related.error)){setError("Não foi possível confirmar o cadastro relacionado.");return;}
    const data:RecordData={};for(const field of config.fields){const value=draft[field.key];if(value!==undefined)data[field.key]=field.type==="number"?Number(value):String(value).trim();}
    void mutate(editing?"PATCH":"POST",data,editing||undefined);
  }
  return <main className="grid gap-4 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3"><div><Link href={ROOT} className="mb-2 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-emerald-800"><ArrowLeft size={15}/> Dashboard / Cadastros</Link><h1 className="text-2xl font-bold text-slate-900">{config.title}</h1><p className="mt-1 text-sm text-slate-600">Consulte e mantenha os cadastros da sua empresa.</p></div><button type="button" disabled={!canWrite||saving} onClick={()=>open()} className={primary}><Plus size={18}/> {kind==="propriedades"?"Nova propriedade":kind==="aeronaves"?"Novo equipamento":"Novo "+config.singular}</button></header>
    {(list.error||error||(needsRelated&&related.error))&&<p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error||list.error||related.error}</p>}
    {success&&<p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}
    {draft&&<form ref={formRef} tabIndex={-1} onSubmit={submit} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2"><h2 className="text-base font-bold">{editing?"Editar":"Cadastrar"} {config.singular}</h2><button type="button" onClick={close} disabled={saving} className={secondary} aria-label="Fechar formulário"><X size={18}/></button></div>
      <div className="grid gap-3 md:grid-cols-2">{config.fields.map(field=><label key={field.key} className={"grid gap-1 text-sm font-semibold text-slate-700 "+(field.type==="textarea"?"md:col-span-2":"")}><span>{field.label}{field.required&&<span className="text-red-700"> *</span>}</span>{field.type==="select"?<select className={control} required={field.required} disabled={saving||!related.data} value={String(draft[field.key]??"")} onChange={e=>setDraft(old=>({...old,[field.key]:e.target.value}))}><option value="">Selecione...</option>{related.data?.items.map(item=><option key={item.entityId} value={item.entityId}>{item.data.nome}</option>)}</select>:field.type==="textarea"?<textarea rows={3} className={control} disabled={saving} maxLength={field.maxLength} value={String(draft[field.key]??"")} onChange={e=>setDraft(old=>({...old,[field.key]:e.target.value}))}/>:<input className={control} type={field.type||"text"} min={field.type==="number"?field.min||"0":undefined} step={field.type==="number"?"any":undefined} required={field.required} disabled={saving} maxLength={field.maxLength} value={String(draft[field.key]??"")} onChange={e=>setDraft(old=>({...old,[field.key]:field.key==="uf"?e.target.value.toUpperCase():e.target.value}))}/>}</label>)}</div>
      {needsRelated&&related.data?.items.length===0&&<p className="text-sm text-amber-900">Cadastre primeiro o registro relacionado. <Link href={ROOT+"/cadastros/"+(kind==="propriedades"?"clientes":"propriedades")} className="font-bold underline">Abrir cadastro</Link></p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" className={secondary} disabled={saving} onClick={close}>Cancelar</button><button type="submit" className={primary} disabled={saving||!canWrite||(needsRelated&&!related.data)}>{saving?"Salvando...":"Salvar cadastro"}</button></div>
    </form>}
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#123e38] px-4 py-3 text-white"><h2 className="font-bold">{config.title} cadastrados</h2><span className="text-sm">{list.data?items.length+" disponíveis":"—"}</span></div>
      <div className="flex flex-wrap items-center gap-2 p-3"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 px-3"><Search size={18} className="shrink-0 text-slate-500"/><input type="search" aria-label={"Buscar "+config.title.toLowerCase()} placeholder="Buscar cadastro" className="min-h-11 flex-1 outline-none" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label><button className={secondary} type="button" disabled={saving} onClick={()=>list.refresh()}><RefreshCw size={16}/> Atualizar</button></div>
      {!list.data?<p className="p-4 text-sm text-slate-600">{list.error?"Falha ao carregar cadastros.":"Carregando cadastros autorizados..."}</p>:visibleOrders.length===0?<p className="p-4 text-sm text-slate-600">Nenhum cadastro encontrado.</p>:<>
        <div className="hidden overflow-x-auto md:block" role="region" aria-label={"Tabela de "+config.title} tabIndex={0}><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr>{config.columns.map(([key,label])=><th key={key} scope="col" className="p-3">{label}</th>)}<th scope="col" className="p-3">Ações</th></tr></thead><tbody>{visibleOrders.map(item=><tr key={item.entityId} className="border-b border-slate-100 even:bg-slate-50">{config.columns.map(([key])=><td key={key} className="p-3 break-words">{relatedName(key,item.data[key])}</td>)}<td className="p-3"><Actions item={item}/></td></tr>)}</tbody></table></div>
        <div className="grid gap-2 p-3 md:hidden">{visibleOrders.map(item=><article key={item.entityId} className="rounded-md border border-slate-200 p-3"><strong>{item.data.nome||"Cadastro"}</strong><dl className="my-2 grid gap-1 text-xs">{config.columns.slice(1).map(([key,label])=><div key={key} className="flex flex-wrap justify-between gap-2"><dt className="text-slate-500">{label}</dt><dd>{relatedName(key,item.data[key])}</dd></div>)}</dl><Actions item={item}/></article>)}</div>
      </>}
      {list.data&&<footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-3 text-xs text-slate-600"><span>{filtered.length?currentPage*size+1:0}–{Math.min((currentPage+1)*size,filtered.length)} de {filtered.length} registros</span><div className="flex items-center gap-2"><select className={control+" !w-auto"} aria-label="Registros por página" value={size} onChange={e=>{setSize(Number(e.target.value));setPage(0);}}>{[10,25,50].map(n=><option key={n} value={n}>{n}</option>)}</select><button type="button" className={secondary} disabled={currentPage===0} aria-label="Página anterior" onClick={()=>setPage(currentPage-1)}><ArrowLeft size={16}/></button><span>{currentPage+1}/{totalPages}</span><button type="button" className={secondary} disabled={currentPage>=totalPages-1} aria-label="Próxima página" onClick={()=>setPage(currentPage+1)}><ArrowRight size={16}/></button></div></footer>}
    </section>
    <p className="text-xs text-slate-500">A listagem utiliza os registros ativos disponibilizados pela API existente. O servidor valida permissões e dependências de cadastros.</p>
  </main>;
  function Actions({item}:{item:Item}){return <div className="flex flex-wrap gap-1"><button type="button" disabled={!canWrite||saving} className={secondary} onClick={()=>open(item)}><Pencil size={15}/> Editar</button><button type="button" disabled={!canWrite||saving} className={secondary+" !text-red-700"} onClick={()=>{if(window.confirm("Inativar este cadastro? O servidor verificará as dependências."))void mutate("DELETE",undefined,item.entityId);}}><Trash2 size={15}/> Inativar</button></div>;}
}
