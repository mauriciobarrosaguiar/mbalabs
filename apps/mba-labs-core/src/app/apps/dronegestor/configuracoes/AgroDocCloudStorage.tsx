"use client";
import {useCallback,useEffect,useState} from "react";
import {AgroDocCard,AgroDocError} from "../AgroDocUi";
import {Cloud,RefreshCw} from "lucide-react";
type Snapshot={canManage:boolean;setupRequired?:boolean;oauthConfigured?:boolean;google:{status:string;account:string;lastTestedAt:string|null;error:string|null};counts:{synced:number;pending:number;failed:number;partial:boolean};
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
   {data.setupRequired&&<p role="alert">A configuração do banco de armazenamento está pendente. O envio tradicional ao Supabase continua disponível.</p>}
   {!data.oauthConfigured&&<p role="alert">O OAuth Google Drive ainda precisa ser configurado pelo administrador técnico. O Supabase continua disponível.</p>}
   {data.canManage&&(data.setupRequired||!data.oauthConfigured)&&<details className="rounded-xl border border-emerald-200 bg-white p-3"><summary className="cursor-pointer font-bold text-emerald-900">Como configurar o Google Drive</summary><ol className="ml-5 mt-3 list-decimal text-sm leading-6"><li>Ative a Google Drive API no Google Cloud.</li><li>Configure a tela de consentimento e um cliente OAuth do tipo Aplicativo Web.</li><li>Cadastre o endereço HTTPS de retorno do ambiente aprovado. Produção: https://www.mbalabs.com.br/api/dronegestor/cloud/google/callback</li><li>O administrador técnico configura AGRODOC_GOOGLE_CLIENT_ID, AGRODOC_GOOGLE_CLIENT_SECRET, AGRODOC_GOOGLE_REDIRECT_URI e AGRODOC_CLOUD_ENCRYPTION_KEY na Vercel, sem compartilhar segredos.</li><li>Após validar a migration e isolar o banco de teste, o botão Conectar Google Drive ficará disponível.</li></ol><a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg border border-emerald-200 p-2 font-semibold text-emerald-800">Abrir Google Cloud</a></details>}
   <div className="agro-row"><Cloud size={24}/><div>
     <b>Google Drive — {data.google.status==="connected"?"Conectado":"Desconectado"}</b>
     <small>{data.google.account||"Conta não autorizada"}</small>
     <small>Último teste: {data.google.lastTestedAt?new Date(data.google.lastTestedAt).toLocaleString("pt-BR"):"não realizado"}</small>
   </div>{data.canManage&&!data.setupRequired&&data.oauthConfigured&&<div className="agro-actions">
     <a className="agro-button agro-button-primary" href="/api/dronegestor/cloud/google/start" onClick={(e)=>{if(data.google.status==="connected"&&!confirm("Ao trocar a conta, os documentos da conta anterior podem ficar indisponíveis até ela ser reconectada. Deseja continuar?"))e.preventDefault();}}>{data.google.status==="connected"?"Trocar / reconectar conta":"Conectar Google Drive"}</a>
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
