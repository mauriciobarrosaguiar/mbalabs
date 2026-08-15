"use client";

import { CheckCircle2, ExternalLink, FileCheck2, FileUp, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Pilot={id:string;nome:string;usuarioId?:string};
type Doc={id:string;pilotId:string;tipo:string;nome:string;numero:string;validade:string;uploadedAt:string;url:string};
const SLOT_ID="dronegestor-pilot-qualifications";
const ANAC_RULE_URL="https://www.anac.gov.br/assuntos/legislacao/legislacao-1/boletim-de-pessoal/2026/bps-v-21-no-24-15-a-19-06-2026/rbac-100-emd-00/visualizar_ato_normativo";

function findHost(){const title=Array.from(document.querySelectorAll("h1")).find(node=>node.textContent?.trim()==="Pilotos e autorizações");return title?.closest("header")?.parentElement??null}

export function DronePilotQualifications(){
  const[slot,setSlot]=useState<HTMLElement|null>(null),[pilots,setPilots]=useState<Pilot[]>([]),[pilotId,setPilotId]=useState(""),[docs,setDocs]=useState<Doc[]>([]),[canManage,setCanManage]=useState(false),[loading,setLoading]=useState(true),[loadingDocs,setLoadingDocs]=useState(false),[saving,setSaving]=useState(false),[file,setFile]=useState<File|null>(null),[numero,setNumero]=useState(""),[message,setMessage]=useState("");

  useEffect(()=>{const mount=()=>{const host=findHost();if(!host)return;let node=document.getElementById(SLOT_ID);if(!node){node=document.createElement("div");node.id=SLOT_ID;const header=host.querySelector("header");header?.insertAdjacentElement("afterend",node)}setSlot(node)};mount();const observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});return()=>observer.disconnect()},[]);

  async function loadPilots(){setLoading(true);try{const response=await fetch("/api/dronegestor/pilotos",{cache:"no-store"}),payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||"Falha ao carregar pilotos.");const items=(payload?.items||[]) as Pilot[];setPilots(items);setCanManage(Boolean(payload?.canManage));setPilotId(current=>current&&items.some(item=>item.id===current)?current:(items[0]?.id||""))}catch(error){setMessage(error instanceof Error?error.message:"Falha ao carregar pilotos.")}finally{setLoading(false)}}
  useEffect(()=>{void loadPilots()},[]);

  async function loadDocs(id:string){if(!id){setDocs([]);return}setLoadingDocs(true);try{const response=await fetch(`/api/dronegestor/piloto-documentos?pilotId=${encodeURIComponent(id)}`,{cache:"no-store"}),payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||"Falha ao carregar documentos.");setDocs(payload?.items||[])}catch(error){setMessage(error instanceof Error?error.message:"Falha ao carregar documentos.")}finally{setLoadingDocs(false)}}
  useEffect(()=>{void loadDocs(pilotId)},[pilotId]);

  const pilot=useMemo(()=>pilots.find(item=>item.id===pilotId)||null,[pilots,pilotId]);
  const exam=useMemo(()=>docs.find(item=>item.tipo==="exame_teorico_anac")||null,[docs]);

  async function upload(){if(!canManage||!pilotId||!file||saving)return;setSaving(true);setMessage("");try{const form=new FormData();form.append("pilotId",pilotId);form.append("tipo","exame_teorico_anac");form.append("numero",numero);form.append("arquivo",file);const response=await fetch("/api/dronegestor/piloto-documentos",{method:"POST",body:form}),payload=await response.json().catch(()=>null);if(!response.ok)throw new Error(payload?.error||"Falha ao enviar comprovante.");setFile(null);setNumero("");setMessage("Comprovante do exame teórico ANAC salvo para o piloto.");await loadDocs(pilotId)}catch(error){setMessage(error instanceof Error?error.message:"Falha ao enviar comprovante.")}finally{setSaving(false)}}

  if(!slot)return null;
  return createPortal(<section className="mb-4 rounded-[26px] border border-[#dce7df] bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f4eb] text-[#087a55]"><ShieldCheck size={22}/></span><div className="min-w-0 flex-1"><strong className="block text-lg text-[#143d31]">Qualificação do piloto</strong><p className="mt-1 text-xs leading-5 text-[#718078]">Guarde aqui os comprovantes do piloto. O RBAC 100.13(b) exige aprovação em exame de conhecimento teórico da ANAC para piloto remoto.</p></div><a href={ANAC_RULE_URL} target="_blank" rel="noreferrer" className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#dce7df] text-[#087a55]" aria-label="Abrir regra ANAC"><ExternalLink size={17}/></a></div>
    {loading?<div className="mt-4 flex items-center gap-2 text-sm text-[#718078]"><Loader2 size={16} className="animate-spin"/>Carregando pilotos...</div>:pilots.length===0?<p className="mt-4 rounded-xl bg-[#f5f8f6] px-3 py-3 text-sm text-[#61746a]">Cadastre um piloto para controlar a qualificação.</p>:<div className="mt-4 grid gap-3"><label className="grid gap-1 text-xs font-black text-[#4e675d]"><span>Piloto</span><select value={pilotId} onChange={e=>setPilotId(e.target.value)} className="min-h-11 rounded-xl border border-[#d8e3db] bg-white px-3 text-sm">{pilots.map(item=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
      <div className={`flex items-start gap-3 rounded-2xl border p-3 ${exam?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}>{loadingDocs?<Loader2 size={18} className="mt-0.5 animate-spin"/>:exam?<CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-700"/>:<TriangleAlert size={19} className="mt-0.5 shrink-0 text-amber-700"/>}<div className="min-w-0 flex-1"><strong className={`block text-sm ${exam?"text-emerald-950":"text-amber-950"}`}>{exam?"Exame teórico ANAC — comprovante anexado":"Exame teórico ANAC — comprovante pendente"}</strong><p className="mt-1 text-xs leading-5 text-[#687970]">{pilot?.nome}{exam?.numero?` • referência ${exam.numero}`:""}</p>{exam?.url&&<a href={exam.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-black text-[#087a55]">Abrir comprovante <ExternalLink size={13}/></a>}</div></div>
      {canManage&&<div className="grid gap-2 rounded-2xl border border-[#e1ebe5] p-3 sm:grid-cols-[1fr_1fr_auto]"><label className="grid gap-1 text-xs font-black text-[#4e675d]"><span>Número / referência (opcional)</span><input value={numero} onChange={e=>setNumero(e.target.value)} className="min-h-11 rounded-xl border border-[#d8e3db] px-3 text-sm"/></label><label className="grid gap-1 text-xs font-black text-[#4e675d]"><span>Comprovante</span><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e=>setFile(e.target.files?.[0]||null)} className="min-h-11 rounded-xl border border-[#d8e3db] p-2 text-sm"/></label><button type="button" disabled={!file||saving} onClick={()=>void upload()} className="inline-flex min-h-11 self-end items-center justify-center gap-2 rounded-xl bg-[#087a55] px-4 text-sm font-black text-white disabled:opacity-40">{saving?<Loader2 size={16} className="animate-spin"/>:<FileUp size={16}/>}Salvar</button></div>}
      {docs.filter(item=>item.tipo!=="exame_teorico_anac").length>0&&<div className="grid gap-2">{docs.filter(item=>item.tipo!=="exame_teorico_anac").map(item=><a key={item.id} href={item.url||"#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[#e1ebe5] px-3 py-2 text-xs font-bold text-[#315d4d] no-underline"><FileCheck2 size={15}/>{item.nome}</a>)}</div>}
    </div>}
    {message&&<p className="mt-3 rounded-xl bg-[#f4f8f5] px-3 py-2 text-xs font-bold text-[#315d4d]">{message}</p>}
  </section>,slot);
}
