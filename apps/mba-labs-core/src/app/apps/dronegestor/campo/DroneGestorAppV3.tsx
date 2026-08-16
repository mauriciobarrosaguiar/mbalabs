"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  Check,
  ChevronRight,
  ClipboardCheck,
  CloudAlert,
  CloudSun,
  Drone,
  Droplets,
  FileSpreadsheet,
  FileText,
  Gauge,
  Home,
  LockKeyhole,
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
  Undo2,
  Wind,
  Wrench
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getDroneSyncConflict, snapshotDroneLocalState } from "./DronePersistenceSync";

type View = "inicio" | "nova" | "calda" | "estrategia" | "seguranca" | "controle" | "calibracao" | "checklist" | "sarpas" | "execucao" | "relatorios" | "config";
type DoseUnit = "mL/ha" | "L/ha" | "g/ha" | "kg/ha" | "mL/100L" | "g/100L";
type SarpasStatus = "" | "autorizado";
type MissionStatus = "rascunho" | "preparacao" | "em_execucao" | "pausada" | "pendente_sync" | "finalizada";

type Product = { id: string; nome: string; dose: number; unidade: DoseUnit };
type CalibrationState = { ar: boolean; fluxometro: boolean; bomba: boolean };
type ChecklistState = { area: boolean; pessoasAnimais: boolean; obstaculos: boolean; drone: boolean; controle: boolean; pulverizacao: boolean; clima: boolean; documentos: boolean };
type CompanySettings = { insightsObrigatorios: boolean; margemPreventiva: number; exigirConfirmacao: boolean; protocoloBordaduraCigarrinha: boolean; bloquearMargemPreventiva: boolean };
type ModelWeather = { latitude: number; longitude: number; capturedAt: string; temperature: number; humidity: number; windSpeed: number; windDirection: number; windGust: number; precipitation: number };
type Occurrence = { id: string; at: string; text: string };
type TankRecord = { id: string; at: string; areaHa: number; volumeL: number; note?: string };
type SyncConflict = ReturnType<typeof getDroneSyncConflict>;

type Mission = {
  cultura: string;
  alvo: string;
  tipoAtividade: string;
  area: number;
  drone: string;
  registroAnac: string;
  pontaModelo: string;
  volume: number;
  tanque: number;
  faixa: number;
  velocidadeKmh: number;
  alturaM: number;
  produtos: Product[];
  distanciaSensivel: number | null;
  semAreaSensivel: boolean;
  ventoCampoKmh: number | null;
  direcaoVentoCampo: string;
  temperaturaCampo: number | null;
  umidadeCampo: number | null;
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
  tankRecords: "dronegestor:tankRecords:v4",
  insight: "dronegestor:insightAccepted:v2",
  risk: "dronegestor:riskAccepted:v2",
  view: "dronegestor:view:v3",
  started: "dronegestor:started:v3",
  paused: "dronegestor:paused:v3",
  status: "dronegestor:missionStatus:v4",
  startedAt: "dronegestor:startedAt:v4",
  endedAt: "dronegestor:endedAt:v4",
  operationId: "dronegestor:operationId:v3",
  lastFinalized: "dronegestor:lastFinalizedOperationId:v3",
  finalQueue: "dronegestor:finalizationQueue:v4",
  syncRevision: "dronegestor:syncRevision:v4",
  syncDirty: "dronegestor:syncDirty:v4",
  syncConflict: "dronegestor:syncConflict:v4"
} as const;

const blankMission: Mission = {
  cultura: "", alvo: "", tipoAtividade: "pulverizacao", area: 0, drone: "", registroAnac: "", pontaModelo: "", volume: 0, tanque: 0, faixa: 0, velocidadeKmh: 0, alturaM: 0,
  produtos: [{ id: "produto-1", nome: "", dose: 0, unidade: "mL/ha" }],
  distanciaSensivel: null, semAreaSensivel: false, ventoCampoKmh: null, direcaoVentoCampo: "", temperaturaCampo: null, umidadeCampo: null,
  climaCampoConfirmado: false, climaCampoMedidoEm: "", tempoAbastecimentoMin: 0, tempoTrocaBateriaMin: 0, tanquesPorBateria: 0,
  tempoDeslocamentoMin: 0, tempoBordaduraMin: 0, sarpasNumero: "", sarpasSituacao: "", sarpasConfirmado: false
};
const defaultSettings: CompanySettings = { insightsObrigatorios: true, margemPreventiva: 90, exigirConfirmacao: true, protocoloBordaduraCigarrinha: false, bloquearMargemPreventiva: true };
const blankCalibration: CalibrationState = { ar: false, fluxometro: false, bomba: false };
const blankChecklist: ChecklistState = { area: false, pessoasAnimais: false, obstaculos: false, drone: false, controle: false, pulverizacao: false, clima: false, documentos: false };
const flow: View[] = ["nova", "calda", "estrategia", "seguranca", "controle", "calibracao", "checklist", "sarpas", "execucao", "relatorios"];

function readRaw<T>(key: string, fallback: T): T { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function n(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function nullable(value: unknown) { if (value === null || value === undefined || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function round(value: number, digits = 2) { const f = 10 ** digits; return Math.round(value * f) / f; }
function fmt(value: number | null | undefined, digits = 1) { return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(Number(value)) ? Number(value) : 0); }
function duration(hours: number) { if (!hours || hours <= 0) return "—"; const mins = Math.round(hours * 60); return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`; }
function createId(prefix: string) { return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function normalizeMission(value: Partial<Mission> | null): Mission {
  const source = value ?? {};
  const products = Array.isArray(source.produtos) && source.produtos.length ? source.produtos : blankMission.produtos;
  return {
    ...blankMission,
    ...source,
    registroAnac: String((source as any).registroAnac || (source as any).identificacaoAnac || ""),
    pontaModelo: String((source as any).pontaModelo || (source as any).pontaPulverizacao || ""),
    produtos: products,
    distanciaSensivel: source.semAreaSensivel ? null : nullable(source.distanciaSensivel),
    ventoCampoKmh: source.climaCampoConfirmado ? nullable(source.ventoCampoKmh) : (Number(source.ventoCampoKmh) === 0 ? null : nullable(source.ventoCampoKmh)),
    temperaturaCampo: source.climaCampoConfirmado ? nullable(source.temperaturaCampo) : (Number(source.temperaturaCampo) === 0 ? null : nullable(source.temperaturaCampo)),
    umidadeCampo: source.climaCampoConfirmado ? nullable(source.umidadeCampo) : (Number(source.umidadeCampo) === 0 ? null : nullable(source.umidadeCampo))
  };
}
function humanAmount(value: number, unit: string) { return unit === "mL" && value >= 1000 ? { value: value / 1000, unit: "L" } : unit === "g" && value >= 1000 ? { value: value / 1000, unit: "kg" } : { value, unit }; }
function productAmount(product: Product, area: number, caldaL: number) {
  const dose = n(product.dose); let amount = 0; let unit = "";
  if (product.unidade === "mL/ha") { amount = area * dose; unit = "mL"; }
  if (product.unidade === "L/ha") { amount = area * dose; unit = "L"; }
  if (product.unidade === "g/ha") { amount = area * dose; unit = "g"; }
  if (product.unidade === "kg/ha") { amount = area * dose; unit = "kg"; }
  if (product.unidade === "mL/100L") { amount = caldaL / 100 * dose; unit = "mL"; }
  if (product.unidade === "g/100L") { amount = caldaL / 100 * dose; unit = "g"; }
  return humanAmount(amount, unit);
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

export function DroneGestorAppV3({ userName, userType, canManage }: { userName: string; userType: string; canManage: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>("inicio");
  const [returnView, setReturnView] = useState<View>("inicio");
  const [mission, setMission] = useState<Mission>(blankMission);
  const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
  const [settingsUpdatedAt, setSettingsUpdatedAt] = useState("");
  const [calibration, setCalibration] = useState<CalibrationState>(blankCalibration);
  const [checklist, setChecklist] = useState<ChecklistState>(blankChecklist);
  const [insightAccepted, setInsightAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [progressHa, setProgressHa] = useState(0);
  const [tankRecords, setTankRecords] = useState<TankRecord[]>([]);
  const [tankArea, setTankArea] = useState("");
  const [tankVolume, setTankVolume] = useState("");
  const [operationStarted, setOperationStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [missionStatus, setMissionStatus] = useState<MissionStatus>("rascunho");
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [modelWeather, setModelWeather] = useState<ModelWeather | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [notice, setNotice] = useState("");
  const [savingFinal, setSavingFinal] = useState(false);
  const [finalSaved, setFinalSaved] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncConflict, setSyncConflict] = useState<SyncConflict>(null);

  useEffect(() => {
    const savedMission = normalizeMission(readRaw<Partial<Mission> | null>(KEYS.mission, null));
    const queue = readRaw<PendingFinalization[]>(KEYS.finalQueue, []);
    const opId = localStorage.getItem(KEYS.operationId) || "";
    let status = readRaw<MissionStatus>(KEYS.status, savedMission.ordemServicoId ? "preparacao" : "rascunho");
    const isPending = Boolean(opId && queue.some((item) => item.operationId === opId));
    const isFinalized = Boolean(opId && localStorage.getItem(KEYS.lastFinalized) === opId);
    if (isPending) status = "pendente_sync";
    if (isFinalized) status = "finalizada";

    setMission(savedMission);
    setSettings({ ...defaultSettings, ...readRaw<Partial<CompanySettings>>(KEYS.settings, {}) });
    setCalibration(readRaw(KEYS.calibration, blankCalibration));
    setChecklist(readRaw(KEYS.checklist, blankChecklist));
    setOccurrences(readRaw(KEYS.occurrences, [] as Occurrence[]));
    setProgressHa(n(readRaw(KEYS.progress, 0)));
    setTankRecords(readRaw(KEYS.tankRecords, [] as TankRecord[]));
    setInsightAccepted(Boolean(readRaw(KEYS.insight, false)));
    setRiskAccepted(Boolean(readRaw(KEYS.risk, false)));
    setOperationStarted(Boolean(readRaw(KEYS.started, false)) && !["pendente_sync", "finalizada"].includes(status));
    setPaused(Boolean(readRaw(KEYS.paused, false)));
    setMissionStatus(status);
    setStartedAt(readRaw(KEYS.startedAt, ""));
    setEndedAt(readRaw(KEYS.endedAt, ""));
    setModelWeather(readRaw(KEYS.weather, null as ModelWeather | null));
    setPendingCount(queue.length);
    setSyncConflict(getDroneSyncConflict());
    setFinalSaved(isFinalized);
    const savedView = localStorage.getItem(KEYS.view) as View | null;
    if (savedView && ["inicio", ...flow, "config"].includes(savedView)) setView(savedView);
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
    localStorage.setItem(KEYS.tankRecords, JSON.stringify(tankRecords));
    localStorage.setItem(KEYS.insight, JSON.stringify(insightAccepted));
    localStorage.setItem(KEYS.risk, JSON.stringify(riskAccepted));
    localStorage.setItem(KEYS.started, JSON.stringify(operationStarted));
    localStorage.setItem(KEYS.paused, JSON.stringify(paused));
    localStorage.setItem(KEYS.status, JSON.stringify(missionStatus));
    localStorage.setItem(KEYS.startedAt, JSON.stringify(startedAt));
    localStorage.setItem(KEYS.endedAt, JSON.stringify(endedAt));
    localStorage.setItem(KEYS.view, view);
  }, [hydrated, mission, settings, calibration, checklist, occurrences, progressHa, tankRecords, insightAccepted, riskAccepted, operationStarted, paused, missionStatus, startedAt, endedAt, view]);

  async function loadCompanySettings() {
    try {
      const response = await fetch("/api/dronegestor/config", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.settings) return null;
      const next = { ...defaultSettings, ...payload.settings } as CompanySettings;
      setSettings(next);
      setSettingsUpdatedAt(String(payload.updatedAt || ""));
      return { settings: next, updatedAt: String(payload.updatedAt || "") };
    } catch { return null; }
  }

  useEffect(() => { if (hydrated) void loadCompanySettings(); }, [hydrated]);
  useEffect(() => {
    const onWeather = (event: Event) => { const detail = (event as CustomEvent<ModelWeather>).detail; if (detail) setModelWeather(detail); };
    const onSarpas = (event: Event) => { const detail = (event as CustomEvent<Partial<Mission>>).detail; if (detail) setMission(normalizeMission(detail)); };
    const onConflict = () => setSyncConflict(getDroneSyncConflict());
    window.addEventListener("dronegestor:weather-updated", onWeather);
    window.addEventListener("dronegestor:sarpas-updated", onSarpas);
    window.addEventListener("dronegestor:sync-conflict", onConflict);
    return () => { window.removeEventListener("dronegestor:weather-updated", onWeather); window.removeEventListener("dronegestor:sarpas-updated", onSarpas); window.removeEventListener("dronegestor:sync-conflict", onConflict); };
  }, []);

  const calc = useMemo(() => {
    const totalCalda = mission.area > 0 && mission.volume > 0 ? mission.area * mission.volume : 0;
    const areaTank = mission.volume > 0 && mission.tanque > 0 ? mission.tanque / mission.volume : 0;
    const exactTanks = mission.tanque > 0 ? totalCalda / mission.tanque : 0;
    const tanks = exactTanks > 0 ? Math.ceil(exactTanks) : 0;
    const wholeTanks = Math.floor(exactTanks);
    const lastTank = tanks ? totalCalda - wholeTanks * mission.tanque : 0;
    const lastTankVolume = lastTank > 0.001 ? lastTank : (tanks ? mission.tanque : 0);
    const lastArea = mission.volume > 0 ? lastTankVolume / mission.volume : 0;
    const speedMs = mission.velocidadeKmh > 0 ? mission.velocidadeKmh / 3.6 : 0;
    const flowLMin = mission.volume > 0 && mission.velocidadeKmh > 0 && mission.faixa > 0 ? mission.volume * mission.velocidadeKmh * mission.faixa / 600 : 0;
    const haH = mission.velocidadeKmh > 0 && mission.faixa > 0 ? mission.velocidadeKmh * mission.faixa / 10 : 0;
    const sprayHours = haH > 0 ? mission.area / haH : 0;
    const refills = Math.max(0, tanks - 1);
    const batteryChanges = mission.tanquesPorBateria > 0 && tanks > 0 ? Math.floor((tanks - 1) / mission.tanquesPorBateria) : 0;
    const stopsMin = refills * Math.max(0, mission.tempoAbastecimentoMin) + batteryChanges * Math.max(0, mission.tempoTrocaBateriaMin) + Math.max(0, mission.tempoDeslocamentoMin) + Math.max(0, mission.tempoBordaduraMin);
    const estimatedHours = sprayHours > 0 ? sprayHours + stopsMin / 60 : 0;
    const products = mission.produtos.map((product) => ({
      product,
      total: productAmount(product, mission.area, totalCalda),
      fullTank: productAmount(product, areaTank, mission.tanque),
      lastTank: productAmount(product, lastArea, lastTankVolume)
    }));
    const actualVolume = tankRecords.reduce((sum, item) => sum + item.volumeL, 0);
    return { totalCalda, areaTank, tanks, lastTankVolume, speedMs, flowLMin, haH, sprayHours, stopsMin, estimatedHours, products, actualVolume };
  }, [mission, tankRecords]);

  const protocol = useMemo(() => protocolFor(mission.alvo, settings), [mission.alvo, settings]);
  const productsReady = mission.produtos.length > 0 && mission.produtos.every((p) => p.nome.trim() && p.dose > 0 && p.unidade);
  const missionReady = Boolean(mission.cultura.trim() && mission.alvo.trim() && mission.tipoAtividade && mission.drone.trim() && mission.registroAnac.trim() && mission.pontaModelo.trim() && mission.area > 0 && mission.volume > 0 && mission.tanque > 0 && mission.faixa > 0 && mission.velocidadeKmh > 0 && mission.alturaM > 0 && productsReady);
  const sensitiveReady = mission.semAreaSensivel || (mission.distanciaSensivel !== null && mission.distanciaSensivel > 0);
  const marginBlocked = Boolean(settings.bloquearMargemPreventiva && !mission.semAreaSensivel && mission.distanciaSensivel !== null && mission.distanciaSensivel < settings.margemPreventiva);
  const weatherReady = Boolean(mission.climaCampoConfirmado && mission.climaCampoMedidoEm && mission.direcaoVentoCampo.trim() && mission.ventoCampoKmh !== null && mission.ventoCampoKmh >= 0 && mission.ventoCampoKmh <= 100 && mission.temperaturaCampo !== null && mission.temperaturaCampo >= -20 && mission.temperaturaCampo <= 60 && mission.umidadeCampo !== null && mission.umidadeCampo > 0 && mission.umidadeCampo <= 100);
  const safetyReady = Boolean(sensitiveReady && !marginBlocked && weatherReady && (!settings.insightsObrigatorios || insightAccepted) && (!settings.exigirConfirmacao || riskAccepted));
  const calibrationReady = calibration.ar && calibration.fluxometro && calibration.bomba;
  const checklistReady = Object.values(checklist).every(Boolean);
  const sarpasReady = mission.sarpasConfirmado && mission.sarpasSituacao === "autorizado" && mission.sarpasNumero.trim().length > 0;
  const gpsReady = Boolean(modelWeather && Number.isFinite(modelWeather.latitude) && Number.isFinite(modelWeather.longitude));
  const locked = operationStarted || ["pendente_sync", "finalizada"].includes(missionStatus);
  const canStart = missionReady && safetyReady && calibrationReady && checklistReady && sarpasReady && gpsReady && !syncConflict && !["pendente_sync", "finalizada"].includes(missionStatus);
  const areaDone = mission.area > 0 && progressHa >= mission.area - 0.01;

  function flash(text: string) { setNotice(text); window.setTimeout(() => setNotice(""), 4200); }
  function go(next: View) { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function resumeView(): View {
    if (["pendente_sync", "finalizada"].includes(missionStatus)) return "relatorios";
    if (operationStarted) return "execucao";
    if (!missionReady) return "nova";
    if (!insightAccepted && settings.insightsObrigatorios) return "estrategia";
    if (!safetyReady) return "seguranca";
    if (!calibrationReady) return "calibracao";
    if (!checklistReady) return "checklist";
    if (!sarpasReady || !gpsReady) return "sarpas";
    return "sarpas";
  }
  function guarded(target: View) {
    if (["pendente_sync", "finalizada"].includes(missionStatus) && !["inicio", "relatorios"].includes(target)) return go("relatorios");
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
    if (view === "inicio") return;
    if (view === "config") return go(returnView);
    if (view === "execucao" && operationStarted) return go("inicio");
    if (view === "relatorios") return go("inicio");
    const index = flow.indexOf(view);
    go(index <= 0 ? "inicio" : flow[index - 1]);
  }
  function invalidateCore() {
    setInsightAccepted(false); setRiskAccepted(false); setCalibration(blankCalibration); setChecklist(blankChecklist);
    setMission((current) => ({ ...current, sarpasConfirmado: false, sarpasSituacao: "", sarpasNumero: "" }));
  }
  function updateMission<K extends keyof Mission>(key: K, value: Mission[K]) {
    if (locked) return flash("Esta missão está bloqueada. Operações em execução, pendentes ou finalizadas não podem ter parâmetros alterados.");
    const coreKeys: Array<keyof Mission> = ["cultura", "alvo", "tipoAtividade", "area", "drone", "registroAnac", "pontaModelo", "volume", "tanque", "faixa", "velocidadeKmh", "alturaM"];
    const safetyKeys: Array<keyof Mission> = ["distanciaSensivel", "semAreaSensivel", "ventoCampoKmh", "direcaoVentoCampo", "temperaturaCampo", "umidadeCampo"];
    setMission((current) => {
      const next = { ...current, [key]: value } as Mission;
      if (key === "semAreaSensivel" && value === true) next.distanciaSensivel = null;
      if (safetyKeys.includes(key)) { next.climaCampoConfirmado = false; next.climaCampoMedidoEm = ""; }
      if (coreKeys.includes(key)) { next.sarpasConfirmado = false; next.sarpasSituacao = ""; next.sarpasNumero = ""; }
      return next;
    });
    if (coreKeys.includes(key)) { setInsightAccepted(false); setRiskAccepted(false); setCalibration(blankCalibration); setChecklist(blankChecklist); }
    if (safetyKeys.includes(key)) { setRiskAccepted(false); setChecklist((current) => ({ ...current, clima: false })); }
  }
  function updateProduct(id: string, patch: Partial<Product>) {
    if (locked) return flash("Produtos não podem ser alterados nesta fase da missão.");
    setMission((current) => ({ ...current, produtos: current.produtos.map((p) => p.id === id ? { ...p, ...patch } : p), sarpasConfirmado: false, sarpasSituacao: "", sarpasNumero: "" }));
    setInsightAccepted(false); setRiskAccepted(false); setCalibration(blankCalibration); setChecklist(blankChecklist);
  }
  function addProduct() { if (locked) return; setMission((current) => ({ ...current, produtos: [...current.produtos, { id: createId("produto"), nome: "", dose: 0, unidade: "mL/ha" }] })); invalidateCore(); }
  function removeProduct(id: string) { if (locked) return; if (mission.produtos.length <= 1) return flash("Mantenha ao menos um produto na aplicação."); setMission((current) => ({ ...current, produtos: current.produtos.filter((p) => p.id !== id) })); invalidateCore(); }
  function confirmClimate() {
    if (mission.ventoCampoKmh === null || !mission.direcaoVentoCampo.trim() || mission.temperaturaCampo === null || mission.umidadeCampo === null) return flash("Informe vento, direção, temperatura e umidade medidos no talhão.");
    if (mission.ventoCampoKmh < 0 || mission.ventoCampoKmh > 100) return flash("Confira a velocidade do vento informada.");
    if (mission.temperaturaCampo < -20 || mission.temperaturaCampo > 60) return flash("Confira a temperatura informada.");
    if (mission.umidadeCampo <= 0 || mission.umidadeCampo > 100) return flash("A umidade relativa deve estar entre 1% e 100%.");
    if (!sensitiveReady) return flash("Informe a distância da área sensível ou marque que não há área sensível aplicável identificada.");
    if (marginBlocked) return flash(`BLOQUEIO INTERNO: ${fmt(mission.distanciaSensivel, 1)} m está dentro da margem preventiva de ${fmt(settings.margemPreventiva, 1)} m.`);
    setMission((current) => ({ ...current, climaCampoConfirmado: true, climaCampoMedidoEm: new Date().toISOString() }));
    setChecklist((current) => ({ ...current, clima: true })); setRiskAccepted(false);
    flash("Medição de campo registrada. Faça a confirmação final de risco.");
  }
  function resetMission() {
    if (operationStarted) return flash("Existe uma operação em andamento. Conclua ou trate a ocorrência antes de iniciar outra missão.");
    if (!window.confirm("Limpar a missão atual e iniciar uma nova aplicação? Conclusões offline pendentes continuarão protegidas.")) return;
    setMission(blankMission); setCalibration(blankCalibration); setChecklist(blankChecklist); setInsightAccepted(false); setRiskAccepted(false); setProgressHa(0); setTankRecords([]); setPaused(false); setOccurrences([]); setFinalSaved(false); setMissionStatus("rascunho"); setStartedAt(""); setEndedAt("");
    localStorage.removeItem(KEYS.operationId); localStorage.removeItem(KEYS.lastFinalized); go("nova");
  }

  async function patchOs(status: "em_execucao" | "concluida") {
    if (!mission.ordemServicoId) return true;
    const preflightSnapshot = { mission, calibration, checklist, weather: modelWeather, riskAccepted, insightAccepted };
    const response = await fetch("/api/dronegestor/cadastros", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "os", entityId: mission.ordemServicoId, data: { status }, preflightSnapshot }), cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "Não foi possível atualizar a OS.");
    return true;
  }

  async function startOperation() {
    if (["pendente_sync", "finalizada"].includes(missionStatus)) return flash("Esta missão já foi concluída e não pode ser reiniciada.");
    if (syncConflict) return flash("Resolva o conflito de sincronização antes de iniciar a operação.");
    const previousSettingsAt = settingsUpdatedAt;
    const fresh = await loadCompanySettings();
    if (fresh && previousSettingsAt && fresh.updatedAt !== previousSettingsAt) {
      setRiskAccepted(false); setChecklist((current) => ({ ...current, clima: false }));
      return flash("O padrão da empresa foi atualizado. Revise Segurança e Checklist antes de iniciar.");
    }
    if (!canStart) return flash("Ainda existem etapas obrigatórias pendentes. Verifique também o GPS e a margem preventiva interna.");
    try { await patchOs("em_execucao"); } catch (error) { return flash(error instanceof Error ? error.message : "Não foi possível iniciar a OS."); }
    let id = localStorage.getItem(KEYS.operationId) || "";
    if (!id) { id = createId("op"); localStorage.setItem(KEYS.operationId, id); }
    const now = new Date().toISOString();
    setStartedAt(now); setEndedAt(""); setOperationStarted(true); setPaused(false); setMissionStatus("em_execucao"); setFinalSaved(false); go("execucao");
  }
  function togglePause() {
    if (!operationStarted) return;
    const next = !paused; setPaused(next); setMissionStatus(next ? "pausada" : "em_execucao");
  }
  function registerTank() {
    if (!operationStarted || paused) return flash("Retome a operação antes de registrar um abastecimento.");
    const area = n(tankArea); const volume = n(tankVolume); const remaining = Math.max(0, mission.area - progressHa);
    if (area <= 0 || volume <= 0) return flash("Informe a área realmente tratada e o volume realmente consumido neste abastecimento.");
    if (area > remaining + 0.01) return flash(`A área informada excede os ${fmt(remaining, 2)} ha restantes.`);
    if (mission.tanque > 0 && volume > mission.tanque + 0.01) return flash("O volume informado excede a capacidade cadastrada do tanque. Confira o valor.");
    const record: TankRecord = { id: createId("tanque"), at: new Date().toISOString(), areaHa: round(area, 3), volumeL: round(volume, 2) };
    setTankRecords((current) => [...current, record]); setProgressHa((current) => round(Math.min(mission.area, current + area), 3)); setTankArea(""); setTankVolume("");
    flash(area >= remaining - 0.01 ? "Área planejada atingida. Confira e conclua a operação." : "Abastecimento registrado com área e volume reais.");
  }
  function undoLastTank() {
    if (!operationStarted || paused || !tankRecords.length) return;
    const last = tankRecords[tankRecords.length - 1];
    if (!window.confirm(`Desfazer o último registro de ${fmt(last.areaHa, 2)} ha / ${fmt(last.volumeL, 1)} L?`)) return;
    setTankRecords((current) => current.slice(0, -1)); setProgressHa((current) => round(Math.max(0, current - last.areaHa), 3));
  }
  function addOccurrence() {
    const text = window.prompt("Descreva a ocorrência observada em campo:"); if (!text?.trim()) return;
    setOccurrences((current) => [...current, { id: createId("oc"), at: new Date().toISOString(), text: text.trim() }]); flash("Ocorrência registrada.");
  }

  async function sendFinalization(payload: PendingFinalization) {
    const response = await fetch("/api/dronegestor/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: payload.state, operationId: payload.operationId, pilotName: payload.pilotName }), cache: "no-store", keepalive: true });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || "Não foi possível registrar a operação.");
    if (payload.ordemServicoId && data?.osConcluida !== true) throw new Error("A operação foi registrada, mas a confirmação da OS não foi concluída.");
    return data;
  }
  async function retryQueue() {
    if (!navigator.onLine) return;
    const queue = readRaw<PendingFinalization[]>(KEYS.finalQueue, []); if (!queue.length) { setPendingCount(0); return; }
    const remaining: PendingFinalization[] = [];
    for (const item of queue) {
      try {
        await sendFinalization(item); localStorage.setItem(KEYS.lastFinalized, item.operationId);
        if (localStorage.getItem(KEYS.operationId) === item.operationId) { localStorage.setItem(KEYS.status, JSON.stringify("finalizada")); setMissionStatus("finalizada"); setFinalSaved(true); }
      } catch { remaining.push(item); }
    }
    localStorage.setItem(KEYS.finalQueue, JSON.stringify(remaining)); setPendingCount(remaining.length);
  }
  useEffect(() => {
    if (!hydrated) return; void retryQueue();
    const online = () => void retryQueue(); window.addEventListener("online", online); return () => window.removeEventListener("online", online);
  }, [hydrated]);

  async function finalizeOperation() {
    if (!operationStarted || !areaDone || !canStart || savingFinal || finalSaved) return flash("A conclusão só é liberada depois de 100% da área real registrada e de todas as validações obrigatórias.");
    if (!window.confirm(`Confirmar conclusão de ${fmt(progressHa, 2)} ha registrados e salvar definitivamente no histórico?`)) return;
    const operationId = localStorage.getItem(KEYS.operationId) || createId("op"); localStorage.setItem(KEYS.operationId, operationId);
    const end = new Date().toISOString(); setEndedAt(end);
    const state = snapshotDroneLocalState({
      mission,
      progressHa,
      tankRecords,
      insightAccepted,
      riskAccepted,
      calibration,
      checklist,
      occurrences,
      weather: modelWeather,
      operationStarted: false,
      paused: false,
      missionStatus: "pendente_sync",
      startedAt,
      endedAt: end
    } as any) as Record<string, unknown>;
    state.concluida = true; state.concluidaNoDispositivoEm = end; state.operationId = operationId;
    const payload: PendingFinalization = { operationId, pilotName: userName, state, requestedAt: end, ordemServicoId: mission.ordemServicoId };

    if (!navigator.onLine) {
      const queue = readRaw<PendingFinalization[]>(KEYS.finalQueue, []); if (!queue.some((item) => item.operationId === operationId)) localStorage.setItem(KEYS.finalQueue, JSON.stringify([...queue, payload]));
      setPendingCount(queue.some((item) => item.operationId === operationId) ? queue.length : queue.length + 1); setOperationStarted(false); setPaused(false); setMissionStatus("pendente_sync"); setFinalSaved(false); go("relatorios");
      return flash("Sem internet. A missão foi congelada e ficou protegida na fila para sincronização.");
    }

    setSavingFinal(true);
    try {
      await sendFinalization(payload); localStorage.setItem(KEYS.lastFinalized, operationId); setFinalSaved(true); setOperationStarted(false); setPaused(false); setMissionStatus("finalizada"); go("relatorios"); flash("Operação e OS concluídas e salvas no histórico.");
    } catch (error) {
      const queue = readRaw<PendingFinalization[]>(KEYS.finalQueue, []); if (!queue.some((item) => item.operationId === operationId)) localStorage.setItem(KEYS.finalQueue, JSON.stringify([...queue, payload]));
      setPendingCount(queue.some((item) => item.operationId === operationId) ? queue.length : queue.length + 1); setOperationStarted(false); setPaused(false); setMissionStatus("pendente_sync"); go("relatorios");
      flash(error instanceof Error ? `${error.message} A missão ficou congelada e protegida para nova tentativa.` : "Conclusão pendente de sincronização.");
    } finally { setSavingFinal(false); }
  }

  function resolveConflict(mode: "cloud" | "local") {
    const conflict = getDroneSyncConflict(); if (!conflict) return setSyncConflict(null);
    if (!window.confirm(mode === "cloud" ? "Usar a cópia da nuvem neste aparelho? O estado local divergente será substituído." : "Manter a cópia deste aparelho e torná-la a próxima versão da nuvem?")) return;
    if (mode === "cloud" && conflict.remoteState) {
      const map: Record<string, string> = { mission: KEYS.mission, settings: KEYS.settings, calibration: KEYS.calibration, checklist: KEYS.checklist, occurrences: KEYS.occurrences, weather: KEYS.weather, progressHa: KEYS.progress, tankRecords: KEYS.tankRecords, insightAccepted: KEYS.insight, riskAccepted: KEYS.risk, currentView: KEYS.view, operationStarted: KEYS.started, paused: KEYS.paused, missionStatus: KEYS.status, startedAt: KEYS.startedAt, endedAt: KEYS.endedAt };
      for (const [name, key] of Object.entries(map)) if (name in conflict.remoteState) localStorage.setItem(key, JSON.stringify((conflict.remoteState as Record<string, unknown>)[name]));
      localStorage.setItem(KEYS.syncRevision, String(conflict.remoteRevision)); localStorage.setItem(KEYS.syncDirty, "0");
    } else {
      localStorage.setItem(KEYS.syncRevision, String(conflict.remoteRevision)); localStorage.setItem(KEYS.syncDirty, "1");
    }
    localStorage.removeItem(KEYS.syncConflict); window.location.reload();
  }

  async function saveCompanySettings(next: CompanySettings) {
    if (!canManage) return flash("Somente ADMIN/RT pode alterar os padrões da empresa.");
    const response = await fetch("/api/dronegestor/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: next }), cache: "no-store" });
    const payload = await response.json().catch(() => null); if (!response.ok) return flash(payload?.error || "Não foi possível salvar a configuração.");
    setSettings(next); setSettingsUpdatedAt(String(payload.updatedAt || "")); setInsightAccepted(false); setRiskAccepted(false); setChecklist((current) => ({ ...current, clima: false })); flash("Padrão da empresa salvo. Missões em preparação devem revisar Segurança.");
  }

  function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
  function exportDraft() {
    const lines = ["DRONEGESTOR AGRO - RASCUNHO DA OPERAÇÃO", "Não substitui envio oficial, receituário, bula, mapa ou RT.", "", `OS: ${mission.ordemServicoNumero || "—"}`, `Cliente: ${mission.clienteNome || "—"}`, `Fazenda/Talhão: ${[mission.fazendaNome, mission.talhaoNome].filter(Boolean).join(" / ") || "—"}`, `Atividade: ${mission.tipoAtividade}`, `Cultura: ${mission.cultura}`, `Alvo: ${mission.alvo}`, `Área planejada: ${mission.area} ha`, `Área real registrada: ${progressHa} ha`, `Drone: ${mission.drone}`, `Registro ANAC: ${mission.registroAnac}`, `Bico/atomizador: ${mission.pontaModelo}`, `Início: ${startedAt || "—"}`, `Término: ${endedAt || "—"}`, `Volume planejado: ${mission.volume} L/ha`, `Calda real registrada: ${round(calc.actualVolume, 1)} L`, `Velocidade: ${round(calc.speedMs, 2)} m/s`, `Faixa: ${mission.faixa} m`, `Vazão: ${round(calc.flowLMin, 2)} L/min`, `Altura: ${mission.alturaM} m`, `Vento campo: ${mission.ventoCampoKmh ?? "—"} km/h ${mission.direcaoVentoCampo}`, `Temperatura: ${mission.temperaturaCampo ?? "—"} °C`, `UR: ${mission.umidadeCampo ?? "—"}%`, `SARPAS: ${mission.sarpasSituacao} ${mission.sarpasNumero}`, `Ocorrências: ${occurrences.length}`];
    downloadText("dronegestor-rascunho.txt", lines.join("\n"));
  }
  function exportCsv() {
    const header = "data;os;cliente;fazenda;talhao;atividade;cultura;alvo;area_planejada_ha;area_real_ha;drone;registro_anac;ponta_atomizador;volume_planejado_l_ha;calda_real_l;velocidade_kmh;faixa_m;vazao_l_min;vento_kmh;direcao_vento;temperatura_c;umidade_pct;sarpas;inicio;termino";
    const row = [new Date().toLocaleDateString("pt-BR"), mission.ordemServicoNumero || "", mission.clienteNome || "", mission.fazendaNome || "", mission.talhaoNome || "", mission.tipoAtividade, mission.cultura, mission.alvo, mission.area, progressHa, mission.drone, mission.registroAnac, mission.pontaModelo, mission.volume, round(calc.actualVolume, 1), mission.velocidadeKmh, mission.faixa, round(calc.flowLMin, 2), mission.ventoCampoKmh ?? "", mission.direcaoVentoCampo, mission.temperaturaCampo ?? "", mission.umidadeCampo ?? "", mission.sarpasNumero, startedAt, endedAt].join(";");
    downloadText("dronegestor-dados-operacionais.csv", `${header}\n${row}`, "text/csv;charset=utf-8");
  }

  const title: Record<View, string> = { inicio: "Copiloto de aplicação", nova: "Dados da aplicação", calda: "Cálculo de calda", estrategia: "Estratégia e insight", seguranca: "Mapa e segurança", controle: "Parâmetros do controle", calibracao: "Calibração", checklist: "Checklist pré-voo", sarpas: "SARPAS", execucao: "Operação em andamento", relatorios: "Dados e relatórios", config: "Configurações da empresa" };
  const activeMission = mission.area > 0 && !["finalizada", "pendente_sync"].includes(missionStatus);

  if (!hydrated) return <main className="min-h-screen bg-emerald-950 grid place-items-center text-emerald-100"><div className="rounded-2xl border border-emerald-700 bg-emerald-900/70 px-5 py-4 font-bold">Carregando DroneGestor...</div></main>;

  return <main className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,rgba(16,185,129,.18),transparent_24%),linear-gradient(180deg,#052e16_0%,#064e3b_22%,#f8fafc_22%,#f8fafc_100%)] px-3 py-4 sm:px-5 sm:py-7">
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[30px] border border-emerald-200/60 bg-white shadow-2xl shadow-emerald-950/20">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-emerald-100 bg-white/95 px-4 py-3 backdrop-blur">
        <button className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" onClick={back} aria-label="Voltar">{view === "inicio" ? <Home size={20}/> : <ArrowLeft size={20}/>}</button>
        <div className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black uppercase tracking-[.12em] text-emerald-700">{view === "inicio" ? `Olá, ${userName.split(" ")[0]}` : "DroneGestor Agro"}</span><strong className="block truncate text-base font-black text-slate-950">{title[view]}</strong></div>
        <button className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" onClick={() => { if (locked) return flash("Configurações ficam bloqueadas durante/após a execução desta missão."); setReturnView(view); go("config"); }} aria-label="Configurações"><Settings2 size={20}/></button>
      </header>

      {syncConflict && <div className="mx-4 mt-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-950"><div className="flex gap-2"><CloudAlert size={20}/><div><strong>Conflito de sincronização protegido</strong><p className="mt-1">A nuvem e este aparelho possuem versões diferentes. Nada foi sobrescrito.</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button className="rounded-xl border border-red-200 bg-white px-3 py-2 font-black" onClick={() => resolveConflict("cloud")}>Usar nuvem</button><button className="rounded-xl bg-red-700 px-3 py-2 font-black text-white" onClick={() => resolveConflict("local")}>Manter aparelho</button></div></div>}
      {pendingCount > 0 && <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{pendingCount} conclusão(ões) protegida(s) aguardando sincronização.</div>}
      {notice && <div className="mx-4 mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">{notice}</div>}

      <div className="grid gap-4 p-4 pb-24 sm:p-6 sm:pb-24">
        {view === "inicio" && <>
          <div className="grid grid-cols-2 gap-3 rounded-3xl bg-gradient-to-br from-emerald-950 to-emerald-800 p-4 text-white"><Metric icon={<CloudSun size={20}/>} label="Modelo meteorológico" value={modelWeather ? `${fmt(modelWeather.temperature,1)}°C` : "—"} detail="Referência, não anemômetro" dark/><Metric icon={<Wind size={20}/>} label="Vento modelo 10 m" value={modelWeather ? `${fmt(modelWeather.windSpeed,1)} km/h` : "—"} detail="Compare no talhão" dark/></div>
          {mission.ordemServicoId && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><strong className="text-emerald-950">{mission.ordemServicoNumero || "OS vinculada"}</strong><p className="mt-1 text-sm text-emerald-800">{[mission.clienteNome, mission.fazendaNome, mission.talhaoNome].filter(Boolean).join(" • ")}</p><small className="mt-1 block font-bold uppercase text-emerald-700">Status: {missionStatus.replaceAll("_", " ")}</small></div>}
          <CardButton icon={missionStatus === "finalizada" ? <Check/> : missionStatus === "pendente_sync" ? <LockKeyhole/> : <ClipboardCheck/>} title={missionStatus === "finalizada" ? "Operação finalizada" : missionStatus === "pendente_sync" ? "Conclusão aguardando sincronização" : activeMission ? "Retomar missão" : "Nova operação"} text={missionStatus === "finalizada" ? "Consulta e exportação disponíveis; esta missão não pode ser reiniciada." : missionStatus === "pendente_sync" ? "A missão está congelada até a conclusão ser confirmada na nuvem." : activeMission ? `${fmt(mission.area,1)} ha • ${mission.cultura || "cultura pendente"} • ${mission.alvo || "alvo pendente"}` : "Comece pelos dados reais da aplicação."} onClick={() => guarded(resumeView())} primary/>
          <div className="grid gap-3 sm:grid-cols-2"><CardButton icon={<Droplets/>} title="Calcular calda" text="Somente após dados obrigatórios completos." onClick={() => guarded("calda")}/><CardButton icon={<Map/>} title="Segurança" text="GPS, área sensível, medição de campo e margem preventiva." onClick={() => guarded("seguranca")}/><CardButton icon={<FileText/>} title="Dados / rascunho" text="Consulta e exportação; não substitui documento oficial." onClick={() => go("relatorios")}/><CardButton icon={<RotateCcw/>} title="Nova aplicação" text="Conclusões offline permanecem protegidas." onClick={resetMission}/></div>
          <div className="grid gap-2 sm:grid-cols-2"><a className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-800 no-underline" href="/apps/dronegestor/gestao">Clientes e OS</a><a className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-800 no-underline" href="/apps/dronegestor/historico">Histórico</a></div>
        </>}

        {view === "nova" && <><Step current={1}/><Title icon={<Sprout/>} title="Dados da aplicação" text="Alterações técnicas invalidam confirmações dependentes."/>{mission.ordemServicoId && <Info>{mission.ordemServicoNumero} • {[mission.clienteNome,mission.fazendaNome,mission.talhaoNome].filter(Boolean).join(" • ")}</Info>}<FormGrid><SelectField label="Tipo de atividade *" value={mission.tipoAtividade} onChange={(v) => updateMission("tipoAtividade", v)} options={["pulverizacao|Pulverização","dispersao|Dispersão / semeadura","outro|Outro"]}/><TextField label="Cultura *" value={mission.cultura} onChange={(v) => updateMission("cultura",v)}/><TextField label="Alvo *" value={mission.alvo} onChange={(v) => updateMission("alvo",v)}/><NumberField label="Área *" value={mission.area} suffix="ha" onChange={(v) => updateMission("area",v)}/><TextField label="Drone *" value={mission.drone} onChange={(v) => updateMission("drone",v)}/><TextField label="Identificação / registro ANAC *" value={mission.registroAnac} onChange={(v) => updateMission("registroAnac",v)}/><TextField label="Bico / atomizador — tipo/modelo *" value={mission.pontaModelo} onChange={(v) => updateMission("pontaModelo",v)}/><NumberField label="Volume *" value={mission.volume} suffix="L/ha" onChange={(v) => updateMission("volume",v)}/><NumberField label="Tanque *" value={mission.tanque} suffix="L" onChange={(v) => updateMission("tanque",v)}/><NumberField label="Faixa *" value={mission.faixa} suffix="m" onChange={(v) => updateMission("faixa",v)}/><NumberField label="Velocidade *" value={mission.velocidadeKmh} suffix="km/h" onChange={(v) => updateMission("velocidadeKmh",v)}/><NumberField label="Altura planejada *" value={mission.alturaM} suffix="m" onChange={(v) => updateMission("alturaM",v)}/></FormGrid><Title icon={<Droplets/>} title="Produto / receita" text="Todos os produtos adicionados precisam estar completos."/>{mission.produtos.map((p,index)=><div key={p.id} className="grid gap-3 rounded-2xl border border-slate-200 p-4"><div className="flex justify-between"><strong>Produto {index+1}</strong>{mission.produtos.length>1&&<button className="text-sm font-bold text-red-600" onClick={()=>removeProduct(p.id)}>Remover</button>}</div><TextField label="Nome comercial *" value={p.nome} onChange={(v)=>updateProduct(p.id,{nome:v})}/><div className="grid grid-cols-[1fr_140px] gap-2"><NumberField label="Dose *" value={p.dose} suffix="" onChange={(v)=>updateProduct(p.id,{dose:v})}/><SelectField label="Unidade" value={p.unidade} onChange={(v)=>updateProduct(p.id,{unidade:v as DoseUnit})} options={["mL/ha|mL/ha","L/ha|L/ha","g/ha|g/ha","kg/ha|kg/ha","mL/100L|mL/100L","g/100L|g/100L"]}/></div></div>)}<button className="min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-4 font-black text-emerald-800" onClick={addProduct}>+ Adicionar produto</button><Title icon={<TimerReset/>} title="Tempos operacionais" text="Opcionais; melhoram a estimativa de duração."/><FormGrid><NumberField label="Abastecimento" value={mission.tempoAbastecimentoMin} suffix="min/parada" onChange={(v)=>updateMission("tempoAbastecimentoMin",v)}/><NumberField label="Troca de bateria" value={mission.tempoTrocaBateriaMin} suffix="min" onChange={(v)=>updateMission("tempoTrocaBateriaMin",v)}/><NumberField label="Tanques por bateria" value={mission.tanquesPorBateria} suffix="tanques" onChange={(v)=>updateMission("tanquesPorBateria",v)}/><NumberField label="Deslocamento" value={mission.tempoDeslocamentoMin} suffix="min" onChange={(v)=>updateMission("tempoDeslocamentoMin",v)}/><NumberField label="Bordadura" value={mission.tempoBordaduraMin} suffix="min" onChange={(v)=>updateMission("tempoBordaduraMin",v)}/></FormGrid><Primary disabled={!missionReady} onClick={()=>guarded("calda")}>Calcular missão <ChevronRight size={18}/></Primary></>}

        {view === "calda" && <><Step current={2}/><Title icon={<Calculator/>} title="Cálculo de calda" text="Resultado matemático; não é recomendação agronômica."/><div className="grid grid-cols-2 gap-3"><Metric icon={<Droplets/>} label="Calda planejada" value={`${fmt(calc.totalCalda,1)} L`}/><Metric icon={<Route/>} label="Área por tanque cheio" value={`${fmt(calc.areaTank,2)} ha`}/><Metric icon={<RotateCcw/>} label="Tanques planejados" value={`${calc.tanks}`} detail={`Último: ${fmt(calc.lastTankVolume,1)} L`}/><Metric icon={<Gauge/>} label="Vazão calculada" value={`${fmt(calc.flowLMin,2)} L/min`}/></div>{calc.products.map(({product,total,fullTank,lastTank})=><div key={product.id} className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 p-4 text-sm sm:grid-cols-4"><div><span className="text-slate-500">Produto</span><strong className="block">{product.nome}</strong></div><div><span className="text-slate-500">Total</span><strong className="block">{fmt(total.value,3)} {total.unit}</strong></div><div><span className="text-slate-500">Tanque cheio</span><strong className="block">{fmt(fullTank.value,3)} {fullTank.unit}</strong></div><div><span className="text-slate-500">Último tanque</span><strong className="block">{fmt(lastTank.value,3)} {lastTank.unit}</strong></div></div>)}<Warning>Confirme receita, bula, compatibilidade e ordem de mistura antes de preparar a calda.</Warning><Primary onClick={()=>go("estrategia")}>Ver estratégia <ChevronRight size={18}/></Primary></>}

        {view === "estrategia" && <><Step current={3}/><div className="grid grid-cols-2 gap-3"><Metric icon={<Sprout/>} label="Cultura" value={mission.cultura}/><Metric icon={<Target/>} label="Alvo" value={mission.alvo}/></div><Metric icon={<Droplets/>} label="Gota" value={protocol.gota}/><Metric icon={<Route/>} label="Estratégia" value={protocol.strategy}/><Metric icon={<TimerReset/>} label="Janela" value={protocol.janela}/><Info>{protocol.note}</Info><CheckRow checked={insightAccepted} disabled={locked} onChange={setInsightAccepted} title={settings.insightsObrigatorios?"Confirmação obrigatória":"Confirmar leitura"} detail="Li a orientação e vou conferir produto, bula, receita e protocolo técnico."/><Primary disabled={settings.insightsObrigatorios&&!insightAccepted} onClick={()=>guarded("seguranca")}>Analisar segurança <ChevronRight size={18}/></Primary></>}

        {view === "seguranca" && <><Step current={4}/><Title icon={<Map/>} title="Segurança e condição real" text="GPS/modelo localiza; a liberação usa medição feita no talhão e regras internas."/>{modelWeather?<div className="rounded-3xl overflow-hidden border border-slate-200"><iframe title="Mapa do ponto GPS" className="h-52 w-full" src={`https://www.openstreetmap.org/export/embed.html?bbox=${modelWeather.longitude-.003}%2C${modelWeather.latitude-.003}%2C${modelWeather.longitude+.003}%2C${modelWeather.latitude+.003}&layer=mapnik&marker=${modelWeather.latitude}%2C${modelWeather.longitude}`}/></div>:<Warning>Capture o GPS pelo botão flutuante. O ponto GPS é obrigatório no registro final enquanto o polígono do talhão ainda não está integrado.</Warning>}<div className={`rounded-2xl border p-4 text-sm ${marginBlocked?"border-red-300 bg-red-50 text-red-950":"border-amber-200 bg-amber-50 text-amber-950"}`}><div><strong>Margem preventiva interna</strong><span className="float-right font-black">{settings.margemPreventiva} m</span></div><div className="mt-2"><strong>Distância informada</strong><span className="float-right font-black">{mission.semAreaSensivel?"Sem área sensível aplicável":mission.distanciaSensivel!==null?`${mission.distanciaSensivel} m`:"Pendente"}</span></div><p className="mt-2">{marginBlocked?"BLOQUEADO pelo padrão preventivo interno da empresa.":"A margem interna não substitui lei, bula ou orientação do RT."}</p></div><FormGrid><NullableNumberField label="Distância da área sensível" value={mission.distanciaSensivel} suffix="m" disabled={mission.semAreaSensivel||locked} onChange={(v)=>updateMission("distanciaSensivel",v)}/><label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold"><input disabled={locked} type="checkbox" checked={mission.semAreaSensivel} onChange={(e)=>updateMission("semAreaSensivel",e.target.checked)}/><span>Não identifiquei área sensível aplicável</span></label><NullableNumberField label="Vento medido *" value={mission.ventoCampoKmh} suffix="km/h" disabled={locked} onChange={(v)=>updateMission("ventoCampoKmh",v)}/><TextField label="Direção do vento *" value={mission.direcaoVentoCampo} disabled={locked} onChange={(v)=>updateMission("direcaoVentoCampo",v)} placeholder="Ex.: NE → SO"/><NullableNumberField label="Temperatura medida *" value={mission.temperaturaCampo} suffix="°C" disabled={locked} onChange={(v)=>updateMission("temperaturaCampo",v)}/><NullableNumberField label="Umidade medida *" value={mission.umidadeCampo} suffix="%" disabled={locked} onChange={(v)=>updateMission("umidadeCampo",v)}/></FormGrid><button disabled={locked||marginBlocked} className={`min-h-11 rounded-xl px-4 font-black disabled:opacity-50 ${mission.climaCampoConfirmado?"bg-emerald-100 text-emerald-800":"bg-slate-950 text-white"}`} onClick={confirmClimate}>{mission.climaCampoConfirmado?"Medição de campo registrada":"Confirmar medição de campo"}</button>{modelWeather&&<Info>Modelo: {fmt(modelWeather.temperature,1)}°C • UR {fmt(modelWeather.humidity,0)}% • vento 10 m {fmt(modelWeather.windSpeed,1)} km/h • rajada {fmt(modelWeather.windGust,1)} km/h. Compare com a medição local.</Info>}<CheckRow disabled={locked||!mission.climaCampoConfirmado||!sensitiveReady||marginBlocked} checked={riskAccepted} onChange={setRiskAccepted} title="Confirmar análise de risco" detail="Só habilita depois da medição de campo e fora do bloqueio preventivo interno."/><Primary disabled={!safetyReady} onClick={()=>go("controle")}>Gerar parâmetros-base <ChevronRight size={18}/></Primary></>}

        {view === "controle" && <><Warning>Parâmetros calculados — ainda não liberados para voo. Faltam calibração, checklist e SARPAS.</Warning><div className="grid grid-cols-2 gap-3"><Metric icon={<Gauge/>} label="Velocidade" value={`${fmt(calc.speedMs,1)} m/s`} detail={`${fmt(mission.velocidadeKmh,1)} km/h`}/><Metric icon={<Droplets/>} label="Volume" value={`${fmt(mission.volume,1)} L/ha`}/><Metric icon={<Route/>} label="Faixa" value={`${fmt(mission.faixa,1)} m`}/><Metric icon={<Sparkles/>} label="Vazão" value={`${fmt(calc.flowLMin,2)} L/min`}/><Metric icon={<Gauge/>} label="Capacidade teórica" value={`${fmt(calc.haH,1)} ha/h`}/><Metric icon={<TimerReset/>} label="Tempo estimado" value={duration(calc.estimatedHours)}/></div><Primary onClick={()=>go("calibracao")}>Ir para calibração <ChevronRight size={18}/></Primary></>}

        {view === "calibracao" && <><Title icon={<Wrench/>} title="Calibração" text="Sequência obrigatória: eliminar ar → fluxômetro → bomba."/><Task index="1" title="Eliminar o ar do sistema" detail="Faça a liberação de ar antes das demais calibrações." checked={calibration.ar} disabled={locked} onChange={(v)=>setCalibration({ar:v,fluxometro:v?calibration.fluxometro:false,bomba:v?calibration.bomba:false})}/><Task index="2" title="Calibrar o fluxômetro" detail="Só após eliminar o ar." checked={calibration.fluxometro} disabled={locked||!calibration.ar} onChange={(v)=>setCalibration({...calibration,fluxometro:v,bomba:v?calibration.bomba:false})}/><Task index="3" title="Calibrar a bomba" detail="Última etapa da sequência." checked={calibration.bomba} disabled={locked||!calibration.fluxometro} onChange={(v)=>setCalibration({...calibration,bomba:v})}/><Primary disabled={!calibrationReady} onClick={()=>go("checklist")}>Ir para checklist <ChevronRight size={18}/></Primary></>}

        {view === "checklist" && <><Title icon={<ClipboardCheck/>} title="Checklist pré-voo" text={`${Object.values(checklist).filter(Boolean).length} de 8 itens confirmados.`}/>{([ ["area","Área e decolagem","Área e ponto de decolagem conferidos."], ["pessoasAnimais","Pessoas e animais","Sem pessoas ou animais expostos."], ["obstaculos","Obstáculos e rede elétrica","Árvores, postes, fios, água e áreas sensíveis conferidos."], ["drone","Drone","Estrutura, motores, hélices, sensores e trem de pouso conferidos."], ["controle","Controle e navegação","Controle, bateria, missão, mapa e conexão conferidos."], ["pulverizacao","Pulverização","Tanque, mangueiras, filtros, atomizadores/bicos, bomba e fluxômetro conferidos."], ["clima","Medição climática","Preenchida automaticamente pela confirmação feita em Segurança."], ["documentos","Documentos","Receita/protocolo e documentos/autorizações aplicáveis conferidos."] ] as Array<[keyof ChecklistState,string,string]>).map(([key,t,d],i)=><Task key={key} index={String(i+1)} title={t} detail={d} checked={checklist[key]} disabled={locked||key==="clima"} onChange={(v)=>setChecklist({...checklist,[key]:v})}/>)}<Primary disabled={!checklistReady} onClick={()=>go("sarpas")}>Ir para SARPAS <ChevronRight size={18}/></Primary></>}

        {view === "sarpas" && <><Title icon={<ShieldCheck/>} title="SARPAS" text="A consulta e a autorização acontecem no sistema oficial. Aqui, o DroneGestor apenas lê o registro salvo nesta OS."/><div className={`rounded-2xl border p-4 ${sarpasReady?"border-emerald-200 bg-emerald-50 text-emerald-950":"border-amber-200 bg-amber-50 text-amber-950"}`}><strong className="block">{sarpasReady?"SARPAS autorizado":"SARPAS ainda não autorizado"}</strong><p className="mt-1 text-sm">{sarpasReady?`Referência registrada: ${mission.sarpasNumero}`:"Registre a situação e anexe o comprovante correto antes de iniciar."}</p></div>{!sarpasReady&&<a className="inline-flex min-h-12 items-center justify-center rounded-xl bg-sky-700 px-4 font-black text-white no-underline" href="/apps/dronegestor/documentos">Abrir documentos e SARPAS</a>}<Info>{gpsReady?`GPS registrado: ${modelWeather?.latitude.toFixed(5)}, ${modelWeather?.longitude.toFixed(5)}`:"GPS ainda pendente. Capture pelo botão flutuante antes de iniciar."}</Info><Warning>O DroneGestor não envia nem aprova solicitações SARPAS automaticamente.</Warning><Primary disabled={!canStart} onClick={()=>void startOperation()}><Play size={18}/> Iniciar operação</Primary>{!canStart&&<p className="text-center text-xs font-semibold text-amber-700">Há validação pendente em missão, segurança, GPS, calibração, checklist ou SARPAS.</p>}</>}

        {view === "execucao" && <><div className="rounded-3xl bg-gradient-to-br from-emerald-950 to-emerald-700 p-5 text-white"><span className="text-xs font-black uppercase tracking-wider">{paused?"Operação pausada":"Aplicação em andamento"}</span><h2 className="mt-1 text-xl font-black">{mission.cultura} • {mission.alvo}</h2><div className="mt-4 flex items-end justify-between"><strong className="text-4xl">{fmt(mission.area>0?Math.min(100,progressHa/mission.area*100):0,0)}%</strong><span className="text-sm">{fmt(progressHa,2)} de {fmt(mission.area,2)} ha</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white" style={{width:`${mission.area>0?Math.min(100,progressHa/mission.area*100):0}%`}}/></div></div><div className="grid grid-cols-2 gap-3"><Metric icon={<RotateCcw/>} label="Abastecimentos reais" value={`${tankRecords.length}`}/><Metric icon={<Droplets/>} label="Calda real registrada" value={`${fmt(calc.actualVolume,1)} L`}/><Metric icon={<Map/>} label="Área restante" value={`${fmt(Math.max(0,mission.area-progressHa),2)} ha`}/><Metric icon={<AlertTriangle/>} label="Ocorrências" value={`${occurrences.length}`}/></div><div className="rounded-2xl border border-slate-200 p-4"><strong className="text-sm">Registrar abastecimento concluído</strong><p className="mt-1 text-xs text-slate-500">Informe o que realmente foi executado; o sistema não soma hectares teoricamente.</p><div className="mt-3 grid grid-cols-2 gap-2"><input disabled={paused||areaDone} className="min-h-11 rounded-xl border border-slate-200 px-3" type="number" step="any" placeholder="Área real (ha)" value={tankArea} onChange={(e)=>setTankArea(e.target.value)}/><input disabled={paused||areaDone} className="min-h-11 rounded-xl border border-slate-200 px-3" type="number" step="any" placeholder="Volume usado (L)" value={tankVolume} onChange={(e)=>setTankVolume(e.target.value)}/></div><div className="mt-2 grid grid-cols-2 gap-2"><button disabled={paused||areaDone} className="min-h-11 rounded-xl bg-emerald-600 px-3 font-black text-white disabled:opacity-40" onClick={registerTank}><Check className="mr-1 inline" size={17}/>Registrar</button><button disabled={paused||!tankRecords.length} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 font-black text-slate-700 disabled:opacity-40" onClick={undoLastTank}><Undo2 className="mr-1 inline" size={17}/>Desfazer último</button></div></div><div className="grid grid-cols-2 gap-3"><button className="min-h-12 rounded-xl border border-slate-200 bg-white font-black text-slate-800" onClick={togglePause}>{paused?<><Play className="mr-2 inline" size={18}/>Retomar</>:<><Pause className="mr-2 inline" size={18}/>Pausar</>}</button><button className="min-h-12 rounded-xl border border-amber-200 bg-amber-50 font-black text-amber-900" onClick={addOccurrence}><AlertTriangle className="mr-2 inline" size={18}/>Ocorrência</button></div>{areaDone?<Info>100% da área planejada foi atingida pelos registros reais. Confira volumes, ocorrências e conclua.</Info>:<Warning>A conclusão permanece bloqueada até a soma das áreas realmente registradas atingir 100%.</Warning>}<Primary disabled={!areaDone||!canStart||savingFinal||finalSaved} onClick={()=>void finalizeOperation()}>{savingFinal?"Salvando...":finalSaved?"Operação salva":"Concluir e salvar no histórico"}</Primary></>}

        {view === "relatorios" && <><Title icon={<FileText/>} title="Dados da operação" text="Rascunho da missão e consulta do estado final."/><div className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center gap-2 text-emerald-700"><Check size={18}/><strong>{missionStatus==="finalizada"?"Operação salva no histórico":missionStatus==="pendente_sync"?"Conclusão congelada aguardando sincronização":"Missão em rascunho"}</strong></div><p className="mt-2 font-black text-slate-950">{mission.cultura||"Sem cultura"} • {fmt(mission.area,1)} ha planejados</p><p className="text-sm text-slate-500">{fmt(progressHa,2)} ha reais • {fmt(calc.actualVolume,1)} L reais • {occurrences.length} ocorrência(s)</p></div><ReportButton icon={<FileText/>} title="Rascunho da operação" detail="Resumo dos parâmetros e progresso real." onClick={exportDraft}/><ReportButton icon={<FileSpreadsheet/>} title="Dados operacionais CSV" detail="Base de conferência; não é relatório oficial MAPA." onClick={exportCsv}/><a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white font-black text-slate-800 no-underline" href="/apps/dronegestor/historico"><FileText size={18}/> Abrir histórico salvo</a>{["finalizada","pendente_sync"].includes(missionStatus)&&<button className="min-h-12 rounded-xl bg-slate-950 px-4 font-black text-white" onClick={resetMission}>Iniciar uma nova missão</button>}<Warning>O mapa/polígono completo do talhão e o relatório mensal oficial ainda são módulos separados em implantação; este rascunho não os substitui.</Warning></>}

        {view === "config" && <SettingsPanel settings={settings} canManage={canManage} userType={userType} onSave={(next)=>void saveCompanySettings(next)}/>}      
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid max-w-3xl grid-cols-5 border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur sm:absolute sm:rounded-b-[30px]"><Nav icon={<Home/>} label="Início" active={view==="inicio"} onClick={()=>go("inicio")}/><Nav icon={<Drone/>} label={operationStarted?"Retomar":"Operação"} active={flow.includes(view)&&!["seguranca","relatorios"].includes(view)} onClick={()=>guarded(resumeView())}/><Nav icon={<Map/>} label="Segurança" active={view==="seguranca"} onClick={()=>guarded("seguranca")}/><Nav icon={<FileText/>} label="Dados" active={view==="relatorios"} onClick={()=>go("relatorios")}/><Nav icon={<Settings2/>} label="Mais" active={view==="config"} onClick={()=>{if(locked)return flash("Configurações bloqueadas nesta fase.");setReturnView(view);go("config");}}/></nav>
    </div>
  </main>;
}

function SettingsPanel({ settings, canManage, userType, onSave }: { settings: CompanySettings; canManage: boolean; userType: string; onSave: (value: CompanySettings) => void }) {
  const [draft,setDraft]=useState(settings); useEffect(()=>setDraft(settings),[settings]); const set=<K extends keyof CompanySettings>(key:K,value:CompanySettings[K])=>setDraft((current)=>({...current,[key]:value}));
  return <><Info>Perfil atual: {userType}. {canManage?"Você pode alterar os padrões da empresa.":"Somente leitura; piloto não pode desligar regras."}</Info><Toggle label="Insights de campo obrigatórios" checked={draft.insightsObrigatorios} disabled={!canManage} onChange={(v)=>set("insightsObrigatorios",v)}/><label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4"><span><strong className="block text-sm">Margem preventiva interna</strong><small className="text-slate-500">Padrão interno, não regra legal.</small></span><div className="flex items-center gap-2"><input disabled={!canManage} className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-right" type="number" value={draft.margemPreventiva} onChange={(e)=>set("margemPreventiva",Math.max(0,n(e.target.value)))}/><b>m</b></div></label><Toggle label="Bloquear missão dentro da margem preventiva" checked={draft.bloquearMargemPreventiva} disabled={!canManage} onChange={(v)=>set("bloquearMargemPreventiva",v)}/><Toggle label="Exigir confirmação de risco" checked={draft.exigirConfirmacao} disabled={!canManage} onChange={(v)=>set("exigirConfirmacao",v)}/><Toggle label="Bordadura para cigarrinha (protocolo interno)" checked={draft.protocoloBordaduraCigarrinha} disabled={!canManage} onChange={(v)=>set("protocoloBordaduraCigarrinha",v)}/>{canManage&&<Primary onClick={()=>onSave(draft)}><Check size={18}/> Salvar padrão da empresa</Primary>}</>;
}

function CardButton({icon,title,text,onClick,primary=false}:{icon:React.ReactNode;title:string;text:string;onClick:()=>void;primary?:boolean}){return <button className={`flex min-h-28 items-start gap-3 rounded-2xl border p-4 text-left ${primary?"border-emerald-300 bg-emerald-50":"border-slate-200 bg-white"}`} onClick={onClick}><span className={`grid size-11 shrink-0 place-items-center rounded-xl ${primary?"bg-emerald-600 text-white":"bg-slate-100 text-slate-700"}`}>{icon}</span><span><strong className="block text-base text-slate-950">{title}</strong><small className="mt-1 block leading-5 text-slate-500">{text}</small></span><ChevronRight className="ml-auto mt-2 shrink-0 text-slate-400" size={18}/></button>}
function FormGrid({children}:{children:React.ReactNode}){return <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">{children}</div>}
function TextField({label,value,onChange,placeholder="",disabled=false}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;disabled?:boolean}){return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{label}</span><input disabled={disabled} className="min-h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500 disabled:bg-slate-100" value={value} placeholder={placeholder} onChange={(e)=>onChange(e.target.value)}/></label>}
function NumberField({label,value,suffix,onChange}:{label:string;value:number;suffix:string;onChange:(v:number)=>void}){return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{label}</span><div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3"><input className="min-w-0 flex-1 outline-none" type="number" step="any" value={value||""} onChange={(e)=>onChange(n(e.target.value))}/>{suffix&&<b className="ml-2 text-xs text-slate-500">{suffix}</b>}</div></label>}
function NullableNumberField({label,value,suffix,onChange,disabled=false}:{label:string;value:number|null;suffix:string;onChange:(v:number|null)=>void;disabled?:boolean}){return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{label}</span><div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3"><input disabled={disabled} className="min-w-0 flex-1 outline-none disabled:bg-slate-100" type="number" step="any" value={value===null?"":value} onChange={(e)=>onChange(e.target.value===""?null:n(e.target.value))}/>{suffix&&<b className="ml-2 text-xs text-slate-500">{suffix}</b>}</div></label>}
function SelectField({label,value,onChange,options,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;options:string[];disabled?:boolean}){return <label className="grid gap-1 text-sm font-bold text-slate-700"><span>{label}</span><select disabled={disabled} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 disabled:bg-slate-100" value={value} onChange={(e)=>onChange(e.target.value)}>{options.map((entry)=>{const [v,t]=entry.split("|");return <option key={`${v}-${t}`} value={v}>{t}</option>})}</select></label>}
function Metric({icon,label,value,detail,dark=false}:{icon:React.ReactNode;label:string;value:string;detail?:string;dark?:boolean}){return <div className={`rounded-2xl p-4 ${dark?"bg-white/10":"border border-slate-200 bg-white"}`}><span className={dark?"text-emerald-200":"text-emerald-700"}>{icon}</span><small className={`mt-2 block ${dark?"text-emerald-100/70":"text-slate-500"}`}>{label}</small><strong className="mt-1 block text-lg leading-6">{value||"—"}</strong>{detail&&<span className={`mt-1 block text-xs ${dark?"text-emerald-100/70":"text-slate-500"}`}>{detail}</span>}</div>}
function Title({icon,title,text}:{icon:React.ReactNode;title:string;text:string}){return <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">{icon}</span><div><strong className="text-lg text-slate-950">{title}</strong><p className="mt-1 text-sm leading-5 text-slate-500">{text}</p></div></div>}
function Warning({children}:{children:React.ReactNode}){return <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><AlertTriangle className="mt-0.5 shrink-0" size={18}/><div>{children}</div></div>}
function Info({children}:{children:React.ReactNode}){return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">{children}</div>}
function Primary({children,onClick,disabled=false}:{children:React.ReactNode;onClick:()=>void;disabled?:boolean}){return <button disabled={disabled} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300" onClick={onClick}>{children}</button>}
function CheckRow({checked,onChange,title,detail,disabled=false}:{checked:boolean;onChange:(v:boolean)=>void;title:string;detail:string;disabled?:boolean}){return <label className={`flex gap-3 rounded-2xl border p-4 ${checked?"border-emerald-300 bg-emerald-50":"border-slate-200 bg-white"} ${disabled?"opacity-60":""}`}><input disabled={disabled} className="mt-1 size-5" type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)}/><span><strong className="block text-sm text-slate-950">{title}</strong><small className="mt-1 block leading-5 text-slate-500">{detail}</small></span></label>}
function Task({index,title,detail,checked,onChange,disabled=false}:{index:string;title:string;detail:string;checked:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){return <label className={`flex gap-3 rounded-2xl border p-4 ${checked?"border-emerald-300 bg-emerald-50":"border-slate-200"} ${disabled?"opacity-60":""}`}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black">{index}</span><span className="flex-1"><strong className="block text-sm">{title}</strong><small className="mt-1 block text-slate-500">{detail}</small></span><input disabled={disabled} className="size-5" type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)}/></label>}
function Toggle({label,checked,onChange,disabled=false}:{label:string;checked:boolean;onChange:(v:boolean)=>void;disabled?:boolean}){return <label className={`flex items-center justify-between rounded-2xl border border-slate-200 p-4 ${disabled?"opacity-60":""}`}><strong className="text-sm">{label}</strong><input disabled={disabled} className="size-5" type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)}/></label>}
function ReportButton({icon,title,detail,onClick}:{icon:React.ReactNode;title:string;detail:string;onClick:()=>void}){return <button className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left" onClick={onClick}><span className="text-emerald-700">{icon}</span><span><strong className="block">{title}</strong><small className="text-slate-500">{detail}</small></span></button>}
function Nav({icon,label,active,onClick}:{icon:React.ReactNode;label:string;active:boolean;onClick:()=>void}){return <button className={`grid place-items-center gap-1 rounded-xl py-1 text-[10px] font-black ${active?"text-emerald-700":"text-slate-400"}`} onClick={onClick}><span>{icon}</span>{label}</button>}
function Step({current}:{current:number}){return <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-emerald-700"><span className="grid size-7 place-items-center rounded-full bg-emerald-100">{current}</span><span>Etapa {current} de 8</span></div>}
