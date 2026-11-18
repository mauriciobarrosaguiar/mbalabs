"use client";

const MIME:Record<string,string>={
  pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",
  xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  mp4:"video/mp4",mov:"video/quicktime",zip:"application/zip",
  kml:"application/vnd.google-earth.kml+xml",kmz:"application/vnd.google-earth.kmz"
};
type UploadResult={ok:boolean;id?:string;status?:string;sessionUrl?:string;duplicate?:boolean;error?:string};
async function request(body:Record<string,unknown>):Promise<UploadResult>{
  const r=await fetch("/api/dronegestor/cloud/upload",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
  });
  const p=await r.json().catch(()=>({})) as UploadResult;
  if(!r.ok||!p.ok)throw new Error(p.error||"Erro de upload.");
  return p;
}
export async function uploadAgroDocToDrive(input:{
  file:File;osId:string;category:string;onProgress?:(value:number)=>void
}, retrying=false):Promise<UploadResult>{
  const {file,osId,category,onProgress}=input;
  const mimeType=MIME[file.name.split(".").pop()?.toLowerCase()||""];
  if(!mimeType)throw new Error("Tipo inválido. Use PDF, imagens, XLSX, MP4, MOV, ZIP, KML ou KMZ.");
  const hash=file.size<=50*1024*1024
    ?Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await file.arrayBuffer())))
      .map(x=>x.toString(16).padStart(2,"0")).join(""):"";
  const fingerprintData=new TextEncoder().encode(file.name+":"+file.size+":"+file.lastModified);
  const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",fingerprintData)))
    .map(x=>x.toString(16).padStart(2,"0")).join("");
  const start=await request({action:"start",osId,category,name:file.name,mimeType,size:file.size,sha256:hash,fingerprint});
  if(start.status==="synced"){onProgress?.(100);return start;}
  if(!start.sessionUrl||!start.id)throw new Error("Sessão de upload não disponível.");
  const url=start.sessionUrl;
  let position=0;
  if(start.duplicate){
    const status=await fetch(url,{method:"PUT",headers:{"Content-Range":"bytes */"+file.size}});
    if(status.status===308){
      const range=status.headers.get("range");
      if(range){const match=/bytes=0-(\d+)/.exec(range);if(!match)throw new Error("Faixa inválida.");position=Number(match[1])+1;}
    }else if(status.ok)position=file.size;
    else if([404,410].includes(status.status)&&!retrying){
      await request({action:"restart",documentId:start.id});
      onProgress?.(0);
      return uploadAgroDocToDrive(input,true);
    }else throw new Error("Sessão de envio inválida. Atualize a lista de pendências.");
  }
  const chunk=4*1024*1024;
  while(position<file.size){
    const end=Math.min(position+chunk,file.size);
    let response:Response;
    try{
      response=await fetch(url,{
        method:"PUT",
        headers:{"Content-Range":"bytes "+position+"-"+(end-1)+"/"+file.size},
        body:file.slice(position,end)
      });
    }catch{throw new Error("Internet interrompida. Selecione o mesmo arquivo para retomar.");}
    if([404,410].includes(response.status)&&!retrying){
      await request({action:"restart",documentId:start.id});
      onProgress?.(0);
      return uploadAgroDocToDrive(input,true);
    }
    if(response.status!==308&&!response.ok)throw new Error("Drive recusou envio HTTP "+response.status);
    if(response.status===308){
      const range=response.headers.get("range");
      const match=range&&/bytes=0-(\d+)/.exec(range);
      if(!match)throw new Error("O navegador não consegue ler a faixa recebida pelo Drive.");
      const next=Number(match[1])+1;
      if(next<=position)throw new Error("Envio não avançou.");
      position=next;
    }else position=end;
    onProgress?.(Math.min(99,Math.round(position/file.size*100)));
  }
  for(let n=0;n<3;n++){
    try{const p=await request({action:"complete",documentId:start.id});onProgress?.(100);return p;}
    catch(e){if(n===2)throw e;await new Promise(ok=>setTimeout(ok,800*(n+1)));}
  }

  throw new Error("Confirmação do upload não foi concluída.");
}