"use client";

import { useEffect } from "react";

const MISSION_KEY = "dronegestor:mission:v2";
const FINAL = new Set(["autorizado", "dispensado", "nao_aplicavel"]);

type Mission = {
  ordemServicoId?: string;
  ordemServicoNumero?: string;
  sarpasSituacao?: string;
  sarpasNumero?: string;
  sarpasConfirmado?: boolean;
};

function readMission(): Mission {
  try {
    const parsed = JSON.parse(localStorage.getItem(MISSION_KEY) || "{}") as Mission;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function DroneSarpasStateBridge() {
  useEffect(() => {
    let stopped = false;
    let lastFingerprint = "";

    const sync = async () => {
      const mission = readMission();
      const status = String(mission.sarpasSituacao || "");
      if (!mission.ordemServicoId || !mission.sarpasConfirmado || !FINAL.has(status)) return;

      const fingerprint = [
        mission.ordemServicoId,
        status,
        mission.sarpasNumero || ""
      ].join("|");
      if (fingerprint === lastFingerprint || stopped) return;

      try {
        const response = await fetch("/api/dronegestor/sarpas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            numero: mission.sarpasNumero || "",
            ordemServicoId: mission.ordemServicoId,
            ordemServicoNumero: mission.ordemServicoNumero || "",
            observacao: "Sincronizado automaticamente a partir da etapa de liberação da operação."
          }),
          cache: "no-store"
        });
        if (response.ok) lastFingerprint = fingerprint;
      } catch {
        // A operação local continua protegida; uma nova tentativa ocorrerá no próximo ciclo.
      }
    };

    void sync();
    const interval = window.setInterval(() => void sync(), 2500);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
