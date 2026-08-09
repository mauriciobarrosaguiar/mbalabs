"use client";

import { useEffect } from "react";

const REVISION_KEY = "dronegestor:syncRevision:v4";
const LEGACY_REVISION_KEY = "dronegestor:serverRevision:v4";
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
export type DroneSyncConflict = {
  remoteRevision: number;
  remoteState: Record<string, unknown> | null;
  detectedAt: string;
};

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

export function getDroneSyncConflict(): DroneSyncConflict | null {
  try {
    const raw = localStorage.getItem(CONFLICT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DroneSyncConflict;
    if (!Number.isFinite(parsed?.remoteRevision)) return null;
    return parsed;
  } catch { return null; }
}

function fingerprint(value: unknown) { return JSON.stringify(value); }
function localRevision() {
  const current = Number(localStorage.getItem(REVISION_KEY) || localStorage.getItem(LEGACY_REVISION_KEY) || 0);
  return Number.isFinite(current) && current >= 0 ? Math.trunc(current) : 0;
}
function setLocalRevision(revision: number) {
  localStorage.setItem(REVISION_KEY, String(Math.max(0, Math.trunc(revision))));
  localStorage.removeItem(LEGACY_REVISION_KEY);
}
function markDirty(value: boolean) { localStorage.setItem(DIRTY_KEY, value ? "1" : "0"); }
function isDirty() { return localStorage.getItem(DIRTY_KEY) === "1"; }

function applyRemoteState(state: Record<string, unknown>, revision: number) {
  for (const [name, key] of Object.entries(STORAGE) as Array<[keyof typeof STORAGE, string]>) {
    if (!(name in state)) continue;
    const value = state[name];
    if (value === undefined) continue;
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }
  setLocalRevision(revision);
  markDirty(false);
  localStorage.removeItem(CONFLICT_KEY);
}

function meaningfulLocalState() {
  const state = snapshotDroneLocalState();
  const mission = state.mission && typeof state.mission === "object" ? state.mission as Record<string, unknown> : null;
  return Boolean(
    mission && (mission.cultura || mission.area || mission.ordemServicoId) ||
    state.operationStarted || Number(state.progressHa || 0) > 0 ||
    (Array.isArray(state.tankRecords) && state.tankRecords.length > 0)
  );
}

function saveConflict(remoteRevision: number, remoteState: Record<string, unknown> | null) {
  const conflict: DroneSyncConflict = { remoteRevision, remoteState, detectedAt: new Date().toISOString() };
  localStorage.setItem(CONFLICT_KEY, JSON.stringify(conflict));
  window.dispatchEvent(new CustomEvent("dronegestor:sync-conflict", { detail: conflict }));
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
    saveConflict(Number(payload?.revision || 0), payload?.state && typeof payload.state === "object" ? payload.state : null);
    return { conflict: true, revision: Number(payload?.revision || 0) };
  }
  if (!response.ok) throw new Error(payload?.error || "Falha ao sincronizar DroneGestor.");
  const revision = Number(payload?.revision || baseRevision + 1);
  setLocalRevision(revision);
  markDirty(false);
  localStorage.removeItem(CONFLICT_KEY);
  return { conflict: false, revision };
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

export function markDroneStateChanged() {
  markDirty(true);
  return new Date().toISOString();
}

export function DronePersistenceSync() {
  useEffect(() => {
    let disposed = false;
    let syncing = false;
    let initialized = false;
    let baseline = fingerprint(snapshotDroneLocalState());

    async function hydrate() {
      try {
        const response = await fetch("/api/dronegestor/state", { cache: "no-store" });
        if (!response.ok) {
          initialized = true;
          baseline = fingerprint(snapshotDroneLocalState());
          return;
        }
        const payload = await response.json();
        if (disposed) return;
        const remoteRevision = Number(payload?.revision || 0);
        const currentRevision = localRevision();
        const remoteState = payload?.state && typeof payload.state === "object" ? payload.state as Record<string, unknown> : null;
        const localState = snapshotDroneLocalState();
        const localFp = fingerprint(localState);
        const remoteFp = remoteState ? fingerprint(remoteState) : "";

        if (!remoteState) {
          if (meaningfulLocalState()) {
            markDirty(true);
            const result = await pushState(0);
            if (result.conflict) return;
          } else {
            setLocalRevision(remoteRevision);
            markDirty(false);
          }
        } else if (currentRevision === 0 && !meaningfulLocalState()) {
          applyRemoteState(remoteState, remoteRevision);
          window.location.reload();
          return;
        } else if (remoteRevision !== currentRevision) {
          if (localFp === remoteFp || !meaningfulLocalState()) {
            applyRemoteState(remoteState, remoteRevision);
            window.location.reload();
            return;
          }
          saveConflict(remoteRevision, remoteState);
        } else if (localFp !== remoteFp || isDirty()) {
          markDirty(true);
          const result = await pushState(currentRevision);
          if (result.conflict) return;
        }

        initialized = true;
        baseline = fingerprint(snapshotDroneLocalState());
      } catch {
        initialized = true;
        baseline = fingerprint(snapshotDroneLocalState());
      }
    }

    async function sync() {
      if (disposed || syncing || !initialized || !navigator.onLine || getDroneSyncConflict()) return;
      const currentFingerprint = fingerprint(snapshotDroneLocalState());
      if (currentFingerprint !== baseline) {
        baseline = currentFingerprint;
        markDirty(true);
      }
      if (!isDirty()) return;
      syncing = true;
      try {
        const result = await pushState(localRevision());
        if (result.conflict) return;
        baseline = fingerprint(snapshotDroneLocalState());
      } catch {
        markDirty(true);
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
