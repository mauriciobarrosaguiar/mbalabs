"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

const MISSION_KEY = "dronegestor:mission:v2";
const VIEW_KEY = "dronegestor:view:v3";

type GateState = { visible: boolean; missing: string[] };

type Mission = Record<string, any>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function positive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function findMissing(mission: Mission) {
  const missing: string[] = [];
  const textFields: Array<[string, unknown]> = [
    ["Tipo de atividade", mission.tipoAtividade],
    ["Cultura", mission.cultura],
    ["Alvo", mission.alvo],
    ["Drone", mission.drone],
    ["Registro ANAC", mission.registroAnac || mission.identificacaoAnac],
    ["Bico / atomizador", mission.pontaModelo || mission.pontaPulverizacao],
  ];
  const numericFields: Array<[string, unknown]> = [
    ["Área", mission.area],
    ["Volume", mission.volume],
    ["Tanque", mission.tanque],
    ["Faixa", mission.faixa],
    ["Velocidade", mission.velocidadeKmh],
    ["Altura", mission.alturaM],
  ];

  textFields.forEach(([label, value]) => {
    if (!String(value || "").trim()) missing.push(label);
  });
  numericFields.forEach(([label, value]) => {
    if (!positive(value)) missing.push(label);
  });

  const products = Array.isArray(mission.produtos) ? mission.produtos : [];
  if (!products.length) missing.push("Produto / receita");
  products.forEach((product: any, index: number) => {
    if (!String(product?.nome || "").trim()) missing.push(`Produto ${index + 1}: nome`);
    if (!positive(product?.dose)) missing.push(`Produto ${index + 1}: dose`);
    if (!String(product?.unidade || "").trim()) missing.push(`Produto ${index + 1}: unidade`);
  });

  return missing;
}

function readState(): GateState {
  if (typeof window === "undefined") return { visible: false, missing: [] };
  const mission = readJson<Mission>(MISSION_KEY, {});
  return {
    visible: localStorage.getItem(VIEW_KEY) === "nova",
    missing: findMissing(mission),
  };
}

export function DroneMissionGateHint() {
  const [state, setState] = useState<GateState>({ visible: false, missing: [] });

  useEffect(() => {
    const refresh = () => setState(readState());
    refresh();
    const timer = window.setInterval(refresh, 400);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!state.visible) return null;
  const ready = state.missing.length === 0;

  return (
    <section className="bg-[#f4f8f1] px-3 pt-2 sm:px-5">
      <div className={`mx-auto w-full max-w-3xl rounded-2xl border p-3 shadow-sm ${ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-start gap-2">
          {ready ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-700"/> : <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-700"/>}
          <div className="min-w-0 flex-1">
            <strong className={`block text-xs font-black ${ready ? "text-emerald-950" : "text-amber-950"}`}>
              {ready ? "Dados completos — Calcular missão deve estar liberado" : "Para liberar Calcular missão, complete:"}
            </strong>
            {ready ? (
              <p className="mt-1 text-[11px] leading-4 text-emerald-800">Os tempos operacionais são opcionais e não bloqueiam o cálculo.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {state.missing.map((item) => <span key={item} className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] font-black text-amber-900">{item}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
