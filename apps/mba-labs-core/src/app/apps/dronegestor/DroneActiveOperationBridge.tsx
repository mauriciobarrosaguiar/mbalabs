"use client";

import { useLayoutEffect } from "react";

const MISSION_KEY = "dronegestor:mission:v2";
const STATUS_KEY = "dronegestor:missionStatus:v4";
const ACTIVE_KEY = "dronegestor:activeMissionContext:v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function activeStatus() {
  const status = String(readJson(STATUS_KEY, "rascunho") || "rascunho");
  const started = Boolean(readJson("dronegestor:started:v3", false));
  return started || ["preparacao", "em_preparacao", "em_execucao", "pausada", "suspensa", "pendente_regularizacao", "pendente_sync"].includes(status);
}

function compactMission(source: Record<string, any>) {
  const keep = [
    "ordemServicoId", "ordemServicoNumero", "clienteId", "clienteNome", "fazendaId", "fazendaNome",
    "municipio", "uf", "talhaoId", "talhaoNome", "cultura", "alvo", "tipoAtividade", "area", "drone",
    "registroAnac", "pontaModelo", "volume", "tanque", "faixa", "velocidadeKmh", "alturaM", "produtos",
    "sarpasSituacao", "sarpasNumero", "sarpasConfirmado"
  ];
  return Object.fromEntries(keep.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
}

function syncActiveContext() {
  const mission = readJson<Record<string, any>>(MISSION_KEY, {});
  if (mission?.ordemServicoId) {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(compactMission(mission)));
    localStorage.setItem("dronegestor:activeOsId:v1", String(mission.ordemServicoId));
    return;
  }

  if (!activeStatus()) return;
  const remembered = readJson<Record<string, any>>(ACTIVE_KEY, {});
  if (!remembered?.ordemServicoId) return;
  localStorage.setItem(MISSION_KEY, JSON.stringify({ ...mission, ...remembered }));
  localStorage.setItem("dronegestor:updatedAt:v2", new Date().toISOString());
}

export function DroneActiveOperationBridge() {
  useLayoutEffect(() => {
    syncActiveContext();
    const timer = window.setInterval(syncActiveContext, 700);
    const onFocus = () => syncActiveContext();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, []);

  return null;
}
