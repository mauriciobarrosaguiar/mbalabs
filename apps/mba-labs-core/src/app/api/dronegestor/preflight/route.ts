import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const OS_ACTION = "ordem_servico";
const DOC_ACTION = "documento_operacao_v1";
const SARPAS_ACTION = "sarpas_operacao_v1";
const CONFIG_ACTION = "configuracao_empresa_v1";

type Context = { userId:string; empresaId:string|null; canManage:boolean };
type Item = { id:string; label:string; ok:boolean; detail:string; nextView?:string };
const defaults = { insightsObrigatorios:true, margemPreventiva:90, bloquearMargemPreventiva:true, exigirConfirmacao:true };

function normalize(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replaceAll(" ","_");}
function text(value:unknown,max=240){return typeof value==="string"?value.trim().slice(0,max):"";}
function num(value:unknown){const n=Number(value);return Number.isFinite(n)?n:0;}
function obj(value:unknown):Record<string,any>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,any>:{};}
function scope(query:any,current:Context){return current.empresaId?query.eq("empresa_id",current.empresaId):query.eq("usuario_id",current.userId);}
function allTrue(value:unknown){const values=Object.values(obj(value));return values.length>0&&values.every(Boolean);}
function positive(value:unknown){return num(value)>0;}

async function context():Promise<{current:Context|null;response:NextResponse|null}>{
  const session=await getSessionProfile();
  if(!session.user||!session.profile)return{current:null,response:NextResponse.json({ok:false,error:"Autenticação necessária."},{status:401})};
  const type=normalize(session.profile.tipo||""),master=["super_admin","admin_master"].includes(type),allowed=(session.appsLiberados??[]).some(app=>app.slug==="dronegestor"&&app.canAccess);
  if(!master&&!allowed)return{current:null,response:NextResponse.json({ok:false,error:"Acesso ao DroneGestor não liberado."},{status:403})};
  return{current:{userId:session.profile.id,empresaId:session.profile.empresa_id,canManage:master||["admin_empresa","responsavel_tecnico","rt"].includes(type)},response:null};
}
async function findOs(admin:any,current:Context,osId:string){let query=admin.from("core_logs").select("id,detalhes").eq("app_slug","dronegestor").eq("acao",OS_ACTION).contains("detalhes",{entityId:osId}).limit(1);query=scope(query,current);const{data,error}=await query.maybeSingle();if(error)throw error;return data;}
async function docsFor(admin:any,current:Context,osId:string){let query=admin.from("core_logs").select("detalhes").eq("app_slug","dronegestor").eq("acao",DOC_ACTION).order("created_at",{ascending:false}).limit(500);query=scope(query,current);const{data,error}=await query;if(error)throw error;return(data??[]).map((row:any)=>row.detalhes??{}).filter((item:any)=>text(item.ordemServicoId,120)===osId);}
async function latestSarpas(admin:any,current:Context,osId:string){let query=admin.from("core_logs").select("detalhes,created_at").eq("app_slug","dronegestor").eq("acao",SARPAS_ACTION).order("created_at",{ascending:false}).limit(150);query=scope(query,current);const{data,error}=await query;if(error)throw error;return(data??[]).find((row:any)=>text(row?.detalhes?.ordemServicoId,120)===osId)?.detalhes??{};}
async function companySettings(admin:any,current:Context){let query=admin.from("core_logs").select("detalhes").eq("app_slug","dronegestor").eq("acao",CONFIG_ACTION).order("created_at",{ascending:false}).limit(1);query=scope(query,current);const{data,error}=await query.maybeSingle();if(error)throw error;const source=obj(data?.detalhes?.settings);const margin=Number(source.margemPreventiva);return{insightsObrigatorios:source.insightsObrigatorios!==false,margemPreventiva:Number.isFinite(margin)?Math.max(0,Math.min(5000,margin)):defaults.margemPreventiva,bloquearMargemPreventiva:source.bloquearMargemPreventiva!==false,exigirConfirmacao:source.exigirConfirmacao!==false};}

export async function POST(request:NextRequest){
  try{
    const access=await context();if(access.response)return access.response;const current=access.current!;
    const body=await request.json(),snapshot=obj(body?.snapshot),mission=obj(snapshot.mission),osId=text(body?.osId||mission.ordemServicoId,120);
    if(!osId)return NextResponse.json({ok:true,ready:false,nextId:"pilot",items:[],error:"Selecione uma OS para iniciar a conferência."});
    const admin=createSupabaseAdminClient() as any;
    const[os,docs,sarpas,settings]=await Promise.all([findOs(admin,current,osId),docsFor(admin,current,osId),latestSarpas(admin,current,osId),companySettings(admin,current)]);
    if(!os||os.detalhes?.ativo===false)return NextResponse.json({ok:false,error:"OS não encontrada ou inativa."},{status:404});
    const osData=obj(os.detalhes?.data),assignedId=text(osData.pilotoResponsavelId,120),assignedName=text(osData.pilotoResponsavelNome,180);
    const pilotOk=Boolean(assignedId&&assignedName&&(current.canManage||assignedId===current.userId));

    const droneOk=Boolean(text(mission.drone)&&text(mission.registroAnac||mission.identificacaoAnac));
    const products=Array.isArray(mission.produtos)?mission.produtos:[];
    const missionOk=Boolean(text(mission.tipoAtividade)&&text(mission.cultura)&&text(mission.alvo)&&positive(mission.area)&&text(mission.pontaModelo||mission.pontaPulverizacao)&&[mission.volume,mission.tanque,mission.faixa,mission.velocidadeKmh,mission.alturaM].every(positive)&&products.length&&products.every((p:any)=>text(p?.nome)&&positive(p?.dose)&&text(p?.unidade)));

    const sensitive=mission.semAreaSensivel===true||positive(mission.distanciaSensivel);
    const marginBlocked=Boolean(settings.bloquearMargemPreventiva&&mission.semAreaSensivel!==true&&positive(mission.distanciaSensivel)&&num(mission.distanciaSensivel)<settings.margemPreventiva);
    const climate=Boolean(mission.climaCampoConfirmado&&text(mission.climaCampoMedidoEm)&&text(mission.direcaoVentoCampo)&&Number.isFinite(Number(mission.ventoCampoKmh))&&Number.isFinite(Number(mission.temperaturaCampo))&&num(mission.umidadeCampo)>0&&num(mission.umidadeCampo)<=100);
    const riskOk=settings.exigirConfirmacao===false||snapshot.riskAccepted===true;
    const insightOk=settings.insightsObrigatorios===false||snapshot.insightAccepted===true;
    const safetyCore=Boolean(sensitive&&!marginBlocked&&climate&&riskOk&&insightOk);
    const calibrationOk=allTrue(snapshot.calibration),checklistOk=allTrue(snapshot.checklist);
    const safetyOk=safetyCore&&calibrationOk&&checklistOk;
    const safetyDetail=!safetyCore?"Conclua clima, área de risco e confirmação de segurança.":!calibrationOk?"Faça a calibração do sistema na sequência indicada.":!checklistOk?"Complete o checklist pré-voo.":"Clima, risco, calibração e checklist conferidos.";
    const safetyNext=!safetyCore?"seguranca":!calibrationOk?"calibracao":"checklist";

    const types=new Set(docs.map((item:any)=>text(item.tipo,80)));
    const pulverizacao=(text(mission.tipoAtividade)||"pulverizacao")==="pulverizacao";
    const sisantOk=types.has("sisant_certidao"),receitaOk=!pulverizacao||types.has("receituario");
    const documentsOk=sisantOk&&receitaOk;
    const documentsDetail=!sisantOk?"Falta anexar a Certidão SISANT/ANAC do drone.":!receitaOk?"Falta anexar o receituário desta pulverização.":pulverizacao?"SISANT/ANAC e receituário conferidos.":"Documentos básicos da operação conferidos.";

    const sarpasStatus=text(sarpas.status),sarpasNumber=text(sarpas.numero)||text(mission.sarpasNumero),sarpasDoc=types.has("sarpas_autorizacao");
    const sarpasOk=sarpasStatus==="autorizado"&&Boolean(sarpasNumber)&&sarpasDoc;
    const sarpasDetail=sarpasStatus!=="autorizado"?"A autorização SARPAS ainda não está registrada como autorizada.":!sarpasNumber?"Informe o número/referência emitido no SARPAS.":!sarpasDoc?"Falta anexar o comprovante da autorização SARPAS.":`Autorização SARPAS conferida • ${sarpasNumber}`;

    const weather=obj(snapshot.weather),gpsOk=Number.isFinite(Number(weather.latitude))&&Number.isFinite(Number(weather.longitude));
    const items:Item[]=[
      {id:"pilot",label:"Piloto",ok:pilotOk,detail:pilotOk?`Responsável: ${assignedName}`:"Defina quem será o piloto responsável por esta OS."},
      {id:"drone",label:"Drone",ok:droneOk,detail:droneOk?`${text(mission.drone)} • ANAC ${text(mission.registroAnac||mission.identificacaoAnac)}`:"Selecione um drone cadastrado com identificação ANAC.",nextView:"nova"},
      {id:"mission",label:"Missão",ok:missionOk,detail:missionOk?"Dados técnicos e produtos completos.":"Complete cultura, alvo, área, parâmetros e produtos.",nextView:"nova"},
      {id:"safety",label:"Segurança",ok:safetyOk,detail:safetyDetail,nextView:safetyNext},
      {id:"documents",label:"Documentos",ok:documentsOk,detail:documentsDetail},
      {id:"sarpas",label:"SARPAS",ok:sarpasOk,detail:sarpasDetail},
      {id:"gps",label:"GPS",ok:gpsOk,detail:gpsOk?`Localização registrada: ${Number(weather.latitude).toFixed(5)}, ${Number(weather.longitude).toFixed(5)}`:"Capture o GPS no local da operação.",nextView:"seguranca"}
    ];
    const ready=items.every(item=>item.ok),next=items.find(item=>!item.ok)||null;
    return NextResponse.json({ok:true,ready,nextId:next?.id||"",nextView:next?.nextView||"",items,osStatus:text(osData.status),pilotName:assignedName});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha ao conferir a liberação pré-voo."},{status:500});}
}
