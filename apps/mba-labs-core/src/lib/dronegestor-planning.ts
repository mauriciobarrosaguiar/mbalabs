const technicalKeys = ['tipoAtividade','equipamentoId','equipamentoNome','drone','registroAnac','pontaModelo','volume','tanque','faixa','velocidadeKmh','alturaM','produtos'] as const;
export function mergeDroneMissionPlan(base: Record<string, any>, osData: Record<string, any>) {
  const plan = osData.missaoPlanejada;
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return base;
  const next = { ...base };
  for (const key of technicalKeys) if (key in plan) next[key] = plan[key];
  next.planejamentoAtualizadoEm = osData.planejamentoAtualizadoEm || '';
  return next;
}
/** Display the authoritative pre-operation plan in documents.
 * Never overlay a newer plan on the snapshot of an already started, suspended
 * or finished operation. This is for reading, not validating a flight.
 */
export function missionPlanForDocumentDisplay(
  snapshot: Record<string, any>,
  osData: Record<string, any>,
  source: "os" | "live" | "finalized",
) {
  if (source === "finalized") return snapshot;
  if (!["aberta", "preparacao", "em_preparacao"].includes(String(osData.status || ""))) return snapshot;
  return mergeDroneMissionPlan(snapshot, osData);
}
export function validateDronePlan(body: Record<string, any>, equipment: Record<string, any>) {
  const positive = (v: unknown) => Number.isFinite(Number(v)) && Number(v) > 0;
  const text = (v: unknown) => typeof v === 'string' ? v.trim().slice(0,180) : '';
  if (!['pulverizacao','dispersao','outro'].includes(body.tipoAtividade)) throw new Error('Selecione o tipo de atividade.');
  if (!text(equipment.registroAnac) || !text(equipment.nome)) throw new Error('O drone precisa de nome e identificação ANAC.');
  if (!['volume','tanque','faixa','velocidadeKmh','alturaM'].every(k=>positive(body[k])) || !text(body.pontaModelo)) throw new Error('Preencha os parâmetros técnicos com valores positivos.');
  if (!positive(equipment.tanqueL) || Number(body.tanque) > Number(equipment.tanqueL)) throw new Error('O tanque útil não pode superar a capacidade cadastrada do drone.');
  if (!Array.isArray(body.produtos) || !body.produtos.length || body.produtos.length>30 || !body.produtos.every((p:any)=>text(p?.nome)&&positive(p?.dose)&&['mL/ha','L/ha','g/ha','kg/ha','mL/100L','g/100L'].includes(p?.unidade))) throw new Error('Informe produtos, doses e unidades válidos.');
  return { tipoAtividade: body.tipoAtividade, equipamentoId: text(body.equipamentoId), equipamentoNome:text(equipment.nome), drone: [text(equipment.marca),text(equipment.modelo)].filter(Boolean).join(' ') || text(equipment.nome), registroAnac:text(equipment.registroAnac), pontaModelo:text(body.pontaModelo), volume:Number(body.volume), tanque:Number(body.tanque), faixa:Number(body.faixa), velocidadeKmh:Number(body.velocidadeKmh), alturaM:Number(body.alturaM), produtos:body.produtos.map((p:any,index:number)=>({id:`produto-plano-${index+1}`,nome:text(p.nome),dose:Number(p.dose),unidade:p.unidade})) };
}

export function readonlyDronePlanIssue(osData:Record<string,any>, mission:Record<string,any>) {
  const signature=(m:Record<string,any>)=>JSON.stringify({tipoAtividade:m.tipoAtividade||'pulverizacao',equipamentoId:String(m.equipamentoId||''),drone:String(m.drone||'').trim(),registroAnac:String(m.registroAnac||'').trim(),pontaModelo:String(m.pontaModelo||'').trim(),volume:Number(m.volume)||0,tanque:Number(m.tanque)||0,faixa:Number(m.faixa)||0,velocidadeKmh:Number(m.velocidadeKmh)||0,alturaM:Number(m.alturaM)||0,produtos:(Array.isArray(m.produtos)?m.produtos:[]).filter((p:any)=>String(p?.nome||'').trim()||Number(p?.dose)).map((p:any)=>({nome:String(p.nome||'').trim(),dose:Number(p.dose)||0,unidade:p.unidade}))});
  if(signature(osData.missaoPlanejada||{})!==signature(mission))return 'Parâmetros técnicos diferentes do planejamento do gestor/RT. Abra novamente a OS para carregar o plano autorizado.';
  if((Number(osData.areaHa)>0&&Math.abs(Number(osData.areaHa)-Number(mission.area))>0.01)||(osData.cultura&&String(osData.cultura).trim()!==String(mission.cultura||'').trim())||(osData.alvo&&String(osData.alvo).trim()!==String(mission.alvo||'').trim()))return 'Área, cultura ou alvo não correspondem à OS planejada.';
  return null;
}
export async function dronePilotPlanningIssue(admin:any,current:{userId:string;empresaId:string|null;canManage:boolean},osData:Record<string,any>,mission:Record<string,any>) {
  if(current.canManage||!current.empresaId)return null;
  const result=await admin.from('core_logs').select('detalhes').eq('empresa_id',current.empresaId).eq('app_slug','dronegestor').eq('acao','piloto_operacional_v1').contains('detalhes',{usuarioId:current.userId}).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(result.error)throw result.error;
  const pilot=result.data?.detalhes;
  if(!pilot||pilot.ativo===false||pilot.permissoes?.executarOs===false)return 'Piloto não liberado para executar esta missão.';
  if(pilot.permissoes?.editarParametros===true)return null;
  if(!osData.missaoPlanejada && ['em_execucao','suspensa','campo_concluido'].includes(osData.status)) {
    // Preserve a legacy application already started before plans existed, using only its server snapshot.
    const saved=await admin.from('core_logs').select('detalhes').eq('empresa_id',current.empresaId).eq('usuario_id',current.userId).eq('app_slug','dronegestor').eq('acao','estado_campo_v2').contains('detalhes',{state:{mission:{ordemServicoId:mission.ordemServicoId}}}).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(saved.error)throw saved.error;
    if(saved.data?.detalhes?.state?.mission)return readonlyDronePlanIssue({...osData,missaoPlanejada:saved.data.detalhes.state.mission},mission);
  }
  return readonlyDronePlanIssue(osData,mission);
}
