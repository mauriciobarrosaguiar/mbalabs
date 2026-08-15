"use client";

import { useEffect } from "react";

const MISSION_KEY = "dronegestor:mission:v2";

type Mission = {
  ordemServicoId?: string;
  ordemServicoNumero?: string;
  sarpasSituacao?: string;
  sarpasNumero?: string;
  sarpasConfirmado?: boolean;
};

type CentralSarpas = {
  status?: string;
  numero?: string;
  updatedAt?: string;
} | null;

function readMission(): Mission {
  try {
    const parsed = JSON.parse(localStorage.getItem(MISSION_KEY) || "{}") as Mission;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAuthorizedFromCentral(mission: Mission, central: CentralSarpas) {
  if (!central || central.status !== "autorizado" || !String(central.numero || "").trim()) return false;
  const alreadySame = mission.sarpasSituacao === "autorizado" && mission.sarpasConfirmado === true && String(mission.sarpasNumero || "").trim() === String(central.numero || "").trim();
  if (alreadySame) return false;
  const next = {
    ...mission,
    sarpasSituacao: "autorizado",
    sarpasNumero: String(central.numero || "").trim(),
    sarpasConfirmado: true
  };
  localStorage.setItem(MISSION_KEY, JSON.stringify(next));
  localStorage.setItem("dronegestor:updatedAt:v2", new Date().toISOString());
  window.dispatchEvent(new CustomEvent("dronegestor:sarpas-updated", { detail: next }));
  return true;
}

export function DroneSarpasStateBridge() {
  useEffect(() => {
    let stopped = false;
    let lastPushed = "";
    let lastPulledOs = "";

    const sync = async () => {
      const mission = readMission();
      const osId = String(mission.ordemServicoId || "");
      if (!osId || stopped) return;

      // Central -> Campo: uma autorização registrada na Central passa a valer na etapa de liberação.
      if (lastPulledOs !== osId || mission.sarpasSituacao !== "autorizado" || !mission.sarpasConfirmado) {
        try {
          const response = await fetch(`/api/dronegestor/sarpas?osId=${encodeURIComponent(osId)}`, { cache: "no-store" });
          const payload = await response.json().catch(() => null);
          if (response.ok && !stopped) {
            const changed = writeAuthorizedFromCentral(mission, payload?.sarpas ?? null);
            lastPulledOs = osId;
            if (changed) return;
          }
        } catch {
          // Campo continua utilizável com os dados locais e tenta novamente depois.
        }
      }

      // Campo -> Central: só sincroniza quando a autorização foi realmente confirmada e possui referência.
      const current = readMission();
      const status = String(current.sarpasSituacao || "");
      const numero = String(current.sarpasNumero || "").trim();
      if (status !== "autorizado" || current.sarpasConfirmado !== true || !numero) return;

      const fingerprint = [osId, status, numero].join("|");
      if (fingerprint === lastPushed || stopped) return;
      try {
        const response = await fetch("/api/dronegestor/sarpas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "autorizado",
            numero,
            ordemServicoId: osId,
            ordemServicoNumero: current.ordemServicoNumero || "",
            observacao: "Sincronizado automaticamente entre a etapa de liberação e a Central SARPAS."
          }),
          cache: "no-store"
        });
        if (response.ok) lastPushed = fingerprint;
      } catch {
        // Uma nova tentativa ocorrerá no próximo ciclo.
      }
    };

    void sync();
    const interval = window.setInterval(() => void sync(), 2500);
    const onFocus = () => void sync();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, []);

  return null;
}
