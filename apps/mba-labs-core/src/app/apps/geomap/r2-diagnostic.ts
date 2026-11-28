import {createHash,createHmac,randomUUID} from "node:crypto";
type Config={endpoint:string;bucket:string;access:string;secret:string};
type Method="PUT"|"GET"|"DELETE"|"HEAD";
const hash=(s:string|Uint8Array)=>createHash("sha256").update(s).digest("hex");
const hmac=(key:string|Buffer,s:string)=>createHmac("sha256",key).update(s).digest();
export function configFromEnv(env:Record<string,string|undefined>):Config|null{
 if(env.VERCEL_ENV!=="preview")return null;
 const endpoint=env.R2_ENDPOINT?.trim(),bucket=env.R2_BUCKET_NAME?.trim(),access=env.R2_ACCESS_KEY_ID?.trim(),secret=env.R2_SECRET_ACCESS_KEY?.trim();
 if(!endpoint||!access||!secret||bucket!=="mba-geomap")return null;
 if(!/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/?$/i.test(endpoint))return null;
 return {endpoint:endpoint.replace(/\/$/,""),bucket,access,secret};
}
export function signedRequest(c:Config,method:Method,key:string,body:string|Uint8Array<ArrayBuffer>="",now=new Date()){
 if(!/^__geomap_diagnostics\/[a-f0-9-]{36}\.(?:txt|jpg)$/.test(key))throw Error("Diagnostic key invalid");
 const url=new URL(c.endpoint+"/"+c.bucket+"/"+key),date=now.toISOString().replace(/[:-]|\.\d{3}/g,""),day=date.slice(0,8),scope=day+"/auto/s3/aws4_request";
 const payload=hash(body),headers={"host":url.host,"x-amz-content-sha256":payload,"x-amz-date":date};
 const names=Object.keys(headers).join(";");
 const canonical=[method,url.pathname,"",Object.entries(headers).map(([k,v])=>k+":"+v+"\n").join(""),names,payload].join("\n");
 const toSign=["AWS4-HMAC-SHA256",date,scope,hash(canonical)].join("\n");
 const signing=hmac(hmac(hmac(hmac("AWS4"+c.secret,day),"auto"),"s3"),"aws4_request");
 const signature=hmac(signing,toSign).toString("hex");
 return {url:url.href,init:{method,headers:{...headers,Authorization:"AWS4-HMAC-SHA256 Credential="+c.access+"/"+scope+", SignedHeaders="+names+", Signature="+signature},...(method==="PUT"?{body}:{}),redirect:"error" as const,cache:"no-store" as const}};
}
export type Diagnostic={configured:boolean;write:boolean;read:boolean;remove:boolean;absent:boolean;message:string};
export async function runDiagnostic(env:Record<string,string|undefined>,transport:typeof fetch=fetch):Promise<Diagnostic>{
 const result:Diagnostic={configured:false,write:false,read:false,remove:false,absent:false,message:"Variáveis ausentes ou inválidas, ou ambiente não autorizado."};
 const c=configFromEnv(env);if(!c)return result;
 result.configured=true;
 const key="__geomap_diagnostics/"+randomUUID()+".txt",body="MBA GeoMap synthetic storage diagnostic v1";
 const call=(method:Method)=>{const r=signedRequest(c,method,key,method==="PUT"?body:"");return transport(r.url,{...r.init,signal:AbortSignal.timeout(5000)});};
 try{const put=await call("PUT");result.write=put.ok;if(result.write){const get=await call("GET");result.read=get.ok&&(await get.text())===body;}}
 catch{/* Never expose provider errors or request headers */}
 finally{
  // Delete even when PUT timed out: the write may have succeeded remotely.
  try{const del=await call("DELETE");result.remove=del.ok;const head=await call("HEAD");result.absent=head.status===404;}catch{/* Report cleanup not verified */}
 }
 result.message=result.write&&result.read&&result.remove&&result.absent?"Conexão validada: gravação, leitura e exclusão confirmadas.":!result.absent?"Teste incompleto; ausência do arquivo sintético não confirmada. Verifique o prefixo de diagnóstico no bucket.":"Teste incompleto; confira credenciais e permissões.";
 return result;
}
