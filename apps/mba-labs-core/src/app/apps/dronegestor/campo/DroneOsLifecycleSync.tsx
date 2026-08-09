"use client";

import { useEffect } from "react";

const MISSION_KEY = "dronegestor:mission:v2";
const STARTED_KEY = "dronegestor:started:v3";
const PAUSED_KEY = "dronegestor:paused:v3";
const STATUS_KEY = "dronegestor:missionStatus:v4";
const TRACK_KEY = "dronegestor:lastOsLifecycle:v1";

type TrackedOs = { osId: string; status: string };

function parse<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

async function patchStatus(osId: string, status: string) {
  const response = await fetch("/api/dronegestor/cadastros", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "os", entityId: osId, data: { status } }),
    cache: "no-store"
  });
  return response.ok;
}

export function DroneOsLifecycleSync() {
  useEffect(() => {
    let disposed = false;
    let busy = false;

    async function reconcile() {
      if (disposed || busy || !navigator.onLine) return;
      const mission = parse<Record<string, unknown>>(MISSION_KEY, {});
      const osId = typeof mission.ordemServicoId === "string" ? mission.ordemServicoId : "";
      const started = Boolean(parse(STARTED_KEY, false));
      const paused = Boolean(parse(PAUSED_KEY, false));
      const missionStatus = String(parse(STATUS_KEY, "rascunho") || "rascunho");
      const tracked = parse<TrackedOs | null>(TRACK_KEY, null);

      busy = true;
      try {
        if (!osId) {
          if (tracked?.osId && ["preparacao", "em_preparacao"].includes(tracked.status)) {
            if (await patchStatus(tracked.osId, "aberta")) localStorage.removeItem(TRACK_KEY);
          }
          return;
        }

        let desired = "preparacao";
        if (started) desired = paused || missionStatus === "pausada" ? "suspensa" : "em_execucao";
        if (["pendente_sync", "finalizada"].includes(missionStatus)) {
          localStorage.setItem(TRACK_KEY, JSON.stringify({ osId, status: missionStatus }));
          return;
        }

        if (!tracked || tracked.osId !== osId || tracked.status !== desired) {
          if (await patchStatus(osId, desired)) {
            localStorage.setItem(TRACK_KEY, JSON.stringify({ osId, status: desired }));
          }
        }
      } finally {
        busy = false;
      }
    }

    void reconcile();
    const interval = window.setInterval(() => void reconcile(), 2500);
    const online = () => void reconcile();
    window.addEventListener("online", online);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("online", online);
    };
  }, []);

  return null;
}
