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
