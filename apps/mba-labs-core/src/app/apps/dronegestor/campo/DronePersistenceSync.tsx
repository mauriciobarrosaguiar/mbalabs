"use client";

import { useEffect } from "react";

const REVISION_KEY = "dronegestor:serverRevision:v4";
const STORAGE = {
  mission: "dronegestor:mission:v2",
  settings: "dronegestor:settings:v2",
  calibration: "dronegestor:calibration:v2",
  checklist: "dronegestor:checklist:v2",
  occurrences: "dronegestor:occurrences:v2",
  weather: "dronegestor:weather",
  progressHa: "dronegestor:progress:v2",
  insightAccepted: "dronegestor:insightAccepted:v2",
  riskAccepted: "dronegestor:riskAccepted:v2",
  currentView: "dronegestor:view:v3",
  operationStarted: "dronegestor:started:v3",
  paused: "dronegestor:paused:v3",
  startedAt: "dronegestor:startedAt:v4",
  finalizedAt: "dronegestor:finalizedAt:v4"
} as const;

type LocalState = Record<keyof typeof STORAGE, unknown>;

function safeParse(value: string | null) {
  if (value === null) return null;
  try { return JSON.parse(value); } catch { return value; }
}

export function snapshotDroneLocalState(overrides: Partial<LocalState> = {}) {
  const state = {} as LocalState;
  for (const [name, key] of Object.entries(STORAGE) as Array<[keyof typeof STORAGE, string]>) {
    state[name] = safeParse(localStorage.getItem(key));
  }
  return { ...state, ...overrides };
}

function fingerprint(value: unknown) { return JSON.stringify(value); }
function localRevision() { const parsed = Number(localStorage.getItem(REVISION_KEY) || 0); return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0; }
function setLocalRevision(revision: number) { localStorage.setItem(REVISION_KEY, String(Math.max(0, Math.trunc(revision)))); }

function applyRemoteState(state: Record<string, unknown>, revision: number) {
  for (const [name, key] of Object.entries(STORAGE) as Array<[keyof typeof STORAGE, string]>) {
    if (!(name in state)) continue;
    const value = state[name];
    if (value === undefined) continue;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }
  setLocalRevision(revision);
}

function hasMeaningfulLocalState() {
  const state = snapshotDroneLocalState();
  const mission = state.mission && typeof state.mission === "object" ? state.mission as Record<string, unknown> : null;
  return Boolean(mission && (mission.cultura || mission.area || mission.ordemServicoId)) || Boolean(state.operationStarted) || Number(state.progressHa || 0) > 0;
}

async function putState(baseRevision: number) {
  const response = await fetch("/api/dronegestor/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: snapshotDroneLocalState(), baseRevision }),
    cache: "no-store"
  });
  const payload = await response.json().catch(() => null);
  if (response.status === 409 && payload?.state) {
    applyRemoteState(payload.state as Record<string, unknown>, Number(payload.revision || 0));
    return { conflict: true };
  }
  if (!response.ok) throw new Error(payload?.error || "Falha ao sincronizar DroneGestor.");
  setLocalRevision(Number(payload?.revision || baseRevision + 1));
  return { conflict: false };
}

export async function finalizeDroneOperation(overrides: Partial<LocalState> = {}) {
  const response = await fetch("/api/dronegestor/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: snapshotDroneLocalState(overrides) }),
    cache: "no-store",
    keepalive: true
  });
  if (!response.ok) throw new Error("Falha ao registrar a operação concluída.");
  return response.json();
}

export function markDroneStateChanged() { return new Date().toISOString(); }

export function DronePersistenceSync() {
  useEffect(() => {
    let disposed = false;
    let syncing = false;
    let initialized = false;
    let lastSyncedFingerprint = "";

    async function hydrate() {
      try {
        const response = await fetch("/api/dronegestor/state", { cache: "no-store" });
        if (!response.ok) { initialized = true; lastSyncedFingerprint = fingerprint(snapshotDroneLocalState()); return; }
        const payload = await response.json();
        if (disposed) return;
        const remoteRevision = Number(payload?.revision || 0);
        const currentRevision = localRevision();
        const remoteState = payload?.state && typeof payload.state === "object" ? payload.state as Record<string, unknown> : null;

        if (remoteState && remoteRevision !== currentRevision) {
          applyRemoteState(remoteState, remoteRevision);
          window.location.reload();
          return;
        }

        if (!remoteState && hasMeaningfulLocalState()) {
          const result = await putState(0);
          if (result.conflict) { window.location.reload(); return; }
        } else if (remoteState) {
          const localFp = fingerprint(snapshotDroneLocalState());
          const remoteFp = fingerprint(remoteState);
          if (localFp !== remoteFp) {
            const result = await putState(currentRevision);
            if (result.conflict) { window.location.reload(); return; }
          }
        }

        initialized = true;
        lastSyncedFingerprint = fingerprint(snapshotDroneLocalState());
      } catch {
        initialized = true;
        lastSyncedFingerprint = fingerprint(snapshotDroneLocalState());
      }
    }

    async function sync() {
      if (disposed || syncing || !initialized || !navigator.onLine) return;
      const currentFingerprint = fingerprint(snapshotDroneLocalState());
      if (currentFingerprint === lastSyncedFingerprint) return;
      syncing = true;
      try {
        const result = await putState(localRevision());
        if (result.conflict) { window.location.reload(); return; }
        lastSyncedFingerprint = currentFingerprint;
      } catch {
        // Mantém o estado local para a próxima tentativa.
      } finally {
        syncing = false;
      }
    }

    void hydrate();
    const interval = window.setInterval(() => void sync(), 4000);
    const onOnline = () => void sync();
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
