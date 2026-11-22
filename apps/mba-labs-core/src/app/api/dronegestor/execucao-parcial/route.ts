import { NextRequest, NextResponse } from 'next/server';
import { getSessionProfile } from '@/lib/core-data';
import { canManageDroneGestor } from '@/lib/dronegestor-role';
import { requireDroneOsAccess, droneOsErrorResponse, DroneOsAccessError } from '@/lib/dronegestor-os-access';
import { dronePilotPlanningIssue } from '@/lib/dronegestor-planning';
import { validatePartialExecution } from '@/lib/dronegestor-partial';
import { createSupabaseAdminClient } from '@mba-labs/shared/supabase/server';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
 try {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) return NextResponse.json({ok:false,error:'Autenticação necessária.'},{status:401});
  const master = ['super_admin','admin_master'].includes(session.profile.tipo);
  if (session.profile.status !== 'ativo' || (!master && !session.appsLiberados?.some(a=>a.slug==='dronegestor' && a.canAccess)))
    return NextResponse.json({ok:false,error:'DroneGestor não liberado.'},{status:403});
  const c = {userId:session.profile.id, empresaId:session.profile.empresa_id, canManage:canManageDroneGestor({tipo:session.profile.tipo,permissoes:session.permissoes,isAdminMaster:master})};
  const body = await request.json();
  if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(body.requestId)) throw new DroneOsAccessError('Identificador da solicitação inválido.',400);
  const admin = createSupabaseAdminClient() as any;
  const os = await requireDroneOsAccess(admin,c,String(body.osId||''));
  if (os.assignedPilotId !== c.userId && (c.empresaId || os.assignedPilotId)) throw new DroneOsAccessError('Somente o piloto responsável pode encerrar sua execução.',403);
  const history = Array.isArray(os.data.execucoesParciais) ? os.data.execucoesParciais : [];
  const prior = history.find((entry:any)=>entry.requestId===body.requestId);
  if (prior) {
    // An acknowledgement lost in transit may be retried, but a new payload must
    // never be acknowledged as if its additional hectares had been committed.
    if (JSON.stringify(prior.snapshot) !== JSON.stringify(body.state) || prior.motivo !== body.reason || prior.justificativa !== String(body.justification || '').trim())
      throw new DroneOsAccessError('Este identificador já confirmou outro encerramento. Confira o checkpoint salvo antes de continuar.',409);
    return NextResponse.json({ok:true,duplicate:true,execution:prior});
  }
  if (!['em_execucao','suspensa'].includes(os.data.status) || !os.data.iniciadaEm || os.data.execucaoParcialAtiva)
    throw new DroneOsAccessError('A OS precisa ter uma execução iniciada e ainda não encerrada parcialmente.',409);
  const state = body.state;
  if (!state || typeof state !== 'object' || Array.isArray(state) || Buffer.byteLength(JSON.stringify(state))>220000)
    throw new DroneOsAccessError('Snapshot inválido ou acima do limite.',400);
  if (state.mission?.ordemServicoId !== body.osId) throw new DroneOsAccessError('Snapshot de outra OS.',400);
  const issue = await dronePilotPlanningIssue(admin,c,os.data,state.mission);
  if (issue) throw new DroneOsAccessError(issue,403);
  let totals;
  try {totals=validatePartialExecution(state,Number(os.data.areaHa),body.reason,body.justification);}
  catch(error){throw new DroneOsAccessError(error instanceof Error?error.message:'Dados inválidos.',400);}
  // Cumulative checkpoints: all previously applied loads must survive continuation.
  const previous = history.at(-1);
  if (previous && (totals.areaAplicadaHa < previous.areaAplicadaHa || previous.snapshot.tankRecords.some((old:any)=>!state.tankRecords.some((item:any)=>JSON.stringify(item)===JSON.stringify(old)))))
    throw new DroneOsAccessError('A complementação não pode remover ou alterar cargas anteriores.',409);
  const at = new Date().toISOString();
  const execution = {...totals, requestId:body.requestId, at, usuarioId:c.userId, snapshot:state};
  const next = {...os.row.detalhes,updatedAt:at,data:{...os.data,status:'suspensa',execucaoParcialAtiva:true,execucoesParciais:[...history,execution]}};
  let update=admin.from('core_logs').update({detalhes:next}).eq('id',os.row.id);
  const version=os.row.detalhes.updatedAt;
  update=version?update.eq('detalhes->>updatedAt',version):update.is('detalhes->>updatedAt',null);
  const result=await update.select('id');
  if(result.error)throw result.error;
  if(!result.data?.length)throw new DroneOsAccessError('A OS foi alterada em outro aparelho. Recarregue antes de tentar novamente.',409);
  // Audit and snapshot commit atomically inside the OS row. No finalization/revenue event.
  return NextResponse.json({ok:true,execution});
 } catch(error) {
  const known=droneOsErrorResponse(error);
  return NextResponse.json({ok:false,error:known?.message||'Não foi possível registrar a execução parcial.'},{status:known?.status||500});
 }
}
