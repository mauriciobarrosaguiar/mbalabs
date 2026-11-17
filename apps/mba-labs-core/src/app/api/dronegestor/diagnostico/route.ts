import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic="force-dynamic";
const ACTION="diagnostico_agrodoc_v1";
const TYPES=new Set(["produtor_rural","prestador_servicos","usina","cooperativa"]);
const UFS=new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
const STATUS=new Set(["pendente","andamento","concluido","nao_aplica"]);
const IDS=new Set(["anac","anatel","decea","mapa","caar","crea","ibama","estadual","relatorio"]);
type Context={userId:string;empresaId:string|null;canManage:boolean;userName:string};
function str(v:unknown,n=300){return typeof v==="string"?v.trim().slice(0,n):""}
function object(v:unknown):Record<string,any>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,any>:{}}
async function context():Promise<{user?:Context;error?:NextResponse}>{
 const s=await getSessionProfile();
 if(!s.user||!s.profile)return{error:NextResponse.json({error:"Autenticação necessária."},{status:401})};
 const t=str(s.profile.tipo).toLowerCase(),master=["super_admin","admin_master"].includes(t);
 if(!master&&!(s.appsLiberados??[]).some(a=>a.slug==="dronegestor"&&a.canAccess))
    return{error:NextResponse.json({error:"Acesso ao DroneGestor não liberado."},{status:403})};
 return{user:{userId:s.profile.id,empresaId:s.profile.empresa_id,canManage:canManageDroneGestor({tipo:s.profile.tipo,isAdminMaster:master,permissoes:s.permissoes}),userName:s.profile.nome||"Usuário"}};
}
function scope(q:any,c:Context){return c.empresaId?q.eq("empresa_id",c.empresaId):q.eq("usuario_id",c.userId)}
export async function GET(){
 try{const a=await context();if(a.error)return a.error;const c=a.user!,db=createSupabaseAdminClient() as any;
   const q=scope(db.from("core_logs").select("detalhes,created_at").eq("app_slug","dronegestor").eq("acao",ACTION).order("created_at",{ascending:false}).limit(1),c);
   const {data,error}=await q.maybeSingle();if(error)throw error;
   return NextResponse.json({ok:true,canManage:c.canManage,diagnostico:data?.detalhes?.diagnostico??null,updatedAt:data?.created_at??null});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Falha ao carregar diagnóstico."},{status:500})}
}
export async function POST(request:NextRequest){
 try{const a=await context();if(a.error)return a.error;const c=a.user!;
   if(!c.canManage)return NextResponse.json({error:"Somente administrador/RT pode alterar regularizações."},{status:403});
   const b=object(await request.json()),tipo=str(b.tipo,30),uf=str(b.uf,2).toUpperCase();
   if(!TYPES.has(tipo)||!UFS.has(uf))return NextResponse.json({error:"Informe tipo de operador e UF válidos."},{status:422});
   const raw=object(b.checklist),checklist:Record<string,any>={};
   for(const [id,v] of Object.entries(raw)){
     if(!IDS.has(id))continue;const item=object(v),status=str(item.status,20);
     if(!STATUS.has(status))return NextResponse.json({error:"Status inválido em "+id},{status:422});
     const justificativa=str(item.justificativa,500),validade=str(item.validade,10);
     if(status==="nao_aplica"&&!justificativa)return NextResponse.json({error:"Justifique a não aplicabilidade de "+id},{status:422});
     if(validade&&!/^20\\d{2}-\\d{2}-\\d{2}$/.test(validade))return NextResponse.json({error:"Data inválida em "+id},{status:422});
     checklist[id]={status,validade,numero:str(item.numero,100),justificativa};
   }
   const diagnostico={tipo,uf,modo:str(b.modo,20),documento:str(b.documento,30),quantidadeDrones:Math.max(0,Math.min(999,Math.trunc(Number(b.quantidadeDrones)||0))),checklist,updatedAt:new Date().toISOString()};
   const db=createSupabaseAdminClient() as any;
   const {error}=await db.from("core_logs").insert({empresa_id:c.empresaId,usuario_id:c.userId,app_slug:"dronegestor",acao:ACTION,detalhes:{diagnostico,updatedBy:c.userName,updatedById:c.userId}});
   if(error)throw error;return NextResponse.json({ok:true,diagnostico});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Falha ao salvar diagnóstico."},{status:500})}
}
