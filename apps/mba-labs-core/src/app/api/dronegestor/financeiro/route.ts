import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canAdministerDroneCompany, isDroneSystemAdministrator } from "@/lib/dronegestor-company-access";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import { financeToday, nextFinanceState, validateFinanceInput, type FinanceEntry } from "@/lib/agrovoo-finance";

export const dynamic="force-dynamic";
const TABLE="agrovoo_finance_entries";
const fields="id,kind,description,category,amount_cents,due_date,status,settled_date";
const reply=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function access(){
  const s=await getSessionProfile();
  if(!s.user||!s.profile||s.profile.status!=="ativo")return {response:reply({ok:false,error:"Autenticação necessária."},401),context:null};
  const role={tipo:s.profile.tipo,permissoes:s.permissoes};
  const allowed=(s.appsLiberados??[]).some(app=>app.slug==="dronegestor"&&app.canAccess);
  if((!allowed&&!isDroneSystemAdministrator(role))||!canAdministerDroneCompany(role))return {response:reply({ok:false,error:"Financeiro restrito à administração da empresa."},403),context:null};
  if(process.env.AGROVOO_FINANCE_ENABLED!=="true")return {response:reply({ok:false,disabled:true,error:"Financeiro real ainda não habilitado. Aguardando homologação do armazenamento isolado."},503),context:null};
  return {response:null,context:{scope_kind:s.profile.empresa_id?"empresa":"usuario",scope_id:s.profile.empresa_id||s.profile.id,user:s.profile.id}};
}
function scope(query:any,c:{scope_kind:string;scope_id:string}){return query.eq("scope_kind",c.scope_kind).eq("scope_id",c.scope_id);}
const unavailable=()=>reply({ok:false,error:"Não foi possível acessar o financeiro. Nenhum resultado presumido."},503);
export async function GET(){
  try{
    const a=await access();if(a.response)return a.response;
    const c=a.context!,db=createSupabaseAdminClient() as any;
    const {data,error,count}=await scope(db.from(TABLE).select(fields,{count:"exact"}),c).order("due_date",{ascending:false}).order("id",{ascending:true}).limit(1000);
    if(error)return unavailable();
    if(count===null||typeof count!=="number"||count>(data??[]).length)return reply({ok:false,error:"Limite de consulta atingido. A paginação integral no servidor é necessária antes de exibir totais."},422);
    return reply({ok:true,items:data??[]});
  }catch{return unavailable();}
}
export async function POST(request:NextRequest){
  try{
    const a=await access();if(a.response)return a.response;
    const c=a.context!;let data;try{data=validateFinanceInput(await request.json());}catch(e){return reply({ok:false,error:e instanceof Error?e.message:"Lançamento inválido."},400);}
    const db=createSupabaseAdminClient() as any;
    const {data:row,error}=await db.from(TABLE).insert({...data,scope_kind:c.scope_kind,scope_id:c.scope_id,created_by:c.user,status:"pendente",settled_date:null}).select(fields).single();
    if(error)return unavailable();
    return reply({ok:true,item:row},201);
  }catch{return unavailable();}
}
export async function PATCH(request:NextRequest){
  try{
    const a=await access();if(a.response)return a.response;
    const c=a.context!,body=await request.json().catch(()=>null),id=body?.id;
    if(typeof id!=="string"||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))return reply({ok:false,error:"Lançamento inválido."},400);
    const db=createSupabaseAdminClient() as any;
    const {data:entry,error}=await scope(db.from(TABLE).select(fields),c).eq("id",id).maybeSingle();
    if(error)return unavailable();
    if(!entry)return reply({ok:false,error:"Lançamento não encontrado."},404);
    let next;try{next=nextFinanceState(entry as FinanceEntry,body.action,body.date,financeToday());}catch(e){return reply({ok:false,error:e instanceof Error?e.message:"Transição inválida."},409);}
    const {data:updated,error:updateError}=await scope(db.from(TABLE).update({...next,updated_at:new Date().toISOString(),updated_by:c.user}),c).eq("id",id).eq("status","pendente").select(fields).maybeSingle();
    if(updateError)return unavailable();
    if(!updated)return reply({ok:false,error:"Lançamento alterado por outra sessão. Atualize a página."},409);
    return reply({ok:true,item:updated});
  }catch{return unavailable();}
}
