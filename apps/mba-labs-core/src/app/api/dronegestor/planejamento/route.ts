import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/core-data';
import { canManageDroneGestor } from '@/lib/dronegestor-role';
import { createSupabaseAdminClient } from '@mba-labs/shared/supabase/server';
import { DroneOsAccessError, droneOsErrorResponse, requireDroneOsAccess, scopeDroneOsQuery } from '@/lib/dronegestor-os-access';
import { validateDronePlan } from '@/lib/dronegestor-planning';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
async function context(){
 const s=await getSessionProfile();
 if(!s.user||!s.profile)throw new DroneOsAccessError('Autenticação necessária.',401);
 if(s.profile.status!=='ativo'||!canManageDroneGestor({tipo:s.profile.tipo,permissoes:s.permissoes}))throw new DroneOsAccessError('Somente gestor ou responsável técnico pode planejar a missão.',403);
 if(!['super_admin','admin_master'].includes(s.profile.tipo)&&!(s.appsLiberados??[]).some(a=>a.slug==='dronegestor'&&a.canAccess))throw new DroneOsAccessError('DroneGestor não liberado.',403);
 return {admin:createSupabaseAdminClient() as any,current:{userId:s.profile.id,empresaId:s.profile.empresa_id,canManage:true}};
}
function failure(e:unknown){const a=droneOsErrorResponse(e);return NextResponse.json({ok:false,error:a?.message||'Não foi possível salvar o planejamento. Atualize e tente novamente.'},{status:a?.status||500,headers});}
function editable(status:string){return ['aberta','preparacao','em_preparacao'].includes(status||'aberta');}
export async function GET(request:NextRequest){try{
 const {admin,current}=await context();const id=request.nextUrl.searchParams.get('osId')||'';const os=await requireDroneOsAccess(admin,current,id);
 const q=scopeDroneOsQuery(admin.from('core_logs').select('detalhes').eq('app_slug','dronegestor').eq('acao','cadastro_equipamento').limit(500),current);
 const result=await q;if(result.error)throw result.error;
 return NextResponse.json({ok:true,os:{id,numero:os.data.numero,areaHa:os.data.areaHa,cultura:os.data.cultura,alvo:os.data.alvo,piloto:os.data.pilotoResponsavelNome,status:os.data.status,updatedAt:os.row.detalhes?.updatedAt||null,planejamento:os.data.missaoPlanejada||null,editable:editable(os.data.status)},equipments:(result.data??[]).filter((r:any)=>r.detalhes?.ativo!==false).map((r:any)=>({id:r.detalhes.entityId,data:r.detalhes.data}))},{headers});
}catch(e){return failure(e);}}
export async function PATCH(request:NextRequest){try{
 const {admin,current}=await context();const b=await request.json().catch(()=>null);
 const allowed=['osId','expectedUpdatedAt','tipoAtividade','equipamentoId','pontaModelo','volume','tanque','faixa','velocidadeKmh','alturaM','produtos'];
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!allowed.includes(k)))throw new DroneOsAccessError('Dados de planejamento inválidos.',400);
 if(typeof b.equipamentoId!=="string"||!b.equipamentoId.trim())throw new DroneOsAccessError("Selecione um drone válido.",400);
 const os=await requireDroneOsAccess(admin,current,b.osId);
 if(!editable(os.data.status))throw new DroneOsAccessError('A missão já iniciou ou foi encerrada. Não é possível trocar o planejamento.',409);
 const previous=os.row.detalhes;
 if(b.expectedUpdatedAt!==(previous?.updatedAt||null))throw new DroneOsAccessError('A OS foi atualizada por outra pessoa. Recarregue antes de salvar.',409);
 const eq=scopeDroneOsQuery(admin.from('core_logs').select('detalhes').eq('app_slug','dronegestor').eq('acao','cadastro_equipamento').contains('detalhes',{entityId:b.equipamentoId}).limit(1),current);
 const equipment=await eq.maybeSingle();if(equipment.error)throw equipment.error;
 if(!equipment.data||equipment.data.detalhes?.ativo===false)throw new DroneOsAccessError('Selecione um drone ativo desta empresa.',400);
 let plan;try{plan=validateDronePlan(b,equipment.data.detalhes.data||{});}catch(e){throw new DroneOsAccessError(e instanceof Error?e.message:'Plano inválido.',400);}
 const now=new Date().toISOString();const next={...previous,updatedAt:now,data:{...os.data,missaoPlanejada:plan,planejamentoAtualizadoEm:now,planejamentoAtualizadoPor:current.userId}};
 let write=scopeDroneOsQuery(admin.from('core_logs').update({detalhes:next}).eq('id',os.row.id),current);
 write=previous?.updatedAt?write.eq('detalhes->>updatedAt',previous.updatedAt):write.is('detalhes->>updatedAt',null);
 const saved=await write.select('id').maybeSingle();if(saved.error)throw saved.error;if(!saved.data)throw new DroneOsAccessError('A OS mudou durante a gravação. Atualize antes de repetir.',409);
 const audit=await admin.from('core_logs').insert({empresa_id:current.empresaId,usuario_id:current.userId,app_slug:'dronegestor',acao:'missao_planejada_v1',detalhes:{ordemServicoId:b.osId,planejamentoAtualizadoEm:now,equipamentoId:plan.equipamentoId}});
 if(audit.error){const restored=await scopeDroneOsQuery(admin.from('core_logs').update({detalhes:previous}).eq('id',os.row.id).eq('detalhes->>updatedAt',now),current).select('id').maybeSingle();throw new DroneOsAccessError(restored.error||!restored.data?'Falha de auditoria e restauração. Confira a OS com o suporte antes de repetir.':'Falha de auditoria. O planejamento anterior foi preservado.',500);}
 return NextResponse.json({ok:true,updatedAt:now},{headers});
}catch(e){return failure(e);}}
