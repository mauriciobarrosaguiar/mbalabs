"use client";

import { useLayoutEffect, useState } from "react";

const MISSION_KEY = "dronegestor:mission:v2";
const STATUS_KEY = "dronegestor:missionStatus:v4";
const ACTIVE_KEY = "dronegestor:activeMissionContext:v1";
const OWNER_KEY = "dronegestor:deviceOwner:v1";
const BACKUP_PREFIX = "dronegestor:userBackup:v1:";

function backupKey(owner: string) {
  return `${BACKUP_PREFIX}${encodeURIComponent(owner)}`;
}

function operationalKeys() {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("dronegestor:") && key !== OWNER_KEY && !key.startsWith(BACKUP_PREFIX)) keys.push(key);
  }
  return keys;
}

function saveOwnerState(owner: string) {
  if (!owner) return;
  const entries = operationalKeys().map((key) => [key, localStorage.getItem(key)] as const);
  localStorage.setItem(backupKey(owner), JSON.stringify(Object.fromEntries(entries)));
}

function clearOperationalState() {
  operationalKeys().forEach((key) => localStorage.removeItem(key));
}

function restoreOwnerState(owner: string) {
  const restored = readJson<Record<string, string | null>>(backupKey(owner), {});
  Object.entries(restored).forEach(([key, value]) => {
    if (key.startsWith("dronegestor:") && key !== OWNER_KEY && !key.startsWith(BACKUP_PREFIX) && typeof value === "string") localStorage.setItem(key, value);
  });
}

function switchOwner(nextOwner: string) {
  const previousOwner = localStorage.getItem(OWNER_KEY) || "";
  if (previousOwner === nextOwner) return;
  if (!previousOwner) {
    localStorage.setItem(OWNER_KEY, nextOwner);
    saveOwnerState(nextOwner);
    return;
  }
  if (previousOwner) saveOwnerState(previousOwner);
  clearOperationalState();
  restoreOwnerState(nextOwner);
  localStorage.setItem(OWNER_KEY, nextOwner);
}

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
  return started || ["preparacao", "em_preparacao", "em_execucao", "pausada", "suspensa", "pendente_regularizacao", "pendente_sync", "finalizada"].includes(status);
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

export function DroneActiveOperationBridge({ deviceOwner }: { deviceOwner: string }) {
  const [blocked, setBlocked] = useState(false);
  useLayoutEffect(() => {
    try {
      switchOwner(deviceOwner);
      syncActiveContext();
      saveOwnerState(deviceOwner);
    } catch {
      setBlocked(true);
      return;
    }
    const persist = () => {
      try {
        if (localStorage.getItem(OWNER_KEY) !== deviceOwner) switchOwner(deviceOwner);
        syncActiveContext();
        saveOwnerState(deviceOwner);
      } catch {
        setBlocked(true);
      }
    };
    const timer = window.setInterval(persist, 700);
    const onFocus = () => persist();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, [deviceOwner]);

  if (!blocked) return null;
  return <div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/70 p-4" role="alertdialog" aria-modal="true" aria-labelledby="drone-device-error-title"><section className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-950 shadow-2xl"><h2 id="drone-device-error-title" className="text-xl font-black">Não foi possível separar os dados deste usuário</h2><p className="mt-3 text-sm leading-6 text-slate-700">Por segurança, o DroneGestor bloqueou o uso neste aparelho. Feche outras abas do sistema e recarregue a página. Nenhuma fila offline foi apagada.</p><button type="button" onClick={()=>window.location.reload()} className="mt-5 min-h-12 w-full rounded-xl bg-emerald-700 px-4 font-black text-white">Recarregar com segurança</button></section></div>;
}
