import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const OS_ACTION = "ordem_servico";
const DOC_ACTION = "documento_operacao_v1";
const SARPAS_ACTION = "sarpas_operacao_v1";
const MAP_ACTION = "mapa_voo_evidencia";
const PENDING_ACTION = "fechamento_pendente_regularizacao_v1";
const OS_EVENT_ACTION = "ordem_servico_evento";

type Context = { userId:string; userName:string; empresaId:string|null; canManage:boolean };
function normalize(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replaceAll(" ","_");}
function text(v:unknown,max=240){return typeof v==="string"?v.trim().slice(0,max):"";}
function num(v:unknown){const n=Number(v);return Number.isFinite(n)?n:0;}
function obj(v:unknown):Record<string,any>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,any>:{};}
function scope(q:any,c:Context){return c.empresaId?q.eq("empresa_id",c.empresaId):q.eq("usuario_id",c.userId);}
async function context():Promise<{current:Context|null;response:NextResponse|null}>{
  const s=await getSessionProfile();
  if(!s.user||!s.profile)return{current:null,response:NextResponse.json({ok:false,error:"Autenticação necessária."},{status:401})};
  const t=normalize(s.profile.tipo||""),master=["super_admin","admin_master"].includes(t),allowed=(s.appsLiberados??[]).some(a=>a.slug==="dronegestor"&&a.canAccess);
  if(!master&&!allowed)return{current:null,response:NextResponse.json({ok:false,error:"Acesso ao DroneGestor não liberado."},{status:403})};
  return{current:{userId:s.profile.id,userName:s.profile.nome||"Piloto",empresaId:s.profile.empresa_id,canManage:master||["admin_empresa","responsavel_tecnico","rt"].includes(t)},response:null};
}
async function findOs(admin:any,c:Context,osId:string){let q=admin.from("core_logs").select("id,detalhes,created_at").eq("app_slug","dronegestor").eq("acao",OS_ACTION).contains("detalhes",{entityId:osId}).limit(1);q=scope(q,c);const{data,error}=await q.maybeSingle();if(error)throw error;return data;}
async function docsFor(admin:any,c:Context,osId:string){let q=admin.from("core_logs").select("detalhes").eq("app_slug","dronegestor").eq("acao",DOC_ACTION).limit(500);q=scope(q,c);const{data,error}=await q;if(error)throw error;return(data??[]).map((r:any)=>r.detalhes??{}).filter((d:any)=>text(d.ordemServicoId,120)===osId);}
async function latestFor(admin:any,c:Context,action:string,osId:string){let q=admin.from("core_logs").select("detalhes,created_at").eq("app_slug","dronegestor").eq("acao",action).order("created_at",{ascending:false}).limit(100);q=scope(q,c);const{data,error}=await q;if(error)throw error;return(data??[]).find((r:any)=>text(r?.detalhes?.ordemServicoId,120)===osId)||null;}
function allTrue(value:unknown){const o=obj(value),values=Object.values(o);return values.length>0&&values.every(Boolean);}
function buildMissing(snapshot:Record<string,any>,docs:any[],sarpasRow:any,mapRow:any){
  const m=obj(snapshot.mission),missing:string[]=[];
  const add=(condition:boolean,label:string)=>{if(!condition&&!missing.includes(label))missing.push(label);};
  add(Boolean(m.ordemServicoId),"OS vinculada à aplicação");
  add(Boolean(text(m.clienteNome)),"Cliente identificado");
  add(Boolean(text(m.fazendaNome)),"Fazenda identificada");
  add(Boolean(text(m.talhaoNome)),"Talhão identificado");
  add(Boolean(text(m.municipio)&&text(m.uf)),"Município e UF da propriedade");
  add(Boolean(text(m.proprietarioNome)),"Responsável/proprietário da fazenda");
  add(Boolean(text(m.enderecoPropriedade)),"Endereço/localização cadastral da fazenda");
  add(Boolean(text(m.cultura)&&text(m.alvo)&&num(m.area)>0),"Cultura, alvo e área");
  add(Boolean(text(m.drone)&&text(m.registroAnac)&&text(m.pontaModelo)),"Drone, identificação ANAC e bico/atomizador");
  const products=Array.isArray(m.produtos)?m.produtos:[];
  add(Boolean(products.length&&products.every((p:any)=>text(p?.nome)&&num(p?.dose)>0&&text(p?.unidade))),"Produtos, doses e unidades");
  add(allTrue(snapshot.calibration),"Calibração completa");
  add(allTrue(snapshot.checklist),"Checklist pré-voo completo");
  add(Boolean(snapshot.riskAccepted),"Confirmação de risco");
  const weather=obj(snapshot.weather);
  add(Number.isFinite(Number(weather.latitude))&&Number.isFinite(Number(weather.longitude)),"GPS da operação");
  add(num(snapshot.progressHa)>=Math.max(0,num(m.area)-0.01),"100% da área real registrada");
  add(Array.isArray(snapshot.tankRecords)&&snapshot.tankRecords.length>0,"Cargas/abastecimentos reais registrados");
  const types=new Set(docs.map((d:any)=>text(d.tipo,80)));
  if((text(m.tipoAtividade)||"pulverizacao")==="pulverizacao")add(types.has("receituario"),"Receituário agronômico anexado");
  add(types.has("sisant_certidao"),"Certidão SISANT/ANAC anexada");
  const sarpas=obj(sarpasRow?.detalhes),sarpasStatus=text(sarpas.status)||text(m.sarpasSituacao);
  add(["autorizado","dispensado","nao_aplicavel"].includes(sarpasStatus),"Situação SARPAS concluída/conferida");
  if(sarpasStatus==="autorizado")add(types.has("sarpas_autorizacao"),"Comprovante da autorização SARPAS anexado");
  add(Boolean(mapRow)||types.has("mapa_aplicacao"),"Mapa/evidência do voo enviado");
  return missing;
}

export async function POST(request:NextRequest){
  try{
    const a=await context();if(a.response)return a.response;const c=a.current!,body=await request.json(),action=text(body?.action,40),snapshot=obj(body?.snapshot),mission=obj(snapshot.mission),osId=text(body?.osId||mission.ordemServicoId,120);
    if(!osId)return NextResponse.json({ok:false,error:"Nenhuma OS ativa foi encontrada."},{status:400});
    const admin=createSupabaseAdminClient() as any,os=await findOs(admin,c,osId);
    if(!os||os.detalhes?.ativo===false)return NextResponse.json({ok:false,error:"OS não encontrada ou inativa."},{status:404});
    const osData=obj(os.detalhes?.data),assigned=text(osData.pilotoResponsavelId,120);
    if(!c.canManage&&assigned&&assigned!==c.userId)return NextResponse.json({ok:false,error:"Esta OS pertence a outro piloto."},{status:403});
    const [docs,sarpasRow,mapRow]=await Promise.all([docsFor(admin,c,osId),latestFor(admin,c,SARPAS_ACTION,osId),latestFor(admin,c,MAP_ACTION,osId)]);
    const missing=buildMissing(snapshot,docs,sarpasRow,mapRow);
    if(action==="save_pending"){
      const details={osId,osNumero:text(osData.numero),missing,savedAt:new Date().toISOString(),savedBy:c.userName};
      const{error}=await admin.from("core_logs").insert({empresa_id:c.empresaId,usuario_id:c.userId,app_slug:"dronegestor",acao:PENDING_ACTION,detalhes:details});if(error)throw error;
      return NextResponse.json({ok:true,status:missing.length?"pendente_regularizacao":"pronto",missing});
    }
    if(action==="finalize"){
      if(missing.length)return NextResponse.json({ok:false,status:"pendente_regularizacao",missing,error:"Ainda existem informações obrigatórias para regularizar antes do fechamento."},{status:409});
      const now=new Date().toISOString(),nextData={...osData,status:"concluida",finalizadaEm:now};
      const nextDetails={...(os.detalhes??{}),updatedAt:now,data:nextData};
      const{error}=await admin.from("core_logs").update({detalhes:nextDetails}).eq("id",os.id);if(error)throw error;
      await admin.from("core_logs").insert({empresa_id:c.empresaId,usuario_id:c.userId,app_slug:"dronegestor",acao:OS_EVENT_ACTION,detalhes:{osId,evento:"concluida",at:now,usuarioId:c.userId,usuarioNome:c.userName,statusAnterior:text(osData.status)||"em_execucao",fechamentoValidado:true}});
      return NextResponse.json({ok:true,status:"concluida",missing:[]});
    }
    return NextResponse.json({ok:true,status:missing.length?"pendente_regularizacao":"pronto",missing});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha ao validar fechamento."},{status:500});}
}
