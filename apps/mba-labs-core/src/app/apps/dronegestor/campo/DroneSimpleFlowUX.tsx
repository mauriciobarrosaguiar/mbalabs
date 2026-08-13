"use client";

import { Check, CircleHelp } from "lucide-react";
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

type Tip = { title: string; text: string };

const VIEW_KEY = "dronegestor:view:v3";

const phases: Phase[] = [
  { number: 1, label: "Operação", detail: "OS e dados", views: ["nova"] },
  { number: 2, label: "Calda", detail: "Produtos e cargas", views: ["calda"] },
  { number: 3, label: "Segurança", detail: "Mapa, clima e risco", views: ["estrategia", "seguranca"] },
  { number: 4, label: "Equipamento", detail: "Ajustes e checklist", views: ["controle", "calibracao", "checklist"] },
  { number: 5, label: "Liberação", detail: "SARPAS e conferência", views: ["sarpas"] },
  { number: 6, label: "Aplicar", detail: "Execução e finalização", views: ["execucao", "relatorios"] }
];

const tips: Record<View, Tip> = {
  inicio: { title: "O que fazer agora?", text: "Escolha uma OS para trabalhar ou retome a operação que já estava em andamento." },
  nova: { title: "1. Confira, não redigite", text: "OS, talhão e drone cadastrado devem preencher o máximo possível. Complete somente o que estiver faltando para esta aplicação." },
  calda: { title: "2. Confira o cálculo", text: "Veja total de calda, cargas e produto por carga. Dose vem da receita/bula; a calculadora só faz a matemática." },
  estrategia: { title: "3. Leia a orientação", text: "Esta é uma subetapa de Segurança. Confirme que a receita, bula e orientação técnica foram verificadas antes de seguir." },
  seguranca: { title: "3. Segurança no local", text: "Registre o mapa usado, confira área sensível e informe vento, direção, temperatura e umidade medidos no talhão." },
  controle: { title: "4. Apenas confira os ajustes", text: "Você não precisa decorar fórmulas. Compare os valores calculados com o controle do drone e corrija qualquer divergência antes da calibração." },
  calibracao: { title: "4. Calibre na ordem", text: "Faça exatamente nesta sequência: eliminar o ar, calibrar o fluxômetro e depois calibrar a bomba." },
  checklist: { title: "4. Faça a volta no equipamento", text: "Marque cada item somente depois de olhar e conferir fisicamente. O clima já vem da etapa de Segurança." },
  sarpas: { title: "5. Liberação para voo", text: "Consulte o sistema oficial. Use “dispensado” ou “não aplicável” somente quando essa conclusão estiver realmente confirmada para o caso." },
  execucao: { title: "6. Registre o que realmente aconteceu", text: "A cada abastecimento, informe hectares efetivamente aplicados e volume realmente utilizado. Use Ocorrência para qualquer desvio." },
  relatorios: { title: "6. Finalização", text: "Confira área, volume, ocorrências e arquivos salvos. O histórico deve refletir o que foi executado no campo." },
  config: { title: "Configuração da empresa", text: "Padrões internos pertencem ao ADMIN/RT. Eles orientam e podem bloquear a operação, mas não substituem legislação, bula ou receita." }
};

const validViews = new Set<View>([
  "inicio", "nova", "calda", "estrategia", "seguranca", "controle", "calibracao", "checklist", "sarpas", "execucao", "relatorios", "config"
]);

const exactTextReplacements = new Map<string, string>([
  ["Estratégia e insight", "Segurança • orientação técnica"],
  ["Mapa e segurança", "Segurança • mapa e clima"],
  ["Parâmetros do controle", "Equipamento • conferir ajustes"],
  ["Calibração", "Equipamento • calibração"],
  ["Checklist pré-voo", "Equipamento • checklist"],
  ["SARPAS", "Liberação para voo"],
  ["Operação em andamento", "Aplicar"],
  ["Dados e relatórios", "Finalização"],
  ["Ver estratégia", "Continuar para segurança"],
  ["Analisar segurança", "Conferir mapa e clima"],
  ["Dados / rascunho", "Finalização"],
  ["Calcular calda", "Calda"],
  ["Dispensado após conferência oficial aplicável", "Dispensado — somente após conferência oficial"],
  ["Não aplicável ao caso após conferência", "Não aplicável — somente após conferência do caso"],
  ["Usar nuvem", "Usar versão salva na nuvem"],
  ["Manter aparelho", "Usar versão deste aparelho"]
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
  const tip = tips[view];
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
              <p className="mt-0.5 text-[11px] leading-4 text-emerald-100/80">
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
                        : "border-emerald-700 bg-emerald-950/60 text-emerald-100/70"
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

          <div className="mt-3 flex gap-2 rounded-xl border border-emerald-700 bg-emerald-950/55 px-3 py-2.5">
            <CircleHelp size={17} className="mt-0.5 shrink-0 text-emerald-300" />
            <div>
              <strong className="block text-xs font-black text-white">{tip.title}</strong>
              <p className="mt-0.5 text-[11px] leading-4 text-emerald-100/80">{tip.text}</p>
            </div>
          </div>
        </div>
      </section>

      {showMap && <DroneMapEvidence />}
    </>
  );
}
