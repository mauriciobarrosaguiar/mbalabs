"use client";

import { useLayoutEffect } from "react";

const RESET_MARKER = "dronegestor:contextResetForOs:v1";

export function DroneMissionContextReset() {
  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem("dronegestor:mission:v2");
      if (!raw) return;
      const current = JSON.parse(raw) as Record<string, unknown>;
      const osId = typeof current.ordemServicoId === "string" ? current.ordemServicoId : "";
      if (!osId || localStorage.getItem(RESET_MARKER) === osId) return;

      const cleanMission = {
        ordemServicoId: osId,
        ordemServicoNumero: current.ordemServicoNumero ?? "",
        clienteId: current.clienteId ?? "",
        clienteNome: current.clienteNome ?? "",
        fazendaId: current.fazendaId ?? "",
        fazendaNome: current.fazendaNome ?? "",
        municipio: current.municipio ?? "",
        uf: current.uf ?? "",
        talhaoId: current.talhaoId ?? "",
        talhaoNome: current.talhaoNome ?? "",
        cultura: current.cultura ?? "",
        alvo: current.alvo ?? "",
        area: Number(current.area) || 0,
        drone: "",
        volume: 0,
        tanque: 0,
        faixa: 0,
        velocidadeKmh: 0,
        alturaM: 0,
        produtos: [],
        distanciaSensivel: 0,
        ventoCampoKmh: 0,
        direcaoVentoCampo: "",
        temperaturaCampo: 0,
        umidadeCampo: 0,
        tempoAbastecimentoMin: 0,
        tempoTrocaBateriaMin: 0,
        tanquesPorBateria: 0,
        tempoDeslocamentoMin: 0,
        tempoBordaduraMin: 0,
        sarpasNumero: "",
        sarpasConfirmado: false
      };

      localStorage.setItem("dronegestor:mission:v2", JSON.stringify(cleanMission));
      localStorage.setItem("dronegestor:calibration:v2", JSON.stringify({ ar: false, fluxometro: false, bomba: false }));
      localStorage.setItem("dronegestor:checklist:v2", JSON.stringify({ area:false, pessoasAnimais:false, obstaculos:false, drone:false, controle:false, pulverizacao:false, clima:false, documentos:false }));
      localStorage.setItem("dronegestor:occurrences:v2", JSON.stringify([]));
      localStorage.setItem("dronegestor:progress:v2", JSON.stringify(0));
      localStorage.setItem("dronegestor:insightAccepted:v2", JSON.stringify(false));
      localStorage.setItem("dronegestor:riskAccepted:v2", JSON.stringify(false));
      localStorage.removeItem("dronegestor:weather");
      localStorage.removeItem("dronegestor:operationId:v3");
      localStorage.removeItem("dronegestor:lastFinalizedOperationId:v3");
      localStorage.removeItem("dronegestor:pendingFinalization:v3");
      localStorage.setItem("dronegestor:updatedAt:v2", new Date().toISOString());
      localStorage.setItem(RESET_MARKER, osId);
    } catch {
      // Se o cache local estiver inconsistente, o app continua com o fluxo normal.
    }
  }, []);

  return null;
}
