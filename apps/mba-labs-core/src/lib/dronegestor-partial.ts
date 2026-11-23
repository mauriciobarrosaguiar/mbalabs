export const interruptionReasons = ['Chuva', 'Vento', 'Drone', 'Bateria', 'Falta de produto', 'Equipamento', 'Obstáculos', 'Solicitação do cliente', 'Outro'] as const;

type RecordValue = Record<string, any>;
export function validatePartialExecution(state: RecordValue, plannedArea: number, reason: unknown, justification: unknown) {
  if (!interruptionReasons.includes(reason as any)) throw new Error('Selecione o motivo da interrupção.');
  if (typeof justification !== 'string' || justification.trim().length < 5 || justification.length > 1000)
    throw new Error('Informe uma justificativa entre 5 e 1000 caracteres.');
  const area = Number(state.progressHa);
  if (!Number.isFinite(plannedArea) || plannedArea <= 0 || !Number.isFinite(area) || area <= 0 || area >= plannedArea)
    throw new Error('A execução parcial exige área positiva e inferior à área planejada.');
  if (Number(state.mission?.area) !== plannedArea) throw new Error('A área planejada diverge da OS.');
  const tanks = state.tankRecords;
  if (!Array.isArray(tanks) || !tanks.length) throw new Error('Registre as cargas efetivamente aplicadas.');
  const ids = new Set<string>();
  let applied = 0;
  for (const tank of tanks) {
    if (!tank || typeof tank.id !== 'string' || !tank.id || ids.has(tank.id)) throw new Error('Carga sem identificação ou duplicada.');
    ids.add(tank.id);
    if (!Number.isFinite(tank.areaHa) || tank.areaHa <= 0 || !Number.isFinite(tank.volumeL) || tank.volumeL <= 0)
      throw new Error('Área e volume das cargas devem ser positivos.');
    if (!Number.isFinite(Date.parse(tank.at))) throw new Error('Horário da carga inválido.');
    applied += tank.areaHa;
  }
  if (Math.abs(applied - area) > 0.001) throw new Error('A soma das cargas diverge da área registrada.');
  if (!Number.isFinite(Date.parse(state.startedAt))) throw new Error('Horário inicial não registrado.');
  return { areaPlanejadaHa: plannedArea, areaAplicadaHa: area, areaRestanteHa: Math.round((plannedArea-area)*1e6)/1e6, motivo: reason as string, justificativa: justification.trim() };
}


/**
 * Verify append-only hectares and individual loads across a partial checkpoint.
 * A resumed application must not silently replace, remove, reorder or duplicate
 * an acknowledged load. No database writes or synthetic flight approvals here.
 */
export function validateCumulativeContinuation(previous: RecordValue, state: RecordValue) {
  const oldLoads = previous?.snapshot?.tankRecords;
  const loads = state?.tankRecords;
  const previousArea = Number(previous?.areaAplicadaHa);
  const currentArea = Number(state?.progressHa);
  if (!Array.isArray(oldLoads) || !oldLoads.length || !Array.isArray(loads) ||
      !Number.isFinite(previousArea) || previousArea <= 0 ||
      !Number.isFinite(currentArea) || currentArea <= previousArea + 0.000001) {
    throw new Error('A complementação deve acrescentar área real e preservar as cargas anteriores.');
  }
  if (loads.length <= oldLoads.length) throw new Error('A complementação precisa registrar novas cargas reais.');
  for (let i = 0; i < oldLoads.length; i++) {
    if (JSON.stringify(loads[i]) !== JSON.stringify(oldLoads[i])) {
      throw new Error('A ordem, os hectares e os volumes das cargas anteriores não podem ser alterados.');
    }
  }
  if (state.startedAt !== previous.snapshot.startedAt) {
    throw new Error('A complementação deve preservar o início original da operação.');
  }
  const ids = new Set<string>();
  let totalArea = 0, totalVolume = 0;
  for (const load of loads) {
    if (!load || typeof load.id !== 'string' || !load.id || ids.has(load.id) ||
        !Number.isFinite(load.areaHa) || load.areaHa <= 0 ||
        !Number.isFinite(load.volumeL) || load.volumeL <= 0 ||
        !Number.isFinite(Date.parse(load.at))) {
      throw new Error('Carga inexistente, duplicada ou com hectares/volume/horário inválidos.');
    }
    ids.add(load.id);
    totalArea += load.areaHa;
    totalVolume += load.volumeL;
  }
  if (Math.abs(totalArea - currentArea) > 0.001) {
    throw new Error('A soma acumulada dos hectares não coincide com as cargas registradas.');
  }
  return {
    hectaresAnteriores: previousArea,
    hectaresAcrescentados: Math.round((currentArea - previousArea) * 1e6) / 1e6,
    hectaresAcumulados: currentArea,
    cargasAnteriores: oldLoads.length,
    novasCargas: loads.length - oldLoads.length,
    volumeAcumuladoL: Math.round(totalVolume * 100) / 100,
  };
}

/** Public, non-sensitive execution progress for lists. Never expose raw checkpoint snapshots here. */
export function partialExecutionSummary(osData: RecordValue) {
  const history = Array.isArray(osData?.execucoesParciais) ? osData.execucoesParciais : [];
  const last = history.at(-1);
  if (!last) return null;
  const planned = Number(osData.areaHa);
  const applied = Number(last.areaAplicadaHa);
  if (!Number.isFinite(planned) || planned <= 0 || !Number.isFinite(applied) || applied < 0 || applied > planned) return null;
  const loads = Array.isArray(last.snapshot?.tankRecords) ? last.snapshot.tankRecords : [];
  const volume = loads.reduce((sum:number,item:RecordValue)=>sum+(Number.isFinite(item?.volumeL)&&item.volumeL>0?item.volumeL:0),0);
  return {
    areaAplicadaHa: applied,
    areaRestanteHa: Math.round((planned-applied)*1e6)/1e6,
    volumeAplicadoL: Math.round(volume*100)/100,
    cargasRegistradas: loads.length,
    complementacoes: Math.max(0,history.length-1),
    motivo: typeof last.motivo === 'string' ? last.motivo : '',
    atualizadoEm: typeof last.at === 'string' ? last.at : '',
  };
}
