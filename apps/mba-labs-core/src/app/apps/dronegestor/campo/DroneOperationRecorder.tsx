"use client";

import Link from "next/link";
import { Check, CloudOff, History, LoaderCircle, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { snapshotDroneLocalState } from "./DronePersistenceSync";

const OPERATION_ID_KEY = "dronegestor:operationId:v3";
const LAST_FINALIZED_KEY = "dronegestor:lastFinalizedOperationId:v3";
const PENDING_FINALIZATION_KEY = "dronegestor:pendingFinalization:v3";

type MissionSnapshot = {
  cultura?: string;
  alvo?: string;
  area?: number;
  drone?: string;
  sarpasConfirmado?: boolean;
};

type PendingFinalization = {
  operationId: string;
  pilotName: string;
  state: Record<string, unknown>;
  requestedAt: string;
};

function createOperationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function isBooleanRecordComplete(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const values = Object.values(value as Record<string, unknown>);
  return values.length > 0 && values.every((item) => item === true);
}

function getMission() {
  return readJson<MissionSnapshot>("dronegestor:mission:v2") ?? {};
}

function ensureOperationId(mission: MissionSnapshot) {
  const hasMission = Boolean(mission.cultura || mission.alvo || mission.drone || Number(mission.area) > 0);
  let id = localStorage.getItem(OPERATION_ID_KEY) || "";
  const last = localStorage.getItem(LAST_FINALIZED_KEY) || "";

  if (!hasMission) {
    if (id && id === last) {
      localStorage.removeItem(OPERATION_ID_KEY);
      localStorage.removeItem(LAST_FINALIZED_KEY);
      id = "";
    }
    return id;
  }

  if (!id) {
    id = createOperationId();
    localStorage.setItem(OPERATION_ID_KEY, id);
  }

  return id;
}

function buildState(operationId: string) {
  const state = snapshotDroneLocalState() as Record<string, unknown>;
  const mission = getMission();
  state.operationId = operationId;
  state.progressHa = Number(mission.area) || state.progressHa || 0;
  state.concluida = true;
  state.concluidaNoDispositivoEm = new Date().toISOString();
  return state;
}

async function sendFinalization(payload: PendingFinalization) {
  const response = await fetch("/api/dronegestor/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      state: payload.state,
      operationId: payload.operationId,
      pilotName: payload.pilotName
    }),
    cache: "no-store",
    keepalive: true
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Não foi possível registrar a operação.");
  }
  return data;
}

export function DroneOperationRecorder({ pilotName }: { pilotName: string }) {
  const [mission, setMission] = useState<MissionSnapshot>({});
  const [ready, setReady] = useState(false);
  const [operationId, setOperationId] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(() => {
    const currentMission = getMission();
    const calibration = readJson<Record<string, boolean>>("dronegestor:calibration:v2");
    const checklist = readJson<Record<string, boolean>>("dronegestor:checklist:v2");
    const id = ensureOperationId(currentMission);
    const last = localStorage.getItem(LAST_FINALIZED_KEY) || "";

    setMission(currentMission);
    setOperationId(id);
    setSaved(Boolean(id && id === last));
    setPending(Boolean(localStorage.getItem(PENDING_FINALIZATION_KEY)));
    setReady(Boolean(
      currentMission.cultura &&
      currentMission.alvo &&
      currentMission.drone &&
      Number(currentMission.area) > 0 &&
      currentMission.sarpasConfirmado === true &&
      isBooleanRecordComplete(calibration) &&
      isBooleanRecordComplete(checklist)
    ));
  }, []);

  const retryPending = useCallback(async () => {
    if (!navigator.onLine || saving) return;
    const queued = readJson<PendingFinalization>(PENDING_FINALIZATION_KEY);
    if (!queued) return;

    setSaving(true);
    try {
      await sendFinalization(queued);
      localStorage.setItem(LAST_FINALIZED_KEY, queued.operationId);
      localStorage.removeItem(PENDING_FINALIZATION_KEY);
      setMessage("Operação sincronizada com o histórico.");
    } catch {
      setMessage("Conclusão continua pendente de sincronização.");
    } finally {
      setSaving(false);
      refresh();
    }
  }, [refresh, saving]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 1500);
    const onOnline = () => void retryPending();
    window.addEventListener("online", onOnline);
    void retryPending();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh, retryPending]);

  const label = useMemo(() => {
    if (saving) return "Salvando...";
    if (pending) return "Conclusão pendente";
    if (saved) return "Operação salva";
    return "Concluir e salvar";
  }, [pending, saved, saving]);

  async function finalize() {
    if (!ready || saving || saved) return;
    if (!window.confirm("Confirmar que a aplicação foi concluída? Esta ação criará um registro definitivo no histórico do DroneGestor.")) return;

    const id = operationId || ensureOperationId(mission) || createOperationId();
    localStorage.setItem(OPERATION_ID_KEY, id);
    const payload: PendingFinalization = {
      operationId: id,
      pilotName,
      state: buildState(id),
      requestedAt: new Date().toISOString()
    };

    if (!navigator.onLine) {
      localStorage.setItem(PENDING_FINALIZATION_KEY, JSON.stringify(payload));
      setPending(true);
      setMessage("Sem internet. A conclusão foi guardada no aparelho e será enviada quando a conexão voltar.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await sendFinalization(payload);
      localStorage.setItem(LAST_FINALIZED_KEY, id);
      localStorage.removeItem(PENDING_FINALIZATION_KEY);
      setSaved(true);
      setPending(false);
      setMessage("Operação registrada definitivamente no histórico.");
    } catch (error) {
      localStorage.setItem(PENDING_FINALIZATION_KEY, JSON.stringify(payload));
      setPending(true);
      setMessage(error instanceof Error ? `${error.message} Ficou pendente para nova tentativa.` : "Conclusão pendente de sincronização.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", right: 14, bottom: 84, zIndex: 80, display: "grid", gap: 8, width: "min(330px, calc(100vw - 28px))" }}>
      {message ? (
        <div style={{ borderRadius: 14, padding: "10px 12px", background: "rgba(8,25,20,.96)", color: "#d1fae5", border: "1px solid rgba(52,211,153,.35)", fontSize: 12, lineHeight: 1.4, boxShadow: "0 12px 35px rgba(0,0,0,.25)" }}>
          {message}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        <Link href="/apps/dronegestor/historico" style={{ minHeight: 40, display: "inline-flex", alignItems: "center", gap: 7, padding: "0 12px", borderRadius: 999, background: "rgba(15,23,42,.96)", color: "#e2e8f0", border: "1px solid rgba(148,163,184,.3)", fontSize: 12, fontWeight: 800, textDecoration: "none", boxShadow: "0 10px 28px rgba(0,0,0,.22)" }}>
          <History size={16} /> Histórico
        </Link>

        {ready || saved || pending ? (
          <button
            type="button"
            onClick={() => void finalize()}
            disabled={!ready || saving || saved || pending}
            style={{ minHeight: 40, display: "inline-flex", alignItems: "center", gap: 7, padding: "0 13px", borderRadius: 999, border: "1px solid rgba(52,211,153,.38)", background: saved ? "#065f46" : pending ? "#92400e" : "#10b981", color: "white", fontSize: 12, fontWeight: 900, cursor: !ready || saving || saved || pending ? "default" : "pointer", boxShadow: "0 10px 28px rgba(0,0,0,.22)" }}
          >
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : pending ? <CloudOff size={16} /> : saved ? <Check size={16} /> : <Save size={16} />}
            {label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
