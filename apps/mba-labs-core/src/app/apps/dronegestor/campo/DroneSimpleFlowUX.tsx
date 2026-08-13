"use client";

import { Check, MapPinned, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DroneMapEvidence } from "./DroneMapEvidence";

type View =
  | "inicio"
  | "nova"
  | "calda"
  | "estrategia"
  | "seguranca"
  | "controle"
  | "calibracao"
  | "checklist"
  | "sarpas"
  | "execucao"
  | "relatorios"
  | "config";

type Phase = {
  number: number;
  label: string;
  detail: string;
  views: View[];
};

const VIEW_KEY = "dronegestor:view:v3";

const phases: Phase[] = [
  { number: 1, label: "Operação", detail: "OS e dados", views: ["nova"] },
  { number: 2, label: "Calda", detail: "Produtos e cargas", views: ["calda"] },
  { number: 3, label: "Segurança", detail: "Mapa, clima e risco", views: ["estrategia", "seguranca"] },
  { number: 4, label: "Equipamento", detail: "Ajustes e checklist", views: ["controle", "calibracao", "checklist"] },
  { number: 5, label: "Liberação", detail: "SARPAS e conferência", views: ["sarpas"] },
  { number: 6, label: "Aplicar", detail: "Execução e finalização", views: ["execucao", "relatorios"] }
];

const validViews = new Set<View>([
  "inicio", "nova", "calda", "estrategia", "seguranca", "controle", "calibracao", "checklist", "sarpas", "execucao", "relatorios", "config"
]);

const exactTextReplacements = new Map<string, string>([
  ["Estratégia e insight", "Segurança • orientação"],
  ["Mapa e segurança", "Segurança • mapa e clima"],
  ["Parâmetros do controle", "Equipamento • ajustes"],
  ["Calibração", "Equipamento • calibração"],
  ["Checklist pré-voo", "Equipamento • checklist"],
  ["SARPAS", "Liberação para voo"],
  ["Operação em andamento", "Aplicar"],
  ["Dados e relatórios", "Finalização"],
  ["Ver estratégia", "Continuar para segurança"],
  ["Analisar segurança", "Conferir mapa e clima"],
  ["Dados / rascunho", "Finalização"],
  ["Calcular calda", "Calda"]
]);

function readView(): View {
  try {
    const value = localStorage.getItem(VIEW_KEY) as View | null;
    return value && validViews.has(value) ? value : "inicio";
  } catch {
    return "inicio";
  }
}

function phaseFor(view: View) {
  return phases.find((phase) => phase.views.includes(view)) ?? null;
}

function simplifyVisibleLabels(view: View) {
  if (typeof document === "undefined" || !document.body) return;
  const activePhase = phaseFor(view);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const current = node.nodeValue?.trim() || "";
    const replacement = exactTextReplacements.get(current);
    if (replacement && node.nodeValue) {
      node.nodeValue = node.nodeValue.replace(current, replacement);
    } else if (/^Etapa\s+\d+\s+de\s+8$/i.test(current) && activePhase && node.nodeValue) {
      node.nodeValue = node.nodeValue.replace(current, `Fase ${activePhase.number} de 6 • ${activePhase.label}`);
    }
    node = walker.nextNode();
  }
}

export function DroneSimpleFlowUX() {
  const [view, setView] = useState<View>("inicio");
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    let lastView = readView();
    setView(lastView);
    simplifyVisibleLabels(lastView);

    const sync = () => {
      const next = readView();
      if (next !== lastView) {
        lastView = next;
        setView(next);
      }
      simplifyVisibleLabels(next);
    };

    const observer = new MutationObserver(() => simplifyVisibleLabels(readView()));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const interval = window.setInterval(sync, 350);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  const activePhase = useMemo(() => phaseFor(view), [view]);
  const showMap = ["estrategia", "seguranca", "execucao", "relatorios"].includes(view);

  return (
    <>
      <section className="bg-emerald-950 px-3 pt-3 text-white sm:px-5 sm:pt-5">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-emerald-700/60 bg-emerald-900/80 p-3 shadow-lg shadow-emerald-950/20">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <strong className="text-sm font-black">
                {activePhase ? `Fase ${activePhase.number} de 6 — ${activePhase.label}` : "Fluxo simples em 6 fases"}
              </strong>
              <p className="mt-0.5 text-[11px] leading-4 text-emerald-100/70">
                {activePhase?.detail || "O sistema mantém as travas técnicas, mas mostra só o necessário para executar."}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {phases.map((phase) => {
              const active = activePhase?.number === phase.number;
              const done = Boolean(activePhase && phase.number < activePhase.number);
              return (
                <div
                  key={phase.number}
                  className={`rounded-xl border px-2 py-2 text-center ${
                    active
                      ? "border-emerald-300 bg-emerald-300 text-emerald-950"
                      : done
                        ? "border-emerald-500/40 bg-emerald-800 text-emerald-50"
                        : "border-emerald-700 bg-emerald-950/60 text-emerald-100/60"
                  }`}
                >
                  <span className="mx-auto grid size-5 place-items-center rounded-full bg-current/10 text-[10px] font-black">
                    {done ? <Check size={12} strokeWidth={3} /> : phase.number}
                  </span>
                  <strong className="mt-1 block truncate text-[10px] font-black">{phase.label}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {showMap && (
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="fixed bottom-24 right-4 z-[70] inline-flex min-h-12 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-700 px-4 text-sm font-black text-white shadow-xl shadow-emerald-950/25 active:scale-95"
        >
          <MapPinned size={19} />
          Mapa do voo
        </button>
      )}

      {mapOpen && (
        <div className="fixed inset-0 z-[100] flex items-end bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:justify-center sm:p-5">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-[28px] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <strong className="block text-lg font-black text-slate-950">Mapa usado no voo</strong>
                <p className="mt-1 text-xs leading-5 text-slate-500">Tire uma foto da tela do controle ou carregue uma imagem já salva.</p>
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700"
                aria-label="Fechar mapa do voo"
              >
                <X size={20} />
              </button>
            </div>
            <DroneMapEvidence />
          </div>
        </div>
      )}
    </>
  );
}
