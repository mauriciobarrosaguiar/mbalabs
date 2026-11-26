/** AgroVoo Fase 2: somente campos aceitos hoje pela API de cadastros/OS. */
export type AgroVooOsDraft = {
  clienteId: string;
  fazendaId: string;
  talhaoId: string;
  cultura: string;
  alvo: string;
  areaHa: string;
  dataPrevista: string;
  observacoes: string;
};

export function validateAgroVooStep(step: number, draft: AgroVooOsDraft): string {
  if (step === 0 && (!draft.clienteId || !draft.fazendaId || !draft.talhaoId)) {
    return "Selecione cliente, fazenda e talhão para continuar.";
  }
  if (step === 1 && (!draft.cultura.trim() || !draft.alvo.trim()
    || !Number.isFinite(Number(draft.areaHa)) || Number(draft.areaHa) <= 0)) {
    return "Preencha cultura, alvo e uma área maior que zero.";
  }
  return "";
}

/** NUNCA cria status de execução nem altera hectares/abastecimentos existentes. */
export function buildAgroVooOsPayload(draft: AgroVooOsDraft) {
  return {
    type: "os" as const,
    data: {
      clienteId: draft.clienteId,
      fazendaId: draft.fazendaId,
      talhaoId: draft.talhaoId,
      cultura: draft.cultura.trim(),
      alvo: draft.alvo.trim(),
      areaHa: Number(draft.areaHa),
      dataPrevista: draft.dataPrevista,
      observacoes: draft.observacoes.trim(),
    },
  };
}
