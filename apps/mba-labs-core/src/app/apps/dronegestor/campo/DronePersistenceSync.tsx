"use client";

import { useEffect } from "react";

const UPDATED_KEY = "dronegestor:updatedAt:v2";
const STORAGE = {
  mission: "dronegestor:mission:v2",
  settings: "dronegestor:settings:v2",
  calibration: "dronegestor:calibration:v2",
  checklist: "dronegestor:checklist:v2",
  occurrences: "dronegestor:occurrences:v2",
  weather: "dronegestor:weather",
  progressHa: "dronegestor:progress:v2",
  insightAccepted: "dronegestor:insightAccepted:v2",
  riskAccepted: "dronegestor:riskAccepted:v2"
} as const;

type LocalState = Record<keyof typeof STORAGE, unknown>;

function safeParse(value: string | null) {
  if (value === null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function snapshotDroneLocalState(overrides: Partial<LocalState> = {}) {
  const state = {} as LocalState;
  for (const [name, key] of Object.entries(STORAGE) as Array<[keyof typeof STORAGE, string]>) {
    state[name] = safeParse(localStorage.getItem(key));
  }
  return { ...state, ...overrides };
}

function applyRemoteState(state: Record<string, unknown>, updatedAt: string) {
  for (const [name, key] of Object.entries(STORAGE) as Array<[keyof typeof STORAGE, string]>) {
    if (!(name in state)) continue;
    const value = state[name];
    if (value === undefined) continue;
    localStorage.setItem(key, JSON.stringify(value));
  }
  localStorage.setItem(UPDATED_KEY, updatedAt);
}

async function pushState(updatedAt: string) {
  const response = await fetch("/api/dronegestor/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: snapshotDroneLocalState(), updatedAt }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Falha ao sincronizar DroneGestor.");
  return response.json();
}

export async function finalizeDroneOperation(overrides: Partial<LocalState> = {}) {
  const response = await fetch("/api/dronegestor/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: snapshotDroneLocalState(overrides) }),
    cache: "no-store",
    keepalive: true
  });
  if (!response.ok) throw new Error("Falha ao registrar a operacao concluida.");
  return response.json();
}

export function markDroneStateChanged() {
  const now = new Date().toISOString();
  localStorage.setItem(UPDATED_KEY, now);
  return now;
}

export function DronePersistenceSync() {
  useEffect(() => {
    let disposed = false;
    let syncing = false;
    let lastPushed = "";

    async function sync(force = false) {
      if (disposed || syncing || !navigator.onLine) return;
      const updatedAt = localStorage.getItem(UPDATED_KEY) || "";
      if (!updatedAt && !force) return;
      if (!force && updatedAt === lastPushed) return;

      syncing = true;
      try {
        await pushState(updatedAt || new Date().toISOString());
        lastPushed = updatedAt;
      } catch {
        // O estado permanece no aparelho e sera reenviado quando a conexao voltar.
      } finally {
        syncing = false;
      }
    }

    async function hydrate() {
      try {
        const response = await fetch("/api/dronegestor/state", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (disposed || !payload?.state) {
          await sync();
          return;
        }

        const remoteAt = String(payload.updatedAt || "");
        const localAt = localStorage.getItem(UPDATED_KEY) || "";
        const remoteTime = remoteAt ? Date.parse(remoteAt) : 0;
        const localTime = localAt ? Date.parse(localAt) : 0;

        if (remoteTime > localTime) {
          applyRemoteState(payload.state as Record<string, unknown>, remoteAt);
          window.location.reload();
          return;
        }

        await sync();
      } catch {
        // Modo offline: o aplicativo continua usando o cache local.
      }
    }

    void hydrate();
    const interval = window.setInterval(() => void sync(), 4500);
    const onOnline = () => void sync(true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void sync();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
