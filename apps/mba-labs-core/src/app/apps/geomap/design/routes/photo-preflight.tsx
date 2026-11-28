"use client";
import {useRef,useState} from "react";
import {UploadCloud,MapPin,Images,Trash2,AlertTriangle} from "lucide-react";
import {Button} from "../components/ui/button";
import {Panel,Field,Bar,PageHeader} from "../components/geo/ui";
import {HEADER_LIMIT,inspectPhotoHeader,type PhotoMeta} from "../../photo-preflight";
type Row=PhotoMeta & {name:string;size:number;candidate:boolean};
export function PhotoPreflight(){
 const [rows,setRows]=useState<Row[]>([]),[total,setTotal]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState("");
 const generation=useRef(0),input=useRef<HTMLInputElement>(null);
 async function scan(files:File[]){
  const id=++generation.current;setRows([]);setTotal(files.length);setBusy(true);setNotice("");
  const seen=new Set<string>();const results:Row[]=[];
  for(const file of files){
   if(id!==generation.current)return;
   const key=JSON.stringify([file.name,file.size,file.lastModified]);const candidate=seen.has(key);seen.add(key);
   let meta:PhotoMeta;
   try{meta=inspectPhotoHeader(new Uint8Array(await file.slice(0,HEADER_LIMIT).arrayBuffer()));}
   catch{meta={format:"unsupported",gps:null,camera:null,warning:"Falha de leitura local"}}
   if(id!==generation.current)return;
   results.push({...meta,name:file.name,size:file.size,candidate});
   if(results.length%10===0||results.length===files.length)setRows([...results]);
  }
  if(id===generation.current){setBusy(false);setNotice("Conferência local concluída. Nenhum arquivo foi enviado.");}
 }
 function clear(){generation.current++;setRows([]);setTotal(0);setBusy(false);setNotice("");if(input.current)input.current.value="";}
 const gps=rows.filter(r=>r.gps),unknown=rows.filter(r=>r.format==="unsupported"),duplicates=rows.filter(r=>r.candidate);
 return <div className="space-y-4">
 <Panel title="Etapa 2 — Fotografias">
 <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void scan(Array.from(e.dataTransfer.files));}} className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
 <UploadCloud className="mb-2 size-10 text-primary"/><p className="font-semibold">Arraste e solte as fotografias aqui</p><p className="mb-3 text-xs text-muted-foreground">JPG / TIFF · conferência local, sem upload</p>
 <Button onClick={()=>input.current?.click()}><Images className="size-4"/> Selecionar fotos</Button><input ref={input} type="file" multiple accept=".jpg,.jpeg,.tif,.tiff" className="hidden" onChange={e=>{void scan(Array.from(e.target.files??[]));e.target.value="";}}/>
 </div>
 {total>0&&<div className="mt-4 space-y-3"><div className="grid grid-cols-3 gap-2 text-center">{[[rows.length+"/"+total,"verificados"],[(rows.reduce((s,r)=>s+r.size,0)/1e6).toFixed(1)+" MB","lidos"],[gps.length,"com GPS"]].map(([v,l])=><div key={l} className="rounded-md bg-muted p-2"><p className="font-bold">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>)}</div><Bar value={rows.length/total*100}/><p role="status" className="text-xs">{busy?"Lendo metadados…":notice}</p><div className="grid gap-2 sm:grid-cols-2"><Field label="GPS não localizado" value={rows.length-gps.length}/><Field label="Formato não reconhecido" value={unknown.length}/><Field label="Possíveis duplicatas" value={duplicates.length}/></div>
 <div className="max-h-72 overflow-auto rounded border"><table className="w-full text-left text-xs"><thead><tr className="border-b"><th className="p-2">Arquivo</th><th>Formato</th><th>GPS / observação</th></tr></thead><tbody>{rows.map((r,i)=><tr className="border-b" key={i}><td className="max-w-36 break-all p-2">{r.name}{r.candidate&&<span className="block text-warning">Possível duplicata</span>}</td><td>{r.format}</td><td className="p-2">{r.gps?"GPS localizado":r.warning}{r.camera&&<span className="block text-muted-foreground">{r.camera}</span>}</td></tr>)}</tbody></table></div><Button variant="outline" onClick={clear}><Trash2 className="size-4"/> Limpar seleção</Button></div>}
 <p className="mt-3 text-xs text-muted-foreground">Leitura limitada ao primeiro MiB de cada arquivo. Não verifica nitidez, integridade completa ou precisão. Duplicatas são suspeitas por nome, tamanho e data, não por hash.</p></Panel>
 <Panel title="Distribuição espacial das fotografias">{gps.length?<div className="space-y-2"><p className="text-xs text-muted-foreground">Coordenadas EXIF declaradas; sem mapa base nem validação de precisão.</p><svg viewBox="0 0 320 180" className="w-full rounded border bg-muted" role="img" aria-label="Distribuição relativa das coordenadas das fotos">{(()=>{const lat=gps.map(r=>r.gps!.lat),lon=gps.map(r=>r.gps!.lon);const a=Math.min(...lat),b=Math.max(...lat),c=Math.min(...lon),d=Math.max(...lon);return gps.map((r,i)=><circle key={i} cx={d===c?160:16+(r.gps!.lon-c)/(d-c)*288} cy={b===a?90:164-(r.gps!.lat-a)/(b-a)*148} r="2.5" fill="var(--primary)"/>);})()}</svg></div>:<div className="grid h-48 place-items-center text-center text-muted-foreground"><div><MapPin className="mx-auto mb-2 size-8"/>Nenhuma coordenada lida.</div></div>}</Panel>
 <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"><AlertTriangle className="size-5 shrink-0"/>A seleção é temporária no navegador. Envio e processamento privados ainda não habilitados.</div></div>
}
export function PhotoPreflightPage(){return <div className="mx-auto max-w-5xl"><PageHeader title="Conferir fotografias" subtitle="Verificação local antes do processamento" demo={false}/><PhotoPreflight/></div>}
