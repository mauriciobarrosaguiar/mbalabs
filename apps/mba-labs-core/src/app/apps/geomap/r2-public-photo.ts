import {createHash,randomUUID} from "node:crypto";
import {configFromEnv,signedRequest} from "./r2-diagnostic";
import {inspectPhotoHeader,HEADER_LIMIT} from "./photo-preflight";
export const FIXTURE_URL="https://raw.githubusercontent.com/merkato/odm_mygla_dataset/cf0ef2f1dd779c04fc0d55324692c60fe6cc7597/images/dji_0019.jpg";
const EXPECTED_SIZE=4934346,EXPECTED_GIT_SHA="acfc0a46039e7b5cbfc9f053863fdf6b4d6d1edd";
const digest=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex");
async function bounded(response:Response,limit:number):Promise<Uint8Array<ArrayBuffer>>{
 if(!response.ok||!response.body)throw Error("Response unavailable");
 const reader=response.body.getReader(),out=new Uint8Array(limit);
 let length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;if(length+value.byteLength>limit){await reader.cancel();throw Error("Response too large");}out.set(value,length);length+=value.byteLength;}}finally{reader.releaseLock();}
 return out.slice(0,length);
}
export type PublicPhotoResult={source:boolean;bytes:number;gps:boolean;camera:string|null;write:boolean;integrity:boolean;remove:boolean;absent:boolean;message:string};
export async function testPublicPhoto(env:Record<string,string|undefined>,transport:typeof fetch=fetch):Promise<PublicPhotoResult>{
 const r:PublicPhotoResult={source:false,bytes:0,gps:false,camera:null,write:false,integrity:false,remove:false,absent:false,message:"Configuração indisponível."};
 const cfg=configFromEnv(env);if(!cfg)return r;
 let photo:Uint8Array<ArrayBuffer>;
 try{
  photo=await bounded(await transport(FIXTURE_URL,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)}),EXPECTED_SIZE);
  const gitSha=createHash("sha1").update("blob "+photo.byteLength+"\0").update(photo).digest("hex");
  if(photo.byteLength!==EXPECTED_SIZE||gitSha!==EXPECTED_GIT_SHA)throw Error("Fixture mismatch");
  r.source=true;r.bytes=photo.byteLength;
  const meta=inspectPhotoHeader(photo.subarray(0,HEADER_LIMIT));r.gps=!!meta.gps;r.camera=meta.camera;
 }catch{r.message="Amostra pública indisponível ou divergente; nenhuma gravação iniciada.";return r;}
 const key="__geomap_diagnostics/"+randomUUID()+".jpg";
 const call=(method:"PUT"|"GET"|"DELETE"|"HEAD")=>{const req=signedRequest(cfg,method,key,method==="PUT"?photo:"");return transport(req.url,{...req.init,signal:AbortSignal.timeout(10000)});};
 try{r.write=(await call("PUT")).ok;if(r.write){const read=await bounded(await call("GET"),EXPECTED_SIZE);r.integrity=read.byteLength===photo.byteLength&&digest(read)===digest(photo);}}catch{}
 finally{try{r.remove=(await call("DELETE")).ok;r.absent=(await call("HEAD")).status===404;}catch{}}
 r.message=r.write&&r.integrity&&r.remove&&r.absent?"Transferência da fotografia pública e limpeza confirmadas.":!r.absent?"Limpeza não confirmada; verifique o prefixo __geomap_diagnostics no bucket.":"Transferência incompleta.";
 return r;
}
