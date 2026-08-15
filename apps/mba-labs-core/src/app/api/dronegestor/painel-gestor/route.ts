import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const OS_ACTION="ordem_servico";
const STATE_ACTION="estado_campo_v2";
const SARPAS_ACTION="sarpas_operacao_v1";
const ACTIONS={cliente:"cadastro_cliente",fazenda:"cadastro_fazenda",talhao:"cadastro_talhao"} as const;

type Context={userId:string;empresaId:string|null;canManage:boolean};
function normalize(v:string){return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replaceAll(" ","_")}
function text(v:unknown,max=220){return typeof v==="string"?v.trim().slice(0,max):""}
function num(v:unknown){const n=Number(v);return Number.isFinite(n)?n:0}
function obj(v:unknown):Record<string,any>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,any>: {}}
async function context():Promise<{current:Context|null;response:NextResponse|null}>{
  const s=await getSessionProfile();
  if(!s.user||!s.profile)return{current:null,response:NextResponse.json({ok:false,error:"Autenticação necessária."},{status:401})};
  const t=normalize(s.profile.tipo||""),master=["super_admin","admin_master"].includes(t),allowed=(s.appsLiberados??[]).some(a=>a.slug==="dronegestor"&&a.canAccess),canManage=canManageDroneGestor({tipo:s.profile.tipo,isAdminMaster:master,permissoes:s.permissoes});
  if(!master&&!allowed)return{current:null,response:NextResponse.json({ok:false,error:"Acesso ao DroneGestor não liberado."},{status:403})};
  if(!canManage)return{current:null,response:NextResponse.json({ok:false,error:"Somente gestor ou RT pode acessar este painel."},{status:403})};
  return{current:{userId:s.profile.id,empresaId:s.profile.empresa_id,canManage},response:null};
}
function scope(q:any,c:Context){return c.empresaId?q.eq("empresa_id",c.empresaId):q.eq("usuario_id",c.userId)}
async function rows(admin:any,c:Context,action:string,limit=500){let q=admin.from("core_logs").select("id,usuario_id,detalhes,created_at").eq("app_slug","dronegestor").eq("acao",action).order("created_at",{ascending:false}).limit(limit);q=scope(q,c);const{data,error}=await q;if(error)throw error;return data??[]}
async function entityMap(admin:any,c:Context,action:string){const data=await rows(admin,c,action,500);return new Map(data.filter((r:any)=>r.detalhes?.ativo!==false).map((r:any)=>[String(r.detalhes?.entityId||""),r.detalhes?.data??{}]))}
function normalizeStatus(raw:unknown){const s=text(raw,40);return s==="em_preparacao"?"preparacao":s||"aberta"}
function priority(stage:string){return({aplicando:1,pausada:2,aguardando_sarpas:3,preparacao:4,regularizacao:5,pronta_encerrar:6,aberta:7,encerrada:8,cancelada:9} as Record<string,number>)[stage]??20}

export async function GET(){
  try{
    const a=await context();if(a.response)return a.response;const c=a.current!,admin=createSupabaseAdminClient() as any;
    const [osRows,stateRows,sarpasRows,clientes,fazendas,talhoes]=await Promise.all([
      rows(admin,c,OS_ACTION,500),rows(admin,c,STATE_ACTION,500),rows(admin,c,SARPAS_ACTION,500),
      entityMap(admin,c,ACTIONS.cliente),entityMap(admin,c,ACTIONS.fazenda),entityMap(admin,c,ACTIONS.talhao)
    ]);

    const latestStateByUser=new Map<string,any>();
    for(const row of stateRows){const id=String(row.usuario_id||"");if(id&&!latestStateByUser.has(id))latestStateByUser.set(id,row)}
    const latestSarpasByOs=new Map<string,any>();
    for(const row of sarpasRows){const id=text(row?.detalhes?.ordemServicoId,120);if(id&&!latestSarpasByOs.has(id))latestSarpasByOs.set(id,row)}

    const items=osRows.filter((r:any)=>r.detalhes?.ativo!==false).map((row:any)=>{
      const osId=String(row.detalhes?.entityId||""),d=obj(row.detalhes?.data),status=normalizeStatus(d.status),pilotId=text(d.pilotoResponsavelId||d.pilotoId,100),pilotName=text(d.pilotoResponsavelNome||d.pilotoNome,180)||"Piloto não definido";
      const client:any=clientes.get(String(d.clienteId||""))??{},farm:any=fazendas.get(String(d.fazendaId||""))??{},plot:any=talhoes.get(String(d.talhaoId||""))??{};
      const stateRow=pilotId?latestStateByUser.get(pilotId):null,state=obj(stateRow?.detalhes?.state),mission=obj(state.mission),sameOs=Boolean(stateRow&&text(mission.ordemServicoId,120)===osId),live=sameOs?state:{};
      const paused=sameOs&&(live.paused===true||text(live.missionStatus,40)==="pausada"),progress=Math.max(0,num(live.progressHa)),area=Math.max(0,num(d.areaHa)||num(mission.area)),percent=area>0?Math.min(100,progress/area*100):0;
      const sarpasRow=latestSarpasByOs.get(osId),sarpas=obj(sarpasRow?.detalhes),sarpasStatus=text(sarpas.status,40)||"nao_solicitado";
      const pending=Array.isArray(d.pendenciasFechamento)?d.pendenciasFechamento.filter((x:any)=>typeof x==="string"&&x.trim()).slice(0,20):[],closure=text(d.fechamentoStatus,50);
      let stage="aberta",stageLabel="Aguardando preparação",nextAction="Preparar a OS";
      if(status==="cancelada"){stage="cancelada";stageLabel="Cancelada";nextAction="Nenhuma ação"}
      else if(status==="concluida"){stage="encerrada";stageLabel="OS encerrada";nextAction="Consultar histórico"}
      else if(status==="campo_concluido"){
        if(closure==="pronto"){stage="pronta_encerrar";stageLabel="Pronta para encerrar";nextAction="Conferir e encerrar a OS"}
        else{stage="regularizacao";stageLabel="Campo concluído • regularização";nextAction=pending[0]||"Conferir o pacote da operação"}
      }
      else if(status==="em_execucao"){stage=paused?"pausada":"aplicando";stageLabel=paused?"Aplicação pausada":"Aplicando agora";nextAction=paused?"Acompanhar retomada":"Acompanhar aplicação"}
      else if(status==="suspensa"){stage="pausada";stageLabel="Operação suspensa";nextAction="Definir retomada ou cancelamento"}
      else if(status==="preparacao"){
        if(sarpasStatus!=="autorizado"){stage="aguardando_sarpas";stageLabel=sarpasStatus==="solicitado"?"Aguardando SARPAS":"SARPAS pendente";nextAction=sarpasStatus==="solicitado"?"Aguardar resposta do SARPAS":"Concluir SARPAS e documentos"}
        else{stage="preparacao";stageLabel="Em preparação";nextAction="Concluir conferências pré-voo"}
      }
      const lastSync=sameOs?text(stateRow?.detalhes?.updatedAt,50)||text(stateRow?.created_at,50):"";
      return{osId,numero:text(d.numero,80)||"OS",status,stage,stageLabel,nextAction,pilotId,pilotName,cliente:text(client.nome,180)||"Cliente",fazenda:text(farm.nome,180)||"Fazenda",talhao:text(plot.nome,180)||"Talhão",municipio:text(farm.municipio,120),uf:text(farm.uf,2),cultura:text(d.cultura,120),alvo:text(d.alvo,160),areaHa:area,progressHa:progress,percent,tanks:sameOs&&Array.isArray(live.tankRecords)?live.tankRecords.length:0,occurrences:sameOs&&Array.isArray(live.occurrences)?live.occurrences.length:0,paused,sarpasStatus,sarpasNumero:text(sarpas.numero,120),closureStatus:closure,pending,lastSync,dataPrevista:text(d.dataPrevista,30),createdAt:row.created_at};
    }).sort((a:any,b:any)=>priority(a.stage)-priority(b.stage)||String(b.createdAt).localeCompare(String(a.createdAt)));

    const counts={total:items.filter((i:any)=>!["encerrada","cancelada"].includes(i.stage)).length,aplicando:items.filter((i:any)=>i.stage==="aplicando").length,pausada:items.filter((i:any)=>i.stage==="pausada").length,aguardandoSarpas:items.filter((i:any)=>i.stage==="aguardando_sarpas").length,regularizacao:items.filter((i:any)=>i.stage==="regularizacao").length,prontaEncerrar:items.filter((i:any)=>i.stage==="pronta_encerrar").length};
    return NextResponse.json({ok:true,items,counts,updatedAt:new Date().toISOString()});
  }catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha ao carregar painel do gestor."},{status:500})}
}
