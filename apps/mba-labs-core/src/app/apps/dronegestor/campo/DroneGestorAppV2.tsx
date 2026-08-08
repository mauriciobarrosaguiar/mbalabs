"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  ChevronRight,
  ClipboardCheck,
  CloudSun,
  Compass,
  Download,
  Drone,
  Droplets,
  FileSpreadsheet,
  FileText,
  Gauge,
  Home,
  Leaf,
  Map,
  Pause,
  Play,
  RotateCcw,
  Route,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Target,
  TimerReset,
  Wind,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { snapshotDroneLocalState } from "./DronePersistenceSync";

type View = "inicio" | "nova" | "calda" | "estrategia" | "seguranca" | "controle" | "calibracao" | "checklist" | "sarpas" | "execucao" | "relatorios" | "config";
type DoseUnit = "mL/ha" | "L/ha" | "g/ha" | "kg/ha" | "mL/100L" | "g/100L";
type SarpasStatus = "" | "autorizado" | "dispensado" | "nao_aplicavel";

type Product = { id: string; nome: string; dose: number; unidade: DoseUnit };
type CalibrationState = { ar: boolean; fluxometro: boolean; bomba: boolean };
type ChecklistState = { area: boolean; pessoasAnimais: boolean; obstaculos: boolean; drone: boolean; controle: boolean; pulverizacao: boolean; clima: boolean; documentos: boolean };
type CompanySettings = { insightsObrigatorios: boolean; margemPreventiva: number; exigirConfirmacao: boolean; protocoloBordaduraCigarrinha: boolean };
type ModelWeather = { latitude: number; longitude: number; capturedAt: string; temperature: number; humidity: number; windSpeed: number; windDirection: number; windGust: number; precipitation: number };
type Occurrence = { id: string; at: string; text: string };

type Mission = {
  cultura: string;
  alvo: string;
  area: number;
  drone: string;
  volume: number;
  tanque: number;
  faixa: number;
  velocidadeKmh: number;
  alturaM: number;
  produtos: Product[];
  distanciaSensivel: number;
  semAreaSensivel: boolean;
  ventoCampoKmh: number;
  direcaoVentoCampo: string;
  temperaturaCampo: number;
  umidadeCampo: number;
  climaCampoConfirmado: boolean;
  climaCampoMedidoEm: string;
  tempoAbastecimentoMin: number;
  tempoTrocaBateriaMin: number;
  tanquesPorBateria: number;
  tempoDeslocamentoMin: number;
  tempoBordaduraMin: number;
  sarpasNumero: string;
  sarpasSituacao: SarpasStatus;
  sarpasConfirmado: boolean;
  ordemServicoId?: string;
  ordemServicoNumero?: string;
  clienteId?: string;
  clienteNome?: string;
  fazendaId?: string;
  fazendaNome?: string;
  municipio?: string;
  uf?: string;
  talhaoId?: string;
  talhaoNome?: string;
};

type PendingFinalization = { operationId: string; pilotName: string; state: Record<string, unknown>; requestedAt: string; ordemServicoId?: string };

const KEYS = {
  mission: "dronegestor:mission:v2",
  settings: "dronegestor:settings:v2",
  calibration: "dronegestor:calibration:v2",
  checklist: "dronegestor:checklist:v2",
  occurrences: "dronegestor:occurrences:v2",
  weather: "dronegestor:weather",
  progress: "dronegestor:progress:v2",
  insight: "dronegestor:insightAccepted:v2",
  risk: "dronegestor:riskAccepted:v2",
  view: "dronegestor:view:v3",
  started: "dronegestor:started:v3",
  paused: "dronegestor:paused:v3",
  operationId: "dronegestor:operationId:v3",
  lastFinalized: "dronegestor:lastFinalizedOperationId:v3",
  finalQueue: "dronegestor:finalizationQueue:v4",
  oldPending: "dronegestor:pendingFinalization:v3"
} as const;

const blankMission: Mission = {
  cultura: "", alvo: "", area: 0, drone: "", volume: 0, tanque: 0, faixa: 0, velocidadeKmh: 0, alturaM: 0,
  produtos: [{ id: "produto-1", nome: "", dose: 0, unidade: "mL/ha" }],
  distanciaSensivel: 0, semAreaSensivel: false, ventoCampoKmh: 0, direcaoVentoCampo: "", temperaturaCampo: 0, umidadeCampo: 0,
  climaCampoConfirmado: false, climaCampoMedidoEm: "", tempoAbastecimentoMin: 0, tempoTrocaBateriaMin: 0, tanquesPorBateria: 0,
  tempoDeslocamentoMin: 0, tempoBordaduraMin: 0, sarpasNumero: "", sarpasSituacao: "", sarpasConfirmado: false
};

const defaultSettings: CompanySettings = { insightsObrigatorios: true, margemPreventiva: 90, exigirConfirmacao: true, protocoloBordaduraCigarrinha: false };
const blankCalibration: CalibrationState = { ar: false, fluxometro: false, bomba: false };
const blankChecklist: ChecklistState = { area: false, pessoasAnimais: false, obstaculos: false, drone: false, controle: false, pulverizacao: false, clima: false, documentos: false };
const flow: View[] = ["nova", "calda", "estrategia", "seguranca", "controle", "calibracao", "checklist", "sarpas", "execucao", "relatorios"];

function readJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? { ...fallback as any, ...JSON.parse(raw) } : fallback; } catch { return fallback; }
}
function readRawJson<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function n(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function round(value: number, digits = 2) { const f = 10 ** digits; return Math.round(value * f) / f; }
function fmt(value: number, digits = 1) { return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0); }
function duration(hours: number) { if (!hours || hours <= 0) return "—"; const mins = Math.round(hours * 60); return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`; }
function createId(prefix: string) { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function normalizeMission(value: Partial<Mission> | null): Mission {
  const products = Array.isArray(value?.produtos) && value!.produtos!.length ? value!.produtos! : blankMission.produtos;
  return { ...blankMission, ...(value ?? {}), produtos: products };
}
function productAmount(product: Product, area: number, totalCalda: number, areaTank: number, tank: number) {
  const dose = n(product.dose); let total = 0; let perTank = 0; let unit = "";
  if (product.unidade === "mL/ha") { total = area * dose; perTank = areaTank * dose; unit = "mL"; }
  if (product.unidade === "L/ha") { total = area * dose; perTank = areaTank * dose; unit = "L"; }
  if (product.unidade === "g/ha") { total = area * dose; perTank = areaTank * dose; unit = "g"; }
  if (product.unidade === "kg/ha") { total = area * dose; perTank = areaTank * dose; unit = "kg"; }
  if (product.unidade === "mL/100L") { total = totalCalda / 100 * dose; perTank = tank / 100 * dose; unit = "mL"; }
  if (product.unidade === "g/100L") { total = totalCalda / 100 * dose; perTank = tank / 100 * dose; unit = "g"; }
  const human = (v: number, u: string) => u === "mL" && v >= 1000 ? { value: v / 1000, unit: "L" } : u === "g" && v >= 1000 ? { value: v / 1000, unit: "kg" } : { value: v, unit: u };
  return { total: human(total, unit), tank: human(perTank, unit) };
}
function protocolFor(target: string, settings: CompanySettings) {
  const active = target.toLowerCase().includes("cigarrinha") && settings.protocoloBordaduraCigarrinha;
  return {
    gota: "Definir pelo protocolo validado",
    janela: "Cruzar clima, bula e protocolo",
    strategy: active ? "Padrão interno: bordadura → interior." : "Usar o protocolo técnico aprovado para cultura, alvo e produto.",
    note: active ? "Protocolo interno ativo. Confirme produto, estágio, clima e talhão antes de executar." : "O sistema não inventa dose, gota ou estratégia. Use receita, bula e orientação técnica.",
    active
  };
}

export function DroneGestorAppV2({ userName, userType, canManage }: { userName: string; userType: string; canManage: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("inicio");
  const [returnView, setReturnView] = useState<View>("inicio");
  const [mission, setMission] = useState<Mission>(blankMission);
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [calibration, setCalibration] = useState<CalibrationState>(blankCalibration);
  const [checklist, setChecklist] = useState<ChecklistState>(blankChecklist);
  const [insightAccepted, setInsightAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [progressHa, setProgressHa] = useState(0);
  const [operationStarted, setOperationStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [modelWeather, setModelWeather] = useState<ModelWeather | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [notice, setNotice] = useState("");
  const [savingFinal, setSavingFinal] = useState(false);
  const [finalSaved, setFinalSaved] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const previousMissionRef = useRef<Mission | null>(null);

  useEffect(() => {
    const savedMission = normalizeMission(readRawJson<Partial<Mission> | null>(KEYS.mission, null));
    setMission(savedMission);
    setSettings(readJson(KEYS.settings, defaultSettings));
    setCalibration(readJson(KEYS.calibration, blankCalibration));
    setChecklist(readJson(KEYS.checklist, blankChecklist));
    setOccurrences(readRawJson(KEYS.occurrences, [] as Occurrence[]));
    setProgressHa(n(readRawJson(KEYS.progress, 0)));
    setInsightAccepted(Boolean(readRawJson(KEYS.insight, false)));
    setRiskAccepted(Boolean(readRawJson(KEYS.risk, false)));
    setOperationStarted(Boolean(readRawJson(KEYS.started, false)));
    setPaused(Boolean(readRawJson(KEYS.paused, false)));
    setModelWeather(readRawJson(KEYS.weather, null as ModelWeather | null));
    const savedView = localStorage.getItem(KEYS.view) as View | null;
    if (savedView && ["inicio", ...flow, "config"].includes(savedView)) setView(savedView);
    const opId = localStorage.getItem(KEYS.operationId) || "";
    setFinalSaved(Boolean(opId && localStorage.getItem(KEYS.lastFinalized) === opId));

    const oldPending = readRawJson<PendingFinalization | null>(KEYS.oldPending, null);
    const queue = readRawJson<PendingFinalization[]>(KEYS.finalQueue, []);
    if (oldPending && !queue.some((item) => item.operationId === oldPending.operationId)) {
      localStorage.setItem(KEYS.finalQueue, JSON.stringify([...queue, oldPending]));
      localStorage.removeItem(KEYS.oldPending);
      setPendingCount(queue.length + 1);
    } else setPendingCount(queue.length);

    previousMissionRef.current = savedMission;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEYS.mission, JSON.stringify(mission));
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
    localStorage.setItem(KEYS.calibration, JSON.stringify(calibration));
    localStorage.setItem(KEYS.checklist, JSON.stringify(checklist));
    localStorage.setItem(KEYS.occurrences, JSON.stringify(occurrences));
    localStorage.setItem(KEYS.progress, JSON.stringify(progressHa));
    localStorage.setItem(KEYS.insight, JSON.stringify(insightAccepted));
    localStorage.setItem(KEYS.risk, JSON.stringify(riskAccepted));
    localStorage.setItem(KEYS.started, JSON.stringify(operationStarted));
    localStorage.setItem(KEYS.paused, JSON.stringify(paused));
    localStorage.setItem(KEYS.view, view);
    localStorage.setItem("dronegestor:updatedAt:v2", new Date().toISOString());
  }, [hydrated, mission, settings, calibration, checklist, occurrences, progressHa, insightAccepted, riskAccepted, operationStarted, paused, view]);

  useEffect(() => {
    if (!hydrated) return;
    void fetch("/api/dronegestor/config", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((payload) => { if (payload?.settings) setSettings({ ...defaultSettings, ...payload.settings }); })
      .catch(() => null);
  }, [hydrated]);

  useEffect(() => {
    const onWeather = (event: Event) => {
      const custom = event as CustomEvent<ModelWeather>;
      if (custom.detail) setModelWeather(custom.detail);
    };
    window.addEventListener("dronegestor:weather-updated", onWeather);
    return () => window.removeEventListener("dronegestor:weather-updated", onWeather);
  }, []);

  const calc = useMemo(() => {
    const totalCalda = mission.area > 0 && mission.volume > 0 ? mission.area * mission.volume : 0;
    const areaTank = mission.volume > 0 && mission.tanque > 0 ? mission.tanque / mission.volume : 0;
    const exactTanks = mission.tanque > 0 ? totalCalda / mission.tanque : 0;
    const tanks = exactTanks > 0 ? Math.ceil(exactTanks) : 0;
    const wholeTanks = Math.floor(exactTanks);
    const lastTank = tanks ? totalCalda - wholeTanks * mission.tanque : 0;
    const speedMs = mission.velocidadeKmh > 0 ? mission.velocidadeKmh / 3.6 : 0;
    const flowLMin = mission.volume > 0 && mission.velocidadeKmh > 0 && mission.faixa > 0 ? mission.volume * mission.velocidadeKmh * mission.faixa / 600 : 0;
    const haH = mission.velocidadeKmh > 0 && mission.faixa > 0 ? mission.velocidadeKmh * mission.faixa / 10 : 0;
    const sprayHours = haH > 0 ? mission.area / haH : 0;
    const refills = Math.max(0, tanks - 1);
    const batteryChanges = mission.tanquesPorBateria > 0 && tanks > 0 ? Math.floor((tanks - 1) / mission.tanquesPorBateria) : 0;
    const stopsMin = refills * Math.max(0, mission.tempoAbastecimentoMin) + batteryChanges * Math.max(0, mission.tempoTrocaBateriaMin) + Math.max(0, mission.tempoDeslocamentoMin) + Math.max(0, mission.tempoBordaduraMin);
    const estimatedHours = sprayHours > 0 ? sprayHours + stopsMin / 60 : 0;
    const products = mission.produtos.map((product) => ({ product, amount: productAmount(product, mission.area, totalCalda, areaTank, mission.tanque) }));
    return { totalCalda, areaTank, tanks, lastTank, speedMs, flowLMin, haH, sprayHours, refills, batteryChanges, stopsMin, estimatedHours, products };
  }, [mission]);

  const protocol = useMemo(() => protocolFor(mission.alvo, settings), [mission.alvo, settings]);
  const productsReady = mission.produtos.some((p) => p.nome.trim() && p.dose > 0);
  const missionReady = Boolean(mission.cultura.trim() && mission.alvo.trim() && mission.drone.trim() && mission.area > 0 && mission.volume > 0 && mission.tanque > 0 && mission.faixa > 0 && mission.velocidadeKmh > 0 && mission.alturaM > 0 && productsReady);
  const sensitiveReady = mission.semAreaSensivel || mission.distanciaSensivel > 0;
  const weatherReady = mission.climaCampoConfirmado && mission.direcaoVentoCampo.trim() && mission.temperaturaCampo !== 0 && mission.umidadeCampo > 0;
  const safetyReady = Boolean(sensitiveReady && weatherReady && (!settings.insightsObrigatorios || insightAccepted) && (!settings.exigirConfirmacao || riskAccepted));
  const calibrationReady = calibration.ar && calibration.fluxometro && calibration.bomba;
  const checklistReady = Object.values(checklist).every(Boolean);
  const sarpasReady = mission.sarpasConfirmado && Boolean(mission.sarpasSituacao) && (mission.sarpasSituacao !== "autorizado" || mission.sarpasNumero.trim().length > 0);
  const canStart = missionReady && safetyReady && calibrationReady && checklistReady && sarpasReady;
  const areaDone = mission.area > 0 && progressHa >= mission.area - 0.01;

  function flash(text: string) { setNotice(text); window.setTimeout(() => setNotice(""), 3200); }
  function go(next: View) { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function resumeView(): View {
    if (operationStarted) return "execucao";
    if (!missionReady) return "nova";
    if (!insightAccepted && settings.insightsObrigatorios) return "estrategia";
    if (!safetyReady) return "seguranca";
    if (!calibrationReady) return "calibracao";
    if (!checklistReady) return "checklist";
    if (!sarpasReady) return "sarpas";
    return "sarpas";
  }

  function guarded(target: View) {
    if (target === "nova") return go("nova");
    if (["calda", "estrategia"].includes(target) && !missionReady) { flash("Complete os dados obrigatórios da missão primeiro."); return go("nova"); }
    if (target === "seguranca" && (!missionReady || (settings.insightsObrigatorios && !insightAccepted))) { flash("Conclua a missão e a estratégia antes da segurança."); return go(resumeView()); }
    if (["controle", "calibracao"].includes(target) && !safetyReady) { flash("Conclua a análise de segurança antes dos parâmetros e da calibração."); return go(resumeView()); }
    if (target === "checklist" && !calibrationReady) { flash("Conclua a calibração antes do checklist."); return go("calibracao"); }
    if (target === "sarpas" && !checklistReady) { flash("Conclua o checklist antes do SARPAS."); return go(resumeView()); }
    if (target === "execucao" && !operationStarted) { flash("Inicie a operação pela etapa SARPAS."); return go("sarpas"); }
    go(target);
  }

  function back() {
    if (view === "inicio") return flash("Use as ações da tela para iniciar ou retomar.");
    if (view === "config") return go(returnView);
    if (view === "execucao" && operationStarted) return go("inicio");
    if (view === "relatorios") return go(operationStarted ? "execucao" : "inicio");
    const index = flow.indexOf(view);
    go(index <= 0 ? "inicio" : flow[index - 1]);
  }

  function invalidateCoreChange() {
    setInsightAccepted(false); setRiskAccepted(false); setCalibration(blankCalibration); setChecklist(blankChecklist);
    setMission((current) => ({ ...current, sarpasConfirmado: false, sarpasSituacao: "" }));
  }

  function updateMission<K extends keyof Mission>(key: K, value: Mission[K]) {
    if (operationStarted) { flash("A missão está em execução. Parâmetros técnicos ficam bloqueados até a operação ser concluída."); return; }
    const coreKeys: Array<keyof Mission> = ["cultura", "alvo", "area", "drone", "volume", "tanque", "faixa", "velocidadeKmh", "alturaM"];
    const safetyKeys: Array<keyof Mission> = ["distanciaSensivel", "semAreaSensivel", "ventoCampoKmh", "direcaoVentoCampo", "temperaturaCampo", "umidadeCampo"];
    setMission((current) => {
      const next = { ...current, [key]: value } as Mission;
      if (coreKeys.includes(key)) {
        next.sarpasConfirmado = false;
        next.sarpasSituacao = "";
      }
      if (safetyKeys.includes(key)) { next.climaCampoConfirmado = false; next.climaCampoMedidoEm = ""; }
      return next;
    });
    if (coreKeys.includes(key)) { setInsightAccepted(false); setRiskAccepted(false); setCalibration(blankCalibration); setChecklist(blankChecklist); }
    if (safetyKeys.includes(key)) { setRiskAccepted(false); setChecklist((current) => ({ ...current, clima: false })); }
  }

  function updateProduct(id: string, patch: Partial<Product>) {
    if (operationStarted) return flash("Produtos não podem ser alterados durante a execução.");
    setMission((current) => ({ ...current, produtos: current.produtos.map((p) => p.id === id ? { ...p, ...patch } : p), sarpasConfirmado: false, sarpasSituacao: "" }));
    setInsightAccepted(false); setRiskAccepted(false); setCalibration(blankCalibration); setChecklist(blankChecklist);
  }
  function addProduct() { if (operationStarted) return; setMission((current) => ({ ...current, produtos: [...current.produtos, { id: createId("produto"), nome: "", dose: 0, unidade: "mL/ha" }] })); invalidateCoreChange(); }
  function removeProduct(id: string) { if (operationStarted) return; setMission((current) => ({ ...current, produtos: current.produtos.length <= 1 ? current.produtos : current.produtos.filter((p) => p.id !== id) })); invalidateCoreChange(); }

  function confirmClimate() {
    if (!mission.direcaoVentoCampo.trim() || mission.temperaturaCampo === 0 || mission.umidadeCampo <= 0) return flash("Informe direção do vento, temperatura e umidade medidas no talhão.");
    if (!sensitiveReady) return flash("Informe a distância da área sensível ou marque que não há área sensível próxima identificada.");
    setMission((current) => ({ ...current, climaCampoConfirmado: true, climaCampoMedidoEm: new Date().toISOString() }));
    setChecklist((current) => ({ ...current, clima: true }));
    setRiskAccepted(false);
    flash("Medição de campo registrada. Agora faça a confirmação final de risco.");
  }

  function resetMission() {
    if (operationStarted) return flash("Existe uma operação em andamento. Conclua a área antes de iniciar outra missão.");
    const queue = readRawJson<PendingFinalization[]>(KEYS.finalQueue, []);
    if (queue.length) flash(`${queue.length} conclusão(ões) offline permanecem protegidas na fila e serão sincronizadas quando houver internet.`);
    if (!window.confirm("Limpar a missão atual e iniciar uma nova aplicação?")) return;
    const blank = normalizeMission(null);
    setMission(blank); setCalibration(blankCalibration); setChecklist(blankChecklist); setInsightAccepted(false); setRiskAccepted(false); setProgressHa(0); setPaused(false); setOccurrences([]); setFinalSaved(false);
    localStorage.removeItem(KEYS.operationId); localStorage.removeItem(KEYS.lastFinalized);
    go("nova");
  }

  function startOperation() {
    if (!canStart) return flash("Ainda existem etapas obrigatórias pendentes.");
    let id = localStorage.getItem(KEYS.operationId) || "";
    if (!id) { id = createId("op"); localStorage.setItem(KEYS.operationId, id); }
    setOperationStarted(true); setPaused(false); setFinalSaved(false); go("execucao");
  }

  function finishTank() {
    if (paused) return flash("Retome a operação antes de registrar um tanque como finalizado.");
    if (!operationStarted) return;
    const next = Math.min(mission.area, progressHa + calc.areaTank);
    setProgressHa(round(next, 2));
    flash(next >= mission.area ? "Área planejada concluída. Agora conclua e salve a operação." : "Tanque finalizado e progresso atualizado.");
  }

  function addOccurrence() {
    const text = window.prompt("Descreva a ocorrência observada em campo:");
    if (!text?.trim()) return;
    setOccurrences((current) => [...current, { id: createId("oc"), at: new Date().toISOString(), text: text.trim() }]);
    flash("Ocorrência registrada.");
  }

  async function markOrderConcluded(osId?: string) {
    if (!osId) return;
    await fetch("/api/dronegestor/cadastros", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "os", entityId: osId, data: { status: "concluida" } }), cache: "no-store", keepalive: true }).catch(() => null);
  }

  async function sendFinalization(payload: PendingFinalization) {
    const response = await fetch("/api/dronegestor/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: payload.state, operationId: payload.operationId, pilotName: payload.pilotName }), cache: "no-store", keepalive: true });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Não foi possível registrar a operação.");
    await markOrderConcluded(payload.ordemServicoId);
    return data;
  }

  async function retryQueue() {
    if (!navigator.onLine) return;
    const queue = readRawJson<PendingFinalization[]>(KEYS.finalQueue, []);
    if (!queue.length) { setPendingCount(0); return; }
    const remaining: PendingFinalization[] = [];
    for (const item of queue) {
      try { await sendFinalization(item); localStorage.setItem(KEYS.lastFinalized, item.operationId); }
      catch { remaining.push(item); }
    }
    localStorage.setItem(KEYS.finalQueue, JSON.stringify(remaining));
    setPendingCount(remaining.length);
  }

  useEffect(() => {
    if (!hydrated) return;
    void retryQueue();
    const online = () => void retryQueue();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [hydrated]);

  async function finalizeOperation() {
    if (!operationStarted || !areaDone || !canStart || savingFinal || finalSaved) return flash("A conclusão só é liberada depois de 100% da área planejada e de todas as validações obrigatórias.");
    if (!window.confirm(`Confirmar conclusão de ${fmt(mission.area, 2)} ha e salvar definitivamente no histórico?`)) return;
    const operationId = localStorage.getItem(KEYS.operationId) || createId("op");
    localStorage.setItem(KEYS.operationId, operationId);
    const state = snapshotDroneLocalState() as Record<string, unknown>;
    state.progressHa = progressHa;
    state.operationStarted = false;
    state.concluida = true;
    state.concluidaNoDispositivoEm = new Date().toISOString();
    state.operationId = operationId;
    const payload: PendingFinalization = { operationId, pilotName: userName, state, requestedAt: new Date().toISOString(), ordemServicoId: mission.ordemServicoId };

    if (!navigator.onLine) {
      const queue = readRawJson<PendingFinalization[]>(KEYS.finalQueue, []);
      if (!queue.some((item) => item.operationId === operationId)) localStorage.setItem(KEYS.finalQueue, JSON.stringify([...queue, payload]));
      setPendingCount(queue.some((item) => item.operationId === operationId) ? queue.length : queue.length + 1);
      setOperationStarted(false); setPaused(false); setFinalSaved(false); go("relatorios");
      return flash("Sem internet. A conclusão ficou protegida na fila do aparelho e será sincronizada automaticamente.");
    }

    setSavingFinal(true);
    try {
      await sendFinalization(payload);
      localStorage.setItem(KEYS.lastFinalized, operationId);
      setFinalSaved(true); setOperationStarted(false); setPaused(false); go("relatorios");
      flash("Operação salva no histórico e OS concluída.");
    } catch (error) {
      const queue = readRawJson<PendingFinalization[]>(KEYS.finalQueue, []);
      if (!queue.some((item) => item.operationId === operationId)) localStorage.setItem(KEYS.finalQueue, JSON.stringify([...queue, payload]));
      setPendingCount(queue.some((item) => item.operationId === operationId) ? queue.length : queue.length + 1);
      flash(error instanceof Error ? `${error.message} A conclusão ficou protegida para nova tentativa.` : "Conclusão pendente de sincronização.");
    } finally { setSavingFinal(false); }
  }

  async function saveCompanySettings(next: CompanySettings) {
    if (!canManage) return flash("Somente administrador da empresa ou RT autorizado pode alterar os padrões da empresa.");
    const response = await fetch("/api/dronegestor/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: next }), cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) return flash(payload?.error || "Não foi possível salvar a configuração.");
    setSettings(next); setInsightAccepted(false); setRiskAccepted(false); setChecklist((current) => ({ ...current, clima: false }));
    flash("Padrão da empresa salvo e aplicado.");
  }

  function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function exportDraft() {
    const lines = ["DRONEGESTOR AGRO - RASCUNHO DA OPERAÇÃO", "Não substitui envio oficial, receituário, bula ou RT.", "", `OS: ${mission.ordemServicoNumero || "—"}`, `Cliente: ${mission.clienteNome || "—"}`, `Fazenda/Talhão: ${[mission.fazendaNome, mission.talhaoNome].filter(Boolean).join(" / ") || "—"}`, `Cultura: ${mission.cultura}`, `Alvo: ${mission.alvo}`, `Área planejada: ${mission.area} ha`, `Área registrada: ${progressHa} ha`, `Drone: ${mission.drone}`, `Volume: ${mission.volume} L/ha`, `Calda: ${round(calc.totalCalda, 1)} L`, `Velocidade: ${round(calc.speedMs, 2)} m/s`, `Faixa: ${mission.faixa} m`, `Vazão: ${round(calc.flowLMin, 2)} L/min`, `Altura: ${mission.alturaM} m`, `Vento campo: ${mission.ventoCampoKmh} km/h ${mission.direcaoVentoCampo}`, `Temperatura: ${mission.temperaturaCampo} °C`, `UR: ${mission.umidadeCampo}%`, `SARPAS: ${mission.sarpasSituacao} ${mission.sarpasNumero}`, `Ocorrências: ${occurrences.length}`];
    downloadText("dronegestor-rascunho.txt", lines.join("\n"));
  }
  function exportCsv() {
    const header = "data;os;cliente;fazenda;talhao;cultura;alvo;area_planejada_ha;area_registrada_ha;drone;volume_l_ha;velocidade_kmh;faixa_m;vazao_l_min;vento_kmh;direcao_vento;temperatura_c;umidade_pct;sarpas";
    const row = [new Date().toLocaleDateString("pt-BR"), mission.ordemServicoNumero || "", mission.clienteNome || "", mission.fazendaNome || "", mission.talhaoNome || "", mission.cultura, mission.alvo, mission.area, progressHa, mission.drone, mission.volume, mission.velocidadeKmh, mission.faixa, round(calc.flowLMin, 2), mission.ventoCampoKmh, mission.direcaoVentoCampo, mission.temperaturaCampo, mission.umidadeCampo, mission.sarpasNumero].join(";");
    downloadText("dronegestor-dados-operacionais.csv", `${header}\n${row}`, "text/csv;charset=utf-8");
  }

  const title: Record<View, string> = { inicio: "Copiloto de aplicação", nova: "Dados da aplicação", calda: "Cálculo de calda", estrategia: "Estratégia e insight", seguranca: "Mapa e segurança", controle: "Parâmetros do controle", calibracao: "Calibração", checklist: "Checklist pré-voo", sarpas: "SARPAS", execucao: "Operação em andamento", relatorios: "Dados e relatórios", config: "Configurações da empresa" };
  const activeOperation = mission.area > 0;

  if (!hydrated) return <main className="min-h-screen bg-emerald-950 grid place-items-center text-emerald-100"><div className="rounded-2xl border border-emerald-700 bg-emerald-900/70 px-5 py-4 font-bold">Carregando DroneGestor...</div></main>;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,rgba(16,185,129,.18),transparent_24%),linear-gradient(180deg,#052e16_0%,#064e3b_22%,#f8fafc_22%,#f8fafc_100%)] px-3 py-4 sm:px-5 sm:py-7">
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[30px] border border-emerald-200/60 bg-white shadow-2xl shadow-emerald-950/20">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-emerald-100 bg-white/95 px-4 py-3 backdrop-blur">
        <button className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" onClick={back} aria-label="Voltar">{view === "inicio" ? <Home size={20}/> : <ArrowLeft size={20}/>}</button>
        <div className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black uppercase tracking-[.12em] text-emerald-700">{view === "inicio" ? `Olá, ${userName.split(" ")[0]}` : "DroneGestor Agro"}</span><strong className="block truncate text-base font-black text-slate-950">{title[view]}</strong></div>
        <button className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" onClick={() => { if (operationStarted) return flash("Configurações ficam bloqueadas durante a execução."); setReturnView(view); go("config"); }} aria-label="Configurações"><Settings2 size={20}/></button>
      </header>

      {pendingCount > 0 && <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{pendingCount} conclusão(ões) protegida(s) aguardando sincronização. Nenhuma nova missão apaga essa fila.</div>}
      {notice && <div className="mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{notice}</div>}

      <div className="grid gap-4 p-4 pb-24 sm:p-6 sm:pb-24">
        {view === "inicio" && <>
          <div className="grid grid-cols-2 gap-3 rounded-3xl bg-gradient-to-br from-emerald-950 to-emerald-800 p-4 text-white">
            <Metric icon={<CloudSun size={20}/>} label="Modelo meteorológico" value={modelWeather ? `${fmt(modelWeather.temperature, 1)}°C` : "—"} detail="Referência, não anemômetro" dark/>
            <Metric icon={<Wind size={20}/>} label="Vento modelo 10 m" value={modelWeather ? `${fmt(modelWeather.windSpeed, 1)} km/h` : "—"} detail="Compare no talhão" dark/>
          </div>
          {mission.ordemServicoId && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><strong className="text-emerald-950">{mission.ordemServicoNumero || "OS vinculada"}</strong><p className="mt-1 text-sm text-emerald-800">{[mission.clienteNome, mission.fazendaNome, mission.talhaoNome].filter(Boolean).join(" • ")}</p></div>}
          <CardButton icon={<ClipboardCheck/>} title={activeOperation ? "Retomar operação" : "Nova operação"} text={activeOperation ? `${fmt(mission.area, 1)} ha • ${mission.cultura || "cultura pendente"} • ${mission.alvo || "alvo pendente"}` : "Comece pelos dados reais da aplicação."} onClick={() => guarded(resumeView())} primary/>
          <div className="grid gap-3 sm:grid-cols-2">
            <CardButton icon={<Droplets/>} title="Calcular calda" text="Abre somente quando a missão obrigatória estiver completa." onClick={() => guarded("calda")}/>
            <CardButton icon={<Map/>} title="Mapa e segurança" text="Medição de campo, área sensível e confirmação de risco." onClick={() => guarded("seguranca")}/>
            <CardButton icon={<FileText/>} title="Dados / rascunho" text="Consulta e exportação; não substitui documento oficial." onClick={() => go("relatorios")}/>
            <CardButton icon={<RotateCcw/>} title="Nova aplicação" text="Não apaga conclusões offline pendentes." onClick={resetMission}/>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-950"><strong>Sincronização ativa:</strong> o estado de campo é salvo no aparelho e sincronizado com o Supabase quando há conexão. Envio oficial a MAPA/SARPAS continua sendo uma etapa separada.</div>
        </>}

        {view === "nova" && <>
          <Step current={1}/><Title icon={<Sprout/>} title="Dados da aplicação" text="Campos técnicos obrigatórios. Alterações posteriores invalidam confirmações dependentes."/>
          {mission.ordemServicoId && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><strong>{mission.ordemServicoNumero}</strong><p>{[mission.clienteNome, mission.fazendaNome, mission.talhaoNome, mission.municipio && mission.uf ? `${mission.municipio}/${mission.uf}` : ""].filter(Boolean).join(" • ")}</p></div>}
          <FormGrid>
            <TextField label="Cultura *" value={mission.cultura} onChange={(v) => updateMission("cultura", v)}/>
            <TextField label="Alvo *" value={mission.alvo} onChange={(v) => updateMission("alvo", v)}/>
            <NumberField label="Área *" value={mission.area} suffix="ha" onChange={(v) => updateMission("area", v)}/>
            <TextField label="Drone *" value={mission.drone} onChange={(v) => updateMission("drone", v)}/>
            <NumberField label="Volume *" value={mission.volume} suffix="L/ha" onChange={(v) => updateMission("volume", v)}/>
            <NumberField label="Tanque *" value={mission.tanque} suffix="L" onChange={(v) => updateMission("tanque", v)}/>
            <NumberField label="Faixa *" value={mission.faixa} suffix="m" onChange={(v) => updateMission("faixa", v)}/>
            <NumberField label="Velocidade *" value={mission.velocidadeKmh} suffix="km/h" onChange={(v) => updateMission("velocidadeKmh", v)}/>
            <NumberField label="Altura planejada *" value={mission.alturaM} suffix="m" onChange={(v) => updateMission("alturaM", v)}/>
          </FormGrid>
          <Title icon={<Droplets/>} title="Produto / receita" text="Ao menos um produto com nome e dose informada é obrigatório para esta operação de pulverização."/>
          {mission.produtos.map((p, index) => <div key={p.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4"><div className="flex justify-between"><strong>Produto {index + 1}</strong>{mission.produtos.length > 1 && <button className="text-sm font-bold text-red-600" onClick={() => removeProduct(p.id)}>Remover</button>}</div><TextField label="Nome comercial *" value={p.nome} onChange={(v) => updateProduct(p.id, { nome: v })}/><div className="grid grid-cols-[1fr_140px] gap-2"><NumberField label="Dose *" value={p.dose} suffix="" onChange={(v) => updateProduct(p.id, { dose: v })}/><label className="grid gap-1 text-sm font-bold text-slate-700"><span>Unidade</span><select className="min-h-11 rounded-xl border border-slate-200 px-3" value={p.unidade} onChange={(e) => updateProduct(p.id, { unidade: e.target.value as DoseUnit })}>{["mL/ha", "L/ha", "g/ha", "kg/ha", "mL/100L", "g/100L"].map((u) => <option key={u}>{u}</option>)}</select></label></div></div>)}
          <button className="min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-4 font-black text-emerald-800" onClick={addProduct}>+ Adicionar produto</button>
          <Title icon={<TimerReset/>} title="Tempos operacionais" text="Opcionais, usados para melhorar a previsão de duração."/>
          <FormGrid><NumberField label="Abastecimento" value={mission.tempoAbastecimentoMin} suffix="min/parada" onChange={(v) => updateMission("tempoAbastecimentoMin", v)}/><NumberField label="Troca de bateria" value={mission.tempoTrocaBateriaMin} suffix="min" onChange={(v) => updateMission("tempoTrocaBateriaMin", v)}/><NumberField label="Tanques por bateria" value={mission.tanquesPorBateria} suffix="tanques" onChange={(v) => updateMission("tanquesPorBateria", v)}/><NumberField label="Deslocamento" value={mission.tempoDeslocamentoMin} suffix="min" onChange={(v) => updateMission("tempoDeslocamentoMin", v)}/><NumberField label="Bordadura" value={mission.tempoBordaduraMin} suffix="min" onChange={(v) => updateMission("tempoBordaduraMin", v)}/></FormGrid>
          <Primary disabled={!missionReady} onClick={() => guarded("calda")}>Calcular missão <ChevronRight size={18}/></Primary>
        </>}

        {view === "calda" && <><Step current={2}/><Title icon={<Calculator/>} title="Cálculo de calda" text="Resultado matemático com os dados informados; não é recomendação agronômica."/><div className="grid grid-cols-2 gap-3"><Metric icon={<Droplets/>} label="Calda total" value={`${fmt(calc.totalCalda, 1)} L`}/><Metric icon={<Route/>} label="Área por tanque" value={`${fmt(calc.areaTank, 2)} ha`}/><Metric icon={<RotateCcw/>} label="Tanques" value={`${calc.tanks}`} detail={calc.lastTank > 0 ? `Último: ${fmt(calc.lastTank, 1)} L` : ""}/><Metric icon={<Gauge/>} label="Vazão" value={`${fmt(calc.flowLMin, 2)} L/min`}/></div>{calc.products.map(({ product, amount }) => <div key={product.id} className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 p-4 text-sm"><div><span className="text-slate-500">Produto</span><strong className="block">{product.nome}</strong></div><div><span className="text-slate-500">Total</span><strong className="block">{fmt(amount.total.value, 3)} {amount.total.unit}</strong></div><div><span className="text-slate-500">Tanque cheio</span><strong className="block">{fmt(amount.tank.value, 3)} {amount.tank.unit}</strong></div></div>)}<Warning>Confirme receita, bula, compatibilidade e ordem de mistura antes de preparar a calda.</Warning><Primary onClick={() => go("estrategia")}>Ver estratégia <ChevronRight size={18}/></Primary></>}

        {view === "estrategia" && <><Step current={3}/><div className="grid grid-cols-2 gap-3"><Metric icon={<Sprout/>} label="Cultura" value={mission.cultura}/><Metric icon={<Target/>} label="Alvo" value={mission.alvo}/></div><Metric icon={<Droplets/>} label="Gota" value={protocol.gota}/><Metric icon={<Route/>} label="Estratégia" value={protocol.strategy}/><Metric icon={<TimerReset/>} label="Janela" value={protocol.janela}/><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex gap-3"><Sparkles className="text-emerald-700"/><div><strong>{protocol.active ? "Padrão interno da empresa" : "Orientação do sistema"}</strong><p className="mt-1 text-sm leading-6 text-slate-600">{protocol.note}</p></div></div></div><CheckRow checked={insightAccepted} onChange={setInsightAccepted} title={settings.insightsObrigatorios ? "Confirmação obrigatória" : "Confirmar leitura"} detail="Li a orientação e vou conferir produto, bula, receita e protocolo técnico."/><Primary disabled={settings.insightsObrigatorios && !insightAccepted} onClick={() => guarded("seguranca")}>Analisar segurança <ChevronRight size={18}/></Primary></>}

        {view === "seguranca" && <><Step current={4}/><Title icon={<Map/>} title="Segurança e condição real" text="GPS/modelo ajuda a localizar. A liberação usa a medição feita no talhão."/>{modelWeather ? <div className="rounded-3xl overflow-hidden border border-slate-200"><iframe title="Mapa do ponto GPS" className="h-52 w-full" src={`https://www.openstreetmap.org/export/embed.html?bbox=${modelWeather.longitude-.003}%2C${modelWeather.latitude-.003}%2C${modelWeather.longitude+.003}%2C${modelWeather.latitude+.003}&layer=mapnik&marker=${modelWeather.latitude}%2C${modelWeather.longitude}`}/></div> : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">Use o botão flutuante de clima/GPS para capturar o ponto.</div>}
          <div className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"><div><strong>Margem preventiva interna</strong><span className="float-right font-black">{settings.margemPreventiva} m</span></div><div><strong>Distância informada</strong><span className="float-right font-black">{mission.semAreaSensivel ? "Sem área sensível identificada" : mission.distanciaSensivel ? `${mission.distanciaSensivel} m` : "Pendente"}</span></div><p className="text-amber-900">Regra legal por UF/produto continua dependente do motor regulatório; a margem interna não substitui a lei, bula ou RT.</p></div>
          <FormGrid><NumberField label="Distância da área sensível" value={mission.distanciaSensivel} suffix="m" onChange={(v) => updateMission("distanciaSensivel", v)}/><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" checked={mission.semAreaSensivel} onChange={(e) => updateMission("semAreaSensivel", e.target.checked)}/><span>Não identifiquei área sensível próxima aplicável</span></label><NumberField label="Vento medido" value={mission.ventoCampoKmh} suffix="km/h" onChange={(v) => updateMission("ventoCampoKmh", v)}/><TextField label="Direção do vento *" value={mission.direcaoVentoCampo} onChange={(v) => updateMission("direcaoVentoCampo", v)} placeholder="Ex.: NE → SO"/><NumberField label="Temperatura medida *" value={mission.temperaturaCampo} suffix="°C" onChange={(v) => updateMission("temperaturaCampo", v)}/><NumberField label="Umidade medida *" value={mission.umidadeCampo} suffix="%" onChange={(v) => updateMission("umidadeCampo", v)}/></FormGrid>
          <button className={`min-h-11 rounded-xl px-4 font-black ${mission.climaCampoConfirmado ? "bg-emerald-100 text-emerald-800" : "bg-slate-950 text-white"}`} onClick={confirmClimate}>{mission.climaCampoConfirmado ? <span className="inline-flex items-center gap-2"><Check size={18}/> Medição de campo registrada</span> : "Confirmar medição de campo"}</button>
          {modelWeather && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm"><strong>Modelo meteorológico do ponto</strong><p className="mt-1 text-slate-600">{fmt(modelWeather.temperature,1)}°C • UR {fmt(modelWeather.humidity,0)}% • vento 10 m {fmt(modelWeather.windSpeed,1)} km/h • rajada {fmt(modelWeather.windGust,1)} km/h. Compare com a medição local.</p></div>}
          <CheckRow disabled={!mission.climaCampoConfirmado || !sensitiveReady} checked={riskAccepted} onChange={setRiskAccepted} title="Confirmar análise de risco" detail="Só é habilitado depois da medição de campo e da informação sobre área sensível."/>
          <Primary disabled={!safetyReady} onClick={() => go("controle")}>Gerar parâmetros-base <ChevronRight size={18}/></Primary>
        </>}

        {view === "controle" && <><Warning>Parâmetros calculados — ainda não liberados para voo. Faltam calibração, checklist e SARPAS.</Warning><div className="grid grid-cols-2 gap-3"><Metric icon={<Gauge/>} label="Velocidade" value={`${fmt(calc.speedMs, 1)} m/s`} detail={`${fmt(mission.velocidadeKmh,1)} km/h`}/><Metric icon={<Droplets/>} label="Volume" value={`${fmt(mission.volume,1)} L/ha`}/><Metric icon={<Route/>} label="Faixa" value={`${fmt(mission.faixa,1)} m`}/><Metric icon={<Sparkles/>} label="Vazão" value={`${fmt(calc.flowLMin,2)} L/min`}/><Metric icon={<Gauge/>} label="Capacidade teórica" value={`${fmt(calc.haH,1)} ha/h`}/><Metric icon={<TimerReset/>} label="Tempo estimado" value={duration(calc.estimatedHours)}/></div><div className="rounded-2xl border border-slate-200 p-4 text-sm leading-6 text-slate-600"><strong className="text-slate-950">Conferência no controle</strong><br/>Transfira os números somente como base de cálculo. O ajuste final precisa respeitar equipamento, produto, bula, RT e condição real.</div><Primary onClick={() => go("calibracao")}>Ir para calibração <ChevronRight size={18}/></Primary></>}

        {view === "calibracao" && <><Title icon={<Wrench/>} title="Calibração" text="Sequência obrigatória: eliminar ar → fluxômetro → bomba."/><Task index="1" title="Eliminar o ar do sistema" detail="Faça a liberação de ar antes das demais calibrações." checked={calibration.ar} onChange={(v) => setCalibration({ ar: v, fluxometro: v ? calibration.fluxometro : false, bomba: v ? calibration.bomba : false })}/><Task index="2" title="Calibrar o fluxômetro" detail="Só fica disponível após eliminar o ar." checked={calibration.fluxometro} disabled={!calibration.ar} onChange={(v) => setCalibration({ ...calibration, fluxometro: v, bomba: v ? calibration.bomba : false })}/><Task index="3" title="Calibrar a bomba" detail="Última etapa da sequência." checked={calibration.bomba} disabled={!calibration.fluxometro} onChange={(v) => setCalibration({ ...calibration, bomba: v })}/><Primary disabled={!calibrationReady} onClick={() => go("checklist")}>Ir para checklist <ChevronRight size={18}/></Primary></>}

        {view === "checklist" && <><Title icon={<ClipboardCheck/>} title="Checklist pré-voo" text={`${Object.values(checklist).filter(Boolean).length} de 8 itens confirmados.`}/>{([
          ["area","Área e decolagem","Área e ponto de decolagem conferidos."], ["pessoasAnimais","Pessoas e animais","Sem pessoas ou animais expostos."], ["obstaculos","Obstáculos e rede elétrica","Árvores, postes, fios, água e áreas sensíveis conferidos."], ["drone","Drone","Estrutura, motores, hélices, sensores e trem de pouso conferidos."], ["controle","Controle e navegação","Controle, bateria, missão, mapa e conexão conferidos."], ["pulverizacao","Pulverização","Tanque, mangueiras, filtros, atomizadores/bicos, bomba e fluxômetro conferidos."], ["clima","Medição climática","Preenchida automaticamente pela confirmação feita na tela Segurança."], ["documentos","Documentos","Receita/protocolo e documentos/autorizações aplicáveis conferidos."]
        ] as Array<[keyof ChecklistState,string,string]>).map(([key, t, d], i) => <Task key={key} index={String(i+1)} title={t} detail={d} checked={checklist[key]} disabled={key === "clima"} onChange={(v) => setChecklist({ ...checklist, [key]: v })}/>)}<Primary disabled={!checklistReady} onClick={() => go("sarpas")}>Ir para SARPAS <ChevronRight size={18}/></Primary></>}

        {view === "sarpas" && <><Title icon={<ShieldCheck/>} title="SARPAS" text="A autorização/consulta ocorre no sistema oficial. O DroneGestor registra a referência e a conferência do piloto."/><a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 font-black text-white no-underline" href="https://servicos.decea.mil.br/sarpas/?login=1" target="_blank" rel="noreferrer"><Compass size={18}/> Abrir SARPAS oficial</a><label className="grid gap-1 text-sm font-bold text-slate-700"><span>Situação conferida *</span><select className="min-h-11 rounded-xl border border-slate-200 px-3" value={mission.sarpasSituacao} onChange={(e) => updateMission("sarpasSituacao", e.target.value as SarpasStatus)}><option value="">Selecione...</option><option value="autorizado">Autorizado / referência emitida</option><option value="dispensado">Dispensado após conferência oficial aplicável</option><option value="nao_aplicavel">Não aplicável ao caso após conferência</option></select></label>{mission.sarpasSituacao === "autorizado" && <TextField label="Nº / referência SARPAS *" value={mission.sarpasNumero} onChange={(v) => updateMission("sarpasNumero", v)}/>}<CheckRow checked={mission.sarpasConfirmado} onChange={(v) => updateMission("sarpasConfirmado", v)} title="Confirmo que consultei a situação no sistema oficial" detail="Marque somente depois da verificação oficial da operação."/><Warning>O DroneGestor não envia nem aprova solicitações SARPAS automaticamente.</Warning><Primary disabled={!canStart} onClick={startOperation}><Play size={18}/> Iniciar operação</Primary>{!canStart && <p className="text-center text-xs font-semibold text-amber-700">Há alguma validação obrigatória pendente nas etapas anteriores.</p>}</>}

        {view === "execucao" && <><div className="rounded-3xl bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white"><span className="text-xs font-black uppercase tracking-wider">Aplicação em andamento</span><h2 className="mt-1 text-xl font-black">{mission.cultura} • {mission.alvo}</h2><div className="mt-4 flex items-end justify-between"><strong className="text-4xl">{fmt(mission.area > 0 ? Math.min(100, progressHa / mission.area * 100) : 0, 0)}%</strong><span className="text-sm">{fmt(progressHa,1)} de {fmt(mission.area,1)} ha</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white" style={{ width: `${mission.area > 0 ? Math.min(100, progressHa / mission.area * 100) : 0}%` }}/></div></div><div className="grid grid-cols-2 gap-3"><Metric icon={<RotateCcw/>} label="Tanques planejados" value={`${calc.tanks}`}/><Metric icon={<Map/>} label="Área restante" value={`${fmt(Math.max(0, mission.area-progressHa),1)} ha`}/><Metric icon={<TimerReset/>} label="Tempo teórico restante" value={duration(calc.haH > 0 ? Math.max(0, mission.area-progressHa)/calc.haH : 0)}/><Metric icon={<AlertTriangle/>} label="Ocorrências" value={`${occurrences.length}`}/></div><div className="grid grid-cols-2 gap-3"><button className="min-h-12 rounded-xl border border-slate-200 bg-white font-black text-slate-800" onClick={() => setPaused(!paused)}>{paused ? <span className="inline-flex items-center gap-2"><Play size={18}/> Retomar</span> : <span className="inline-flex items-center gap-2"><Pause size={18}/> Pausar</span>}</button><button className="min-h-12 rounded-xl border border-amber-200 bg-amber-50 font-black text-amber-900" onClick={addOccurrence}><AlertTriangle className="mr-2 inline" size={18}/>Ocorrência</button><button className="min-h-12 rounded-xl border border-emerald-200 bg-emerald-50 font-black text-emerald-900 disabled:opacity-40" disabled={paused || areaDone} onClick={finishTank}><Check className="mr-2 inline" size={18}/>Finalizar tanque</button><button className="min-h-12 rounded-xl border border-slate-200 bg-slate-100 font-black text-slate-700" onClick={() => window.print()}><FileText className="mr-2 inline" size={18}/>Imprimir</button></div>{areaDone ? <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4"><strong className="text-emerald-950">100% da área planejada registrada.</strong><p className="mt-1 text-sm text-emerald-800">Agora a conclusão definitiva está liberada.</p></div> : <Warning>A conclusão definitiva permanece bloqueada até o progresso atingir 100% da área planejada.</Warning>}<Primary disabled={!areaDone || !canStart || savingFinal || finalSaved} onClick={() => void finalizeOperation()}>{savingFinal ? "Salvando..." : finalSaved ? "Operação salva" : "Concluir e salvar no histórico"}</Primary></>}

        {view === "relatorios" && <><Title icon={<FileText/>} title="Dados da operação" text="Rascunhos e histórico local da missão atual. O envio oficial continua separado."/><div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-emerald-700"><Check size={18}/><strong>{finalSaved ? "Operação salva no histórico" : pendingCount ? "Há conclusão aguardando sincronização" : "Missão em rascunho"}</strong></div><p className="mt-2 font-black text-slate-950">{mission.cultura || "Sem cultura"} • {fmt(mission.area,1)} ha planejados</p><p className="text-sm text-slate-500">{fmt(progressHa,1)} ha registrados • {occurrences.length} ocorrência(s)</p></div><ReportButton icon={<FileText/>} title="Rascunho da operação" detail="Resumo dos parâmetros e progresso real." onClick={exportDraft}/><ReportButton icon={<FileSpreadsheet/>} title="Dados operacionais CSV" detail="Exportação simples para conferência e consolidação." onClick={exportCsv}/><a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-black text-slate-800 no-underline" href="/apps/dronegestor/historico"><FileText size={18}/> Abrir histórico salvo</a><div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950"><strong>MAPA:</strong> os dados já ficam no banco quando a operação é finalizada. A geração no modelo oficial vigente e o protocolo/envio oficial continuam etapas próprias e não são simulados por este CSV.</div></>}

        {view === "config" && <SettingsPanel settings={settings} canManage={canManage} userType={userType} onSave={(next) => void saveCompanySettings(next)}/>}      
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-3xl grid-cols-5 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur sm:absolute sm:rounded-b-[30px]">
        <Nav icon={<Home/>} label="Início" active={view === "inicio"} onClick={() => go("inicio")}/>
        <Nav icon={<Drone/>} label={operationStarted ? "Retomar" : "Operação"} active={flow.includes(view) && !["seguranca","relatorios"].includes(view)} onClick={() => guarded(resumeView())}/>
        <Nav icon={<Map/>} label="Segurança" active={view === "seguranca"} onClick={() => guarded("seguranca")}/>
        <Nav icon={<FileText/>} label="Dados" active={view === "relatorios"} onClick={() => go("relatorios")}/>
        <Nav icon={<Settings2/>} label="Mais" active={view === "config"} onClick={() => { if (operationStarted) return flash("Configurações bloqueadas durante a execução."); setReturnView(view); go("config"); }}/>
      </nav>
    </div>
  </main>;
}

function SettingsPanel({ settings, canManage, userType, onSave }: { settings: CompanySettings; canManage: boolean; userType: string; onSave: (value: CompanySettings) => void }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const set = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><ShieldCheck className="text-emerald-700"/><strong className="mt-2 block text-lg text-emerald-950">Padrão da empresa</strong><p className="mt-1 text-sm leading-6 text-emerald-800">Perfil atual: {userType}. {canManage ? "Você pode alterar os padrões." : "Somente leitura: piloto/usuário não pode desligar regras da empresa."}</p></div><Toggle label="Insights de campo obrigatórios" checked={draft.insightsObrigatorios} disabled={!canManage} onChange={(v) => set("insightsObrigatorios", v)}/><label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"><span><strong className="block text-sm">Margem preventiva interna</strong><small className="text-slate-500">Padrão interno, não regra legal.</small></span><div className="flex items-center gap-2"><input disabled={!canManage} className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-right" type="number" value={draft.margemPreventiva} onChange={(e) => set("margemPreventiva", Math.max(0, n(e.target.value)))}/><b>m</b></div></label><Toggle label="Exigir confirmação de risco" checked={draft.exigirConfirmacao} disabled={!canManage} onChange={(v) => set("exigirConfirmacao", v)}/><Toggle label="Bordadura para cigarrinha (protocolo interno)" checked={draft.protocoloBordaduraCigarrinha} disabled={!canManage} onChange={(v) => set("protocoloBordaduraCigarrinha", v)}/><div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600"><strong className="text-slate-950">Regra legal por UF/produto</strong><p className="mt-1">Permanece como módulo regulatório versionado. O piloto não edita regra legal.</p></div>{canManage && <Primary onClick={() => onSave(draft)}><Check size={18}/> Salvar padrão da empresa</Primary>}</>;
}

function CardButton({ icon, title, text, onClick, primary = false }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; primary?: boolean }) { return <button className={`flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left ${primary ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`} onClick={onClick}><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${primary ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>{icon}</span><span><strong className="block text-base text-slate-950">{title}</strong><small className="mt-1 block leading-5 text-slate-500">{text}</small></span><ChevronRight className="ml-auto mt-2 shrink-0 text-slate-400" size={18}/></button>; }
function FormGrid({ children }: { children: React.ReactNode }) { return <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">{children}</div>; }
function TextField({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) { return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{label}</span><input className="min-h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}/></label>; }
function NumberField({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (v: number) => void }) { return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{label}</span><div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3"><input className="min-w-0 flex-1 outline-none" type="number" step="any" value={value || ""} onChange={(e) => onChange(n(e.target.value))}/>{suffix && <b className="ml-2 text-xs text-slate-500">{suffix}</b>}</div></label>; }
function Metric({ icon, label, value, detail, dark = false }: { icon: React.ReactNode; label: string; value: string; detail?: string; dark?: boolean }) { return <div className={`rounded-2xl p-4 ${dark ? "bg-white/10" : "border border-slate-200 bg-white"}`}><span className={dark ? "text-emerald-200" : "text-emerald-700"}>{icon}</span><small className={`mt-2 block ${dark ? "text-emerald-100/70" : "text-slate-500"}`}>{label}</small><strong className="mt-1 block text-lg leading-6">{value || "—"}</strong>{detail && <span className={`mt-1 block text-xs ${dark ? "text-emerald-100/70" : "text-slate-500"}`}>{detail}</span>}</div>; }
function Title({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">{icon}</span><div><strong className="text-lg text-slate-950">{title}</strong><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p></div></div>; }
function Warning({ children }: { children: React.ReactNode }) { return <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><AlertTriangle className="mt-0.5 shrink-0" size={19}/><div>{children}</div></div>; }
function Primary({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) { return <button disabled={disabled} onClick={onClick} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{children}</button>; }
function Step({ current }: { current: number }) { return <div className="flex gap-2">{[1,2,3,4].map((step) => <span key={step} className={`grid size-8 place-items-center rounded-full text-xs font-black ${step <= current ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-400"}`}>{step}</span>)}</div>; }
function CheckRow({ checked, onChange, title, detail, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; title: string; detail: string; disabled?: boolean }) { return <label className={`flex items-start gap-3 rounded-2xl border p-4 ${disabled ? "border-slate-200 bg-slate-50 opacity-60" : "border-emerald-200 bg-emerald-50"}`}><input className="mt-1 size-5" type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}/><span><strong className="block text-sm text-slate-950">{title}</strong><small className="mt-1 block leading-5 text-slate-500">{detail}</small></span></label>; }
function Task({ index, title, detail, checked, onChange, disabled = false }: { index: string; title: string; detail: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) { return <label className={`flex items-start gap-3 rounded-2xl border p-4 ${checked ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"} ${disabled ? "opacity-70" : ""}`}><span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-black ${checked ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-500"}`}>{checked ? <Check size={16}/> : index}</span><span className="flex-1"><strong className="block text-sm text-slate-950">{title}</strong><small className="mt-1 block leading-5 text-slate-500">{detail}</small></span><input className="mt-1 size-5" type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}/></label>; }
function ReportButton({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void }) { return <button onClick={onClick} className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left"><span className="text-emerald-700">{icon}</span><span className="flex-1"><strong className="block text-sm text-slate-950">{title}</strong><small className="mt-1 block text-slate-500">{detail}</small></span><Download size={18} className="text-slate-400"/></button>; }
function Nav({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) { return <button onClick={onClick} className={`grid min-h-12 place-items-center rounded-xl text-[10px] font-black ${active ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}><span className="[&>svg]:size-5">{icon}</span><span>{label}</span></button>; }
function Toggle({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) { return <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"><strong className="text-sm text-slate-950">{label}</strong><button disabled={disabled} aria-pressed={checked} onClick={() => onChange(!checked)} className={`relative h-7 w-12 rounded-full ${checked ? "bg-emerald-600" : "bg-slate-300"} disabled:opacity-50`}><span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`}/></button></div>; }
