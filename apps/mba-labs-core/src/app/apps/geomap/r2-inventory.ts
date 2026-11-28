import {configFromEnv,signedRequest} from "./r2-diagnostic";
import {parseInventory,type Inventory} from "./r2-inventory-parse";
export type {Inventory} from "./r2-inventory-parse";
export async function readInventory(env:Record<string,string|undefined>,transport:typeof fetch=fetch):Promise<Inventory>{
 const fail={ok:false,bytes:0,objects:0,complete:false,message:"Não foi possível consultar o inventário."};
 const cfg=configFromEnv(env);if(!cfg)return fail;
 try{const req=signedRequest(cfg,"GET","");const response=await transport(req.url,{...req.init,signal:AbortSignal.timeout(10000)});if(!response.ok||!response.body)return fail;
 const reader=response.body.getReader();const decoder=new TextDecoder();let xml="",length=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>2_000_000){await reader.cancel();return fail;}xml+=decoder.decode(value,{stream:true});}xml+=decoder.decode();}finally{reader.releaseLock();}
 return parseInventory(xml);
 }catch{return fail;}
}
