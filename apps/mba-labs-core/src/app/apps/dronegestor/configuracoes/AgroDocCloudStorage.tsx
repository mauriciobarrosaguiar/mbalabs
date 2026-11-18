"use client";
import {useCallback,useEffect,useState} from "react";
import {AgroDocCard,AgroDocError} from "../AgroDocUi";
import {Cloud,RefreshCw} from "lucide-react";
type Snapshot={canManage:boolean;google:{status:string;account:string;lastTestedAt:string|null;error:string|null};counts:{synced:number;pending:number;failed:number;partial:boolean};
files:Array<{id:string;original_name:string;os_id:string;status:string;created_at:string;last_error:string|null;attempts:number}>};
export function AgroDocCloudStorage(){
 const [data,setData]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
 const load=useCallback(async()=>{setLoading(true);try{const r=await fetch("/api/dronegestor/cloud",{cache:"no-store"}),p=await r.json();if(!r.ok)throw new Error(p.error||"Erro ao consultar armazenamento.");setData(p);setError("");}catch(e){setError(e instanceof Error?e.message:"Falha de consulta.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{const q=new URLSearchParams(location.search);if(q.has("drive_error"))setError(q.get("drive_error")||"Autorização falhou.");if(q.get("drive")==="connected")setMessage("Conta autorizada e pasta criada no Drive.");},[]);
 async function action(value:"test"|"disconnect"){
   if(value==="disconnect"&&!confirm("Desconectar o Google Drive da empresa? Arquivos e histórico serão preservados."))return;
   setBusy(true);setError("");
   try{const r=await fetch("/api/dronegestor/cloud",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:value})}),p=await r.json();if(!r.ok)throw new Error(p.error||"Erro.");setMessage(p.message);await load();}catch(e){setError(e instanceof Error?e.message:"Falha.");}finally{setBusy(false);}
 }
 return <AgroDocCard title="Armazenamento em nuvem por empresa" icon={Cloud}>
  <p>Os arquivos ficam vinculados ao ID interno da empresa e às permissões de cada operação. Operadores individuais usam um escopo separado.</p>
  <AgroDocError error={error}/>{message&&<p role="status">{message}</p>}
  {loading&&!data?<p>Consultando conexão...</p>:null}
  {data&&<>
   <div className="agro-row"><Cloud size={24}/><div>
     <b>Google Drive — {data.google.status==="connected"?"Conectado":"Desconectado"}</b>
     <small>{data.google.account||"Conta não autorizada"}</small>
     <small>Último teste: {data.google.lastTestedAt?new Date(data.google.lastTestedAt).toLocaleString("pt-BR"):"não realizado"}</small>
   </div>{data.canManage&&<div className="agro-actions">
     <a className="agro-button agro-button-primary" href="/api/dronegestor/cloud/google/start">{data.google.status==="connected"?"Trocar / reconectar conta":"Conectar Google Drive"}</a>
     {data.google.status==="connected"&&<><button className="agro-button" disabled={busy} onClick={()=>void action("test")}>Testar</button><button className="agro-button" disabled={busy} onClick={()=>void action("disconnect")}>Desconectar</button></>}
   </div>}</div>
   <div className="agro-row"><Cloud size={24}/><div><b>Dropbox — Integração indisponível</b><small>Nenhuma conta fictícia conectada.</small></div></div>
   <div className="agro-row"><div><b>Arquivos recentes: {data.counts.synced} sincronizados · {data.counts.pending} pendentes · {data.counts.failed} falhas</b>
     <small>{data.counts.partial?"Amostra dos 100 mais recentes":"Contagens do histórico consultado; sem estimar espaço disponível"}</small></div>
     <button className="agro-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/> Atualizar</button>
   </div>
   <details><summary>Histórico de envios</summary>{data.files.map(f=><div className="agro-row" key={f.id}><div><b>{f.original_name}</b>
   <small>OS {f.os_id} · {new Date(f.created_at).toLocaleString("pt-BR")} · {f.status}</small>{f.last_error&&<small>{f.last_error}</small>}</div></div>)}</details>
  </>}
 </AgroDocCard>;
}
