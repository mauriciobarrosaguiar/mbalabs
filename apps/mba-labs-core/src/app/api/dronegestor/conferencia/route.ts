import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";
const FINALIZED = "operacao_finalizada";
export const REVIEW_ACTION = "operacao_revisao_mapa_2026_v1";
const CATEGORIES = new Set(["agrotoxico","bioinsumo","outros","semeadura"]);
const STAGES = new Set(["aprovado","correcao"]);
const MONTH = /^20\d{2}-(0[1-9]|1[0-2])$/;
const TYPES = new Set(["APLICAÇÃO DE AGROTÓXICO","APLICAÇÃO DE BIOINSUMO","APLICAÇÃO DE FERTILIZANTE","APLICAÇÃO ADJUVANTE","SEMEADURA","OUTROS"]);
type Scope = { userId:string; empresaId:string|null; canManage:boolean; userName:string };
function value(v:unknown,max=180){return typeof v==="string"?v.trim().slice(0,max):""}
function number(v:unknown){const n=Number(v);return Number.isFinite(n)?n:0}
function reportMonth(date:string){const n=Date.parse(date);if(!Number.isFinite(n))return "";const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Araguaina",year:"numeric",month:"2-digit"}).formatToParts(new Date(n));return `${parts.find(p=>p.type==="year")?.value}-${parts.find(p=>p.type==="month")?.value}`;}
function record(v:unknown):Record<string,any>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,any>:{}}
function scoped(q:any,c:Scope){return c.empresaId?q.eq("empresa_id",c.empresaId):q.eq("usuario_id",c.userId)}
async function context():Promise<{user?:Scope;error?:NextResponse}>{
  const session=await getSessionProfile();
  if(!session.user||!session.profile)return {error:NextResponse.json({error:"Entre na MBA Labs."},{status:401})};
  const type=value(session.profile.tipo).toLowerCase();
  const master=["super_admin","admin_master"].includes(type);
  const allowed=(session.appsLiberados??[]).some(app=>app.slug==="dronegestor"&&app.canAccess);
  if(!master&&!allowed)return {error:NextResponse.json({error:"DroneGestor não liberado."},{status:403})};
  const canManage=canManageDroneGestor({tipo:session.profile.tipo,isAdminMaster:master,permissoes:session.permissoes});
  if(!canManage)return {error:NextResponse.json({error:"Somente gestor ou responsável técnico pode revisar registros."},{status:403})};
  return {user:{userId:session.profile.id,empresaId:session.profile.empresa_id,canManage,userName:session.profile.nome||"Gestor"}};
}
export async function GET(req:NextRequest){
  try{
    const access=await context();if(access.error)return access.error;
    const c=access.user!,month=value(req.nextUrl.searchParams.get("month"),7);
    if(!MONTH.test(month))return NextResponse.json({error:"Informe uma competência AAAA-MM válida."},{status:400});
    const admin=createSupabaseAdminClient() as any;
    const operations=admin.from("core_logs").select("id,usuario_id,created_at,detalhes")
      .eq("app_slug","dronegestor").eq("acao",FINALIZED).order("created_at",{ascending:false}).limit(3000);
    const reviews=admin.from("core_logs").select("id,created_at,detalhes,usuario_id")
      .eq("app_slug","dronegestor").eq("acao",REVIEW_ACTION).order("created_at",{ascending:true}).limit(5000);
    const [opResult,reviewResult]=await Promise.all([scoped(operations,c),scoped(reviews,c)]);
    if(opResult.error)throw opResult.error;if(reviewResult.error)throw reviewResult.error;
    const byOperation=new Map<string,any>();
    for(const entry of reviewResult.data??[])byOperation.set(value(entry.detalhes?.operationEventId,120),{...entry.detalhes,reviewedAt:entry.created_at});
    const rows=(opResult.data??[]).filter((e:any)=>{
      const s=record(e.detalhes?.summary), date=value(s.finalizadaEm)||value(e.detalhes?.finalizedAt)||value(e.created_at);
      return reportMonth(date)===month;
    }).map((e:any)=>({id:e.id,createdAt:e.created_at,summary:record(e.detalhes?.summary),review:byOperation.get(String(e.id))??null}));
    return NextResponse.json({ok:true,month,items:rows,canManage:true});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Falha ao consultar conferência."},{status:500})}
}
export async function POST(req:NextRequest){
  try{
    const access=await context();if(access.error)return access.error;const c=access.user!,admin=createSupabaseAdminClient() as any;
    const body=record(await req.json()),operationEventId=value(body.operationEventId,120),status=value(body.status,30);
    if(!operationEventId||!STAGES.has(status))return NextResponse.json({error:"Operação e decisão são obrigatórias."},{status:400});
    const {data:operation,error:opError}=await scoped(admin.from("core_logs").select("id,detalhes,created_at")
      .eq("id",operationEventId).eq("app_slug","dronegestor").eq("acao",FINALIZED),c).maybeSingle();
    if(opError)throw opError;if(!operation)return NextResponse.json({error:"Registro não encontrado nessa empresa."},{status:404});
    const s=record(operation.detalhes?.summary);
    const details={operationEventId,status,category:value(body.category,30),classe:value(body.classe,120),horasAplicacao:value(body.horasAplicacao,8),
      tipoAeronave:value(body.tipoAeronave,120),tipoServico:value(body.tipoServico,120),
      observacao:value(body.observacao,1500),reviewedById:c.userId,reviewedByName:c.userName,
      sourceCompletedAt:value(s.finalizadaEm)||value(operation.detalhes?.finalizedAt)||value(operation.created_at),
      reviewedAt:new Date().toISOString()};
    if(status==="correcao"&&!details.observacao)return NextResponse.json({error:"Informe o motivo da correção para o piloto."},{status:400});
    if(status==="aprovado"){
      const missing:string[]=[];
      if(!value(s.uf)||!value(s.municipio))missing.push("UF/município");
      if(!value(s.registroAnac)||!value(s.drone))missing.push("drone e prefixo ANAC");
      if(!value(s.cultura)||!details.tipoServico)missing.push("cultura e tipo de serviço");
      if(!details.tipoAeronave)missing.push("tipo de aeronave");
      if(!/^(\d{1,3}):([0-5]\d)$/.test(details.horasAplicacao)||details.horasAplicacao==="00:00")missing.push("horas efetivas HH:MM, sem paralisações");
      if(!TYPES.has(details.tipoServico))missing.push("tipo de serviço conforme lista MAPA");
      if(number(s.areaConcluidaHa??s.areaHa)<=0)missing.push("área realizada");
      if(!s.iniciadaEm||!s.finalizadaEm||Date.parse(s.finalizadaEm)<=Date.parse(s.iniciadaEm))missing.push("horários válidos");
      const products=Array.isArray(s.produtos)?s.produtos:[];
      if(products.length!==1)missing.push("operação com um único produto para exportação automática");
      if(products.some((p:any)=>!value(p.nome)||number(p.dose)<=0||!value(p.unidade)))missing.push("produto, dose e unidade");
      if(!CATEGORIES.has(details.category))missing.push("categoria do produto");
      if(details.category==="agrotoxico"&&details.tipoServico!=="APLICAÇÃO DE AGROTÓXICO")missing.push("categoria e serviço de agrotóxico incompatíveis");
      if(details.category==="bioinsumo"&&details.tipoServico!=="APLICAÇÃO DE BIOINSUMO")missing.push("categoria e serviço de bioinsumo incompatíveis");
      if(details.category==="semeadura"&&details.tipoServico!=="SEMEADURA")missing.push("categoria e serviço de semeadura incompatíveis");
      if(["agrotoxico","bioinsumo"].includes(details.category)&&!details.classe)missing.push("classe do produto");
      if(missing.length)return NextResponse.json({error:"Não é possível aprovar: "+missing.join("; ")+".",pending:missing},{status:422});
    }
    const {error}=await admin.from("core_logs").insert({empresa_id:c.empresaId,usuario_id:c.userId,app_slug:"dronegestor",acao:REVIEW_ACTION,detalhes:details});
    if(error)throw error;
    return NextResponse.json({ok:true,review:details});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Falha ao salvar conferência."},{status:500})}
}
