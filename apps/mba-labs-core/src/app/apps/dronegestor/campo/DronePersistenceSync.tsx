"use client";

import { useEffect } from "react";

const UPDATED_KEY = "dronegestor:updatedAt:v2";
const REVISION_KEY = "dronegestor:syncRevision:v4";
const DIRTY_KEY = "dronegestor:syncDirty:v4";
const CONFLICT_KEY = "dronegestor:syncConflict:v4";

const STORAGE = {
  mission: "dronegestor:mission:v2",
  settings: "dronegestor:settings:v2",
  calibration: "dronegestor:calibration:v2",
  checklist: "dronegestor:checklist:v2",
  occurrences: "dronegestor:occurrences:v2",
  weather: "dronegestor:weather",
  progressHa: "dronegestor:progress:v2",
  tankRecords: "dronegestor:tankRecords:v4",
  insightAccepted: "dronegestor:insightAccepted:v2",
  riskAccepted: "dronegestor:riskAccepted:v2",
  currentView: "dronegestor:view:v3",
  operationStarted: "dronegestor:started:v3",
  paused: "dronegestor:paused:v3",
  missionStatus: "dronegestor:missionStatus:v4",
  startedAt: "dronegestor:startedAt:v4",
  endedAt: "dronegestor:endedAt:v4"
} as const;

type LocalState = Record<keyof typeof STORAGE, unknown>;

type ConflictPayload = {
  localRevision: number;
  remoteRevision: number;
  detectedAt: string;
  remoteState: Record<string, unknown> | null;
};

function safeParse(value: string | null) {
  if (value === null) return null;
  try { return JSON.parse(value); } catch { return value; }
}

function revision() {
  const value = Number(localStorage.getItem(REVISION_KEY) || 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function isDirty() {
  return localStorage.getItem(DIRTY_KEY) === "1";
}

export function snapshotDroneLocalState(overrides: Partial<LocalState> = {}) {
  const state = {} as LocalState;
  for (const [name, key] of Object.entries(STORAGE) as Array<[keyof typeof STORAGE, string]>) {
    state[name] = safeParse(localStorage.getItem(key));
  }
  return { ...state, ...overrides };
}

function fingerprintLocalState() {
  return JSON.stringify(snapshotDroneLocalState());
}

function hasMeaningfulLocalState() {
  const state = snapshotDroneLocalState();
  const mission = state.mission && typeof state.mission === "object" ? state.mission as Record<string, unknown> : {};
  return Boolean(
    Number(mission.area || 0) > 0 ||
    String(mission.ordemServicoId || "") ||
    state.operationStarted === true ||
    Number(state.progressHa || 0) > 0 ||
    (Array.isArray(state.occurrences) && state.occurrences.length)
  );
}

function applyRemoteState(state: Record<string, unknown>, remoteRevision: number, updatedAt: string) {
  for (const [name, key] of Object.entries(STORAGE) as Array<[keyof typeof STORAGE, string]>) {
    if (!(name in state)) continue;
    const value = state[name];
    if (value === undefined) continue;
    localStorage.setItem(key, JSON.stringify(value));
  }
  localStorage.setItem(REVISION_KEY, String(remoteRevision));
  localStorage.setItem(DIRTY_KEY, "0");
  localStorage.removeItem(CONFLICT_KEY);
  if (updatedAt) localStorage.setItem(UPDATED_KEY, updatedAt);
}

function registerConflict(payload: ConflictPayload) {
  localStorage.setItem(CONFLICT_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("dronegestor:sync-conflict", { detail: payload }));
}

async function pushState(baseRevision: number) {
  const response = await fetch("/api/dronegestor/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: snapshotDroneLocalState(), baseRevision }),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 409) {
    registerConflict({
      localRevision: baseRevision,
      remoteRevision: Number(payload?.revision || 0),
      detectedAt: new Date().toISOString(),
      remoteState: payload?.state && typeof payload.state === "object" ? payload.state : null
    });
    throw new Error("Conflito de sincronização detectado.");
  }
  if (!response.ok) throw new Error(payload?.error || "Falha ao sincronizar DroneGestor.");
  const nextRevision = Number(payload?.revision || baseRevision + 1);
  localStorage.setItem(REVISION_KEY, String(nextRevision));
  localStorage.setItem(DIRTY_KEY, "0");
  localStorage.removeItem(CONFLICT_KEY);
  if (payload?.updatedAt) localStorage.setItem(UPDATED_KEY, String(payload.updatedAt));
  return nextRevision;
}

export async function finalizeDroneOperation(overrides: Partial<LocalState> = {}) {
  const response = await fetch("/api/dronegestor/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: snapshotDroneLocalState(overrides) }),
    cache: "no-store",
    keepalive: true
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Falha ao registrar a operação concluída.");
  return payload;
}

export function markDroneStateChanged() {
  const now = new Date().toISOString();
  localStorage.setItem(UPDATED_KEY, now);
  localStorage.setItem(DIRTY_KEY, "1");
  return now;
}

export function getDroneSyncConflict(): ConflictPayload | null {
  try {
    const raw = localStorage.getItem(CONFLICT_KEY);
    return raw ? JSON.parse(raw) as ConflictPayload : null;
  } catch {
    return null;
  }
}

export function clearDroneSyncConflict() {
  localStorage.removeItem(CONFLICT_KEY);
}

export function DronePersistenceSync() {
  useEffect(() => {
    let disposed = false;
    let syncing = false;
    let lastFingerprint = fingerprintLocalState();

    function detectChanges() {
      const current = fingerprintLocalState();
      if (current === lastFingerprint) return false;
      lastFingerprint = current;
      markDroneStateChanged();
      return true;
    }

    async function sync(force = false) {
      if (disposed || syncing || !navigator.onLine || localStorage.getItem(CONFLICT_KEY)) return;
      detectChanges();
      if (!force && !isDirty()) return;

      syncing = true;
      try {
        await pushState(revision());
      } catch {
        // O estado local permanece preservado; em conflito não há sobrescrita silenciosa.
      } finally {
        syncing = false;
      }
    }

    async function hydrate() {
      try {
        const response = await fetch("/api/dronegestor/state", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (disposed) return;

        const remoteRevision = Number(payload?.revision || 0);
        const localRevision = revision();
        const remoteState = payload?.state && typeof payload.state === "object" ? payload.state as Record<string, unknown> : null;

        if (!remoteState) {
          if (hasMeaningfulLocalState()) {
            localStorage.setItem(DIRTY_KEY, "1");
            await sync(true);
          }
          return;
        }

        if (remoteRevision > localRevision) {
          if (isDirty() && hasMeaningfulLocalState()) {
            registerConflict({
              localRevision,
              remoteRevision,
              detectedAt: new Date().toISOString(),
              remoteState
            });
            return;
          }
          applyRemoteState(remoteState, remoteRevision, String(payload.updatedAt || ""));
          window.location.reload();
          return;
        }

        if (remoteRevision === localRevision && isDirty()) await sync();
        if (localRevision > remoteRevision) {
          registerConflict({ localRevision, remoteRevision, detectedAt: new Date().toISOString(), remoteState });
        }
      } catch {
        // Continua com o cache local; nenhuma cópia é apagada.
      }
    }

    void hydrate();
    const interval = window.setInterval(() => void sync(), 4000);
    const onOnline = () => void sync(true);
    const onVisibility = () => { if (document.visibilityState === "hidden") void sync(); };

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
