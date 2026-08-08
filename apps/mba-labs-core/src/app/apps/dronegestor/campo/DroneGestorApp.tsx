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
  MapPin,
  Menu,
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
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import styles from "./dronegestor.module.css";

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

type DoseUnit = "mL/ha" | "L/ha" | "g/ha" | "kg/ha" | "mL/100L" | "g/100L";

type Product = {
  id: string;
  nome: string;
  dose: number;
  unidade: DoseUnit;
};

type CalibrationState = {
  ar: boolean;
  fluxometro: boolean;
  bomba: boolean;
};

type ChecklistState = {
  area: boolean;
  pessoasAnimais: boolean;
  obstaculos: boolean;
  drone: boolean;
  controle: boolean;
  pulverizacao: boolean;
  clima: boolean;
  documentos: boolean;
};

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
  ventoCampoKmh: number;
  direcaoVentoCampo: string;
  temperaturaCampo: number;
  umidadeCampo: number;
  tempoAbastecimentoMin: number;
  tempoTrocaBateriaMin: number;
  tanquesPorBateria: number;
  tempoDeslocamentoMin: number;
  tempoBordaduraMin: number;
  sarpasNumero: string;
  sarpasConfirmado: boolean;
};

type CompanySettings = {
  insightsObrigatorios: boolean;
  margemPreventiva: number;
  exigirConfirmacao: boolean;
  protocoloBordaduraCigarrinha: boolean;
};

type ModelWeather = {
  latitude: number;
  longitude: number;
  capturedAt: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGust: number;
  precipitation: number;
};

type Occurrence = {
  id: string;
  at: string;
  text: string;
};

function blankProduct(): Product {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    nome: "",
    dose: 0,
    unidade: "mL/ha"
  };
}

const initialMission: Mission = {
  cultura: "",
  alvo: "",
  area: 0,
  drone: "",
  volume: 0,
  tanque: 0,
  faixa: 0,
  velocidadeKmh: 0,
  alturaM: 0,
  produtos: [],
  distanciaSensivel: 0,
  ventoCampoKmh: 0,
  direcaoVentoCampo: "",
  temperaturaCampo: 0,
  umidadeCampo: 0,
  tempoAbastecimentoMin: 0,
  tempoTrocaBateriaMin: 0,
  tanquesPorBateria: 0,
  tempoDeslocamentoMin: 0,
  tempoBordaduraMin: 0,
  sarpasNumero: "",
  sarpasConfirmado: false
};

const initialSettings: CompanySettings = {
  insightsObrigatorios: true,
  margemPreventiva: 90,
  exigirConfirmacao: true,
  protocoloBordaduraCigarrinha: false
};

const initialCalibration: CalibrationState = { ar: false, fluxometro: false, bomba: false };
const initialChecklist: ChecklistState = {
  area: false,
  pessoasAnimais: false,
  obstaculos: false,
  drone: false,
  controle: false,
  pulverizacao: false,
  clima: false,
  documentos: false
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number, decimals = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDuration(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0) return "—";
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function amountForProduct(product: Product, areaHa: number, totalCaldaL: number, hectaresPorTanque: number, tanqueL: number) {
  const dose = Number(product.dose) || 0;
  let totalBase = 0;
  let tankBase = 0;
  let unit = "";

  if (product.unidade === "mL/ha") {
    totalBase = areaHa * dose;
    tankBase = hectaresPorTanque * dose;
    unit = "mL";
  } else if (product.unidade === "L/ha") {
    totalBase = areaHa * dose;
    tankBase = hectaresPorTanque * dose;
    unit = "L";
  } else if (product.unidade === "g/ha") {
    totalBase = areaHa * dose;
    tankBase = hectaresPorTanque * dose;
    unit = "g";
  } else if (product.unidade === "kg/ha") {
    totalBase = areaHa * dose;
    tankBase = hectaresPorTanque * dose;
    unit = "kg";
  } else if (product.unidade === "mL/100L") {
    totalBase = (totalCaldaL / 100) * dose;
    tankBase = (tanqueL / 100) * dose;
    unit = "mL";
  } else if (product.unidade === "g/100L") {
    totalBase = (totalCaldaL / 100) * dose;
    tankBase = (tanqueL / 100) * dose;
    unit = "g";
  }

  const normalize = (value: number, baseUnit: string) => {
    if (baseUnit === "mL" && value >= 1000) return { value: value / 1000, unit: "L" };
    if (baseUnit === "g" && value >= 1000) return { value: value / 1000, unit: "kg" };
    return { value, unit: baseUnit };
  };

  return { total: normalize(totalBase, unit), tank: normalize(tankBase, unit) };
}

function getTargetProtocol(target: string, settings: CompanySettings) {
  const normalized = target.toLowerCase();
  const hasCompanyBorderProtocol = normalized.includes("cigarrinha") && settings.protocoloBordaduraCigarrinha;

  return {
    gota: "Definir pelo protocolo validado",
    janela: "Cruzar clima, bula e protocolo",
    estrategia: hasCompanyBorderProtocol
      ? "Padrão da empresa: iniciar pela bordadura e depois avançar para o interior."
      : "Nenhuma estratégia automática foi definida. Use o protocolo técnico aprovado para cultura, alvo e produto.",
    insight: hasCompanyBorderProtocol
      ? "Insight obrigatório da empresa para cigarrinha. Confirme se o protocolo permanece adequado ao produto, estágio da cultura e condição do talhão."
      : "O DroneGestor não inventa dose, gota ou estratégia. Cadastre/valide o protocolo técnico antes da operação.",
    companyProtocol: hasCompanyBorderProtocol
  };
}

export function DroneGestorApp({ userName }: { userName: string }) {
  const [view, setView] = useState<View>("inicio");
  const [mission, setMission] = useState<Mission>({ ...initialMission, produtos: [blankProduct()] });
  const [settings, setSettings] = useState<CompanySettings>(initialSettings);
  const [calibration, setCalibration] = useState<CalibrationState>(initialCalibration);
  const [checklist, setChecklist] = useState<ChecklistState>(initialChecklist);
  const [insightAccepted, setInsightAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [progressHa, setProgressHa] = useState(0);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState("");
  const [modelWeather, setModelWeather] = useState<ModelWeather | null>(null);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);

  useEffect(() => {
    try {
      const savedMission = localStorage.getItem("dronegestor:mission:v2");
      const savedSettings = localStorage.getItem("dronegestor:settings:v2");
      const savedCalibration = localStorage.getItem("dronegestor:calibration:v2");
      const savedChecklist = localStorage.getItem("dronegestor:checklist:v2");
      const savedOccurrences = localStorage.getItem("dronegestor:occurrences:v2");
      const savedWeather = localStorage.getItem("dronegestor:weather");
      if (savedMission) {
        const parsed = JSON.parse(savedMission) as Partial<Mission>;
        setMission({ ...initialMission, ...parsed, produtos: parsed.produtos?.length ? parsed.produtos : [blankProduct()] });
      }
      if (savedSettings) setSettings({ ...initialSettings, ...JSON.parse(savedSettings) });
      if (savedCalibration) setCalibration({ ...initialCalibration, ...JSON.parse(savedCalibration) });
      if (savedChecklist) setChecklist({ ...initialChecklist, ...JSON.parse(savedChecklist) });
      if (savedOccurrences) setOccurrences(JSON.parse(savedOccurrences));
      if (savedWeather) setModelWeather(JSON.parse(savedWeather));
    } catch {
      // Dados locais inválidos não impedem o uso do aplicativo.
    }
  }, []);

  useEffect(() => localStorage.setItem("dronegestor:mission:v2", JSON.stringify(mission)), [mission]);
  useEffect(() => localStorage.setItem("dronegestor:settings:v2", JSON.stringify(settings)), [settings]);
  useEffect(() => localStorage.setItem("dronegestor:calibration:v2", JSON.stringify(calibration)), [calibration]);
  useEffect(() => localStorage.setItem("dronegestor:checklist:v2", JSON.stringify(checklist)), [checklist]);
  useEffect(() => localStorage.setItem("dronegestor:occurrences:v2", JSON.stringify(occurrences)), [occurrences]);

  const calc = useMemo(() => {
    const totalCalda = mission.area > 0 && mission.volume > 0 ? mission.area * mission.volume : 0;
    const hectaresPorTanque = mission.volume > 0 && mission.tanque > 0 ? mission.tanque / mission.volume : 0;
    const tanquesExatos = mission.tanque > 0 ? totalCalda / mission.tanque : 0;
    const totalTanques = tanquesExatos > 0 ? Math.ceil(tanquesExatos) : 0;
    const tanquesInteiros = Math.floor(tanquesExatos);
    const ultimoTanque = totalTanques > 0 ? totalCalda - tanquesInteiros * mission.tanque : 0;
    const velocidadeMs = mission.velocidadeKmh > 0 ? mission.velocidadeKmh / 3.6 : 0;
    const vazao = mission.volume > 0 && mission.velocidadeKmh > 0 && mission.faixa > 0
      ? (mission.volume * mission.velocidadeKmh * mission.faixa) / 600
      : 0;
    const capacidadeTeorica = mission.velocidadeKmh > 0 && mission.faixa > 0
      ? (mission.velocidadeKmh * mission.faixa) / 10
      : 0;
    const tempoPulverizacaoH = capacidadeTeorica > 0 ? mission.area / capacidadeTeorica : 0;
    const reabastecimentos = Math.max(0, totalTanques - 1);
    const trocasBateria = mission.tanquesPorBateria > 0 && totalTanques > 0
      ? Math.floor((totalTanques - 1) / mission.tanquesPorBateria)
      : 0;
    const paradasMin =
      reabastecimentos * Math.max(0, mission.tempoAbastecimentoMin) +
      trocasBateria * Math.max(0, mission.tempoTrocaBateriaMin) +
      Math.max(0, mission.tempoDeslocamentoMin) +
      Math.max(0, mission.tempoBordaduraMin);
    const tempoEstimadoH = tempoPulverizacaoH > 0 ? tempoPulverizacaoH + paradasMin / 60 : 0;
    const produtos = mission.produtos.map((product) => ({
      product,
      amount: amountForProduct(product, mission.area, totalCalda, hectaresPorTanque, mission.tanque)
    }));

    return {
      totalCalda,
      hectaresPorTanque,
      tanquesInteiros,
      ultimoTanque,
      totalTanques,
      velocidadeMs,
      vazao,
      capacidadeTeorica,
      tempoPulverizacaoH,
      tempoEstimadoH,
      reabastecimentos,
      trocasBateria,
      paradasMin,
      produtos
    };
  }, [mission]);

  const protocol = useMemo(() => getTargetProtocol(mission.alvo, settings), [mission.alvo, settings]);

  const requiredMissionReady = Boolean(
    mission.cultura && mission.alvo && mission.drone && mission.area > 0 && mission.volume > 0 && mission.tanque > 0 && mission.faixa > 0 && mission.velocidadeKmh > 0
  );
  const fieldWeatherReady = mission.ventoCampoKmh > 0 && mission.direcaoVentoCampo.trim().length > 0 && mission.temperaturaCampo !== 0 && mission.umidadeCampo > 0;
  const calibrationReady = calibration.ar && calibration.fluxometro && calibration.bomba;
  const checklistReady = Object.values(checklist).every(Boolean);

  const risk = useMemo(() => {
    if (mission.distanciaSensivel <= 0) return { level: "warning" as const, label: "Distância da área sensível ainda não informada" };
    if (mission.distanciaSensivel < settings.margemPreventiva) return { level: "warning" as const, label: "Dentro da margem preventiva definida pela empresa" };
    if (!fieldWeatherReady) return { level: "warning" as const, label: "Medição meteorológica de campo pendente" };
    return { level: "safe" as const, label: "Dados de campo preenchidos; faça a conferência final do protocolo" };
  }, [mission.distanciaSensivel, settings.margemPreventiva, fieldWeatherReady]);

  const canStart = requiredMissionReady &&
    (!settings.insightsObrigatorios || insightAccepted) &&
    (!settings.exigirConfirmacao || riskAccepted) &&
    calibrationReady && checklistReady && mission.sarpasConfirmado;

  function updateMission<K extends keyof Mission>(key: K, value: Mission[K]) {
    setMission((current) => ({ ...current, [key]: value }));
    if (["alvo", "cultura", "ventoCampoKmh", "direcaoVentoCampo", "distanciaSensivel"].includes(String(key))) {
      setInsightAccepted(false);
      setRiskAccepted(false);
    }
  }

  function updateProduct(id: string, patch: Partial<Product>) {
    setMission((current) => ({
      ...current,
      produtos: current.produtos.map((product) => product.id === id ? { ...product, ...patch } : product)
    }));
  }

  function addProduct() {
    setMission((current) => ({ ...current, produtos: [...current.produtos, blankProduct()] }));
  }

  function removeProduct(id: string) {
    setMission((current) => ({
      ...current,
      produtos: current.produtos.length <= 1 ? current.produtos : current.produtos.filter((product) => product.id !== id)
    }));
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  function resetMission() {
    if (!window.confirm("Limpar os dados desta missão e iniciar uma operação em branco?")) return;
    setMission({ ...initialMission, produtos: [blankProduct()] });
    setCalibration(initialCalibration);
    setChecklist(initialChecklist);
    setInsightAccepted(false);
    setRiskAccepted(false);
    setProgressHa(0);
    setOccurrences([]);
    setView("nova");
  }

  function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadMissionDraft() {
    const productLines = calc.produtos.flatMap(({ product, amount }) => [
      `Produto: ${product.nome || "Não informado"}`,
      `Dose informada: ${product.dose || 0} ${product.unidade}`,
      `Quantidade calculada: ${round(amount.total.value, 3)} ${amount.total.unit}`
    ]);
    const report = [
      "DRONEGESTOR AGRO - RASCUNHO DA OPERAÇÃO",
      "Não substitui relatório oficial, receituário, bula, RT ou autorização do órgão competente.",
      "",
      `Cultura: ${mission.cultura || "Não informada"}`,
      `Alvo: ${mission.alvo || "Não informado"}`,
      `Área: ${mission.area} ha`,
      `Drone: ${mission.drone || "Não informado"}`,
      `Volume de aplicação: ${mission.volume} L/ha`,
      `Calda calculada: ${round(calc.totalCalda, 1)} L`,
      ...productLines,
      `Velocidade: ${round(calc.velocidadeMs, 2)} m/s (${mission.velocidadeKmh} km/h)`,
      `Faixa: ${mission.faixa} m`,
      `Vazão calculada: ${round(calc.vazao, 2)} L/min`,
      `Altura planejada: ${mission.alturaM || "Não informada"} m`,
      `Medição de campo - vento: ${mission.ventoCampoKmh || "Não informado"} km/h ${mission.direcaoVentoCampo}`,
      `Medição de campo - temperatura: ${mission.temperaturaCampo || "Não informada"} °C`,
      `Medição de campo - umidade: ${mission.umidadeCampo || "Não informada"}%`,
      `Margem preventiva interna: ${settings.margemPreventiva} m`,
      `Distância informada da área sensível: ${mission.distanciaSensivel || "Não informada"} m`,
      `Estratégia interna: ${protocol.estrategia}`,
      `SARPAS informado: ${mission.sarpasNumero || "Não informado"}`,
      `Calibração confirmada: ${calibrationReady ? "Sim" : "Não"}`,
      `Checklist confirmado: ${checklistReady ? "Sim" : "Não"}`,
      `Ocorrências anotadas: ${occurrences.length}`,
      "",
      "Observação: todos os parâmetros devem ser conferidos no equipamento e no protocolo técnico antes da operação."
    ].join("\n");
    downloadText("dronegestor-rascunho-operacao.txt", report);
    flash("Rascunho da operação gerado.");
  }

  function downloadOperationalCsv() {
    const header = [
      "data","cultura","alvo","area_ha","drone","volume_l_ha","calda_l","velocidade_kmh","faixa_m","vazao_l_min","vento_campo_kmh","direcao_vento_campo","temperatura_campo_c","umidade_campo_pct","sarpas_ref"
    ];
    const row = [
      new Date().toLocaleDateString("pt-BR"), mission.cultura, mission.alvo, mission.area, mission.drone, mission.volume,
      round(calc.totalCalda,1), mission.velocidadeKmh, mission.faixa, round(calc.vazao,2), mission.ventoCampoKmh,
      mission.direcaoVentoCampo, mission.temperaturaCampo, mission.umidadeCampo, mission.sarpasNumero
    ];
    downloadText("dronegestor-dados-operacionais.csv", `${header.join(";")}\n${row.join(";")}`, "text/csv;charset=utf-8");
    flash("Rascunho CSV exportado.");
  }

  function addOccurrence() {
    const text = window.prompt("Descreva a ocorrência observada em campo:");
    if (!text?.trim()) return;
    setOccurrences((current) => [...current, { id: `${Date.now()}`, at: new Date().toISOString(), text: text.trim() }]);
    flash("Ocorrência salva neste dispositivo.");
  }

  function finishTank() {
    const next = Math.min(mission.area, progressHa + calc.hectaresPorTanque);
    setProgressHa(round(next, 2));
    flash(next >= mission.area ? "Área planejada concluída neste dispositivo." : "Tanque finalizado e progresso atualizado.");
    if (next >= mission.area) setView("relatorios");
  }

  function go(target: View) {
    setView(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const titleByView: Record<View, string> = {
    inicio: "Copiloto de aplicação",
    nova: "Nova aplicação",
    calda: "Calculadora de calda",
    estrategia: "Estratégia e insight",
    seguranca: "Mapa e segurança",
    controle: "Parâmetros do controle",
    calibracao: "Calibração",
    checklist: "Checklist pré-voo",
    sarpas: "SARPAS",
    execucao: "Operação em andamento",
    relatorios: "Dados e relatórios",
    config: "Configurações da empresa"
  };

  return (
    <main className={styles.appShell}>
      <div className={styles.bgMap} aria-hidden />
      <section className={styles.phoneStage}>
        <aside className={styles.desktopBrand}>
          <Brand />
          <p>Copiloto de aplicação para pilotos e empresas.</p>
          <div className={styles.brandFeature}><Target size={18} /> Precisão</div>
          <div className={styles.brandFeature}><ShieldCheck size={18} /> Segurança</div>
          <div className={styles.brandFeature}><Leaf size={18} /> Padronização</div>
        </aside>

        <div className={styles.phone}>
          <header className={styles.topbar}>
            <button className={styles.iconButton} onClick={() => (view === "inicio" ? flash("Use os atalhos abaixo para iniciar.") : go("inicio"))}>
              {view === "inicio" ? <Menu size={22} /> : <ArrowLeft size={22} />}
            </button>
            <div>
              <span className={styles.topbarEyebrow}>{view === "inicio" ? `Olá, ${userName.split(" ")[0]}` : "DroneGestor Agro"}</span>
              <strong>{titleByView[view]}</strong>
            </div>
            <button className={styles.iconButton} onClick={() => go("config")} aria-label="Configurações">
              <Settings2 size={21} />
            </button>
          </header>

          <div className={styles.content}>
            {view === "inicio" && <HomeView mission={mission} calc={calc} protocol={protocol} modelWeather={modelWeather} go={go} resetMission={resetMission} />}
            {view === "nova" && <NewMissionView mission={mission} updateMission={updateMission} updateProduct={updateProduct} addProduct={addProduct} removeProduct={removeProduct} calc={calc} onNext={() => requiredMissionReady ? go("calda") : flash("Preencha os campos obrigatórios da missão.")} />}
            {view === "calda" && <CaldaView mission={mission} calc={calc} onNext={() => go("estrategia")} />}
            {view === "estrategia" && <StrategyView mission={mission} protocol={protocol} mandatory={settings.insightsObrigatorios} accepted={insightAccepted} setAccepted={setInsightAccepted} onNext={() => go("seguranca")} />}
            {view === "seguranca" && <SafetyView mission={mission} settings={settings} modelWeather={modelWeather} risk={risk} accepted={riskAccepted} setAccepted={setRiskAccepted} updateMission={updateMission} onNext={() => go("controle")} />}
            {view === "controle" && <ControlView mission={mission} calc={calc} protocol={protocol} onCopy={() => {
              const text = `${formatNumber(calc.velocidadeMs, 1)} m/s | ${mission.volume} L/ha | ${mission.faixa} m | ${formatNumber(calc.vazao, 2)} L/min`;
              navigator.clipboard?.writeText(text);
              flash("Parâmetros-base copiados.");
            }} onNext={() => go("calibracao")} />}
            {view === "calibracao" && <CalibrationView calibration={calibration} setCalibration={setCalibration} onNext={() => calibrationReady ? go("checklist") : flash("Conclua a sequência de calibração.")} />}
            {view === "checklist" && <ChecklistView checklist={checklist} setChecklist={setChecklist} onNext={() => checklistReady ? go("sarpas") : flash("Conclua o checklist antes de continuar.")} />}
            {view === "sarpas" && <SarpasView mission={mission} updateMission={updateMission} onNext={() => mission.sarpasConfirmado ? go("execucao") : flash("Confirme o status no SARPAS antes de iniciar.")} canStart={canStart} />}
            {view === "execucao" && <ExecutionView mission={mission} calc={calc} progressHa={progressHa} paused={paused} setPaused={setPaused} finishTank={finishTank} onOccurrence={addOccurrence} occurrences={occurrences} />}
            {view === "relatorios" && <ReportsView mission={mission} calc={calc} onMission={downloadMissionDraft} onCsv={downloadOperationalCsv} occurrences={occurrences} />}
            {view === "config" && <SettingsView settings={settings} setSettings={setSettings} onSaved={() => flash("Configuração salva neste dispositivo.")} />}
          </div>

          <nav className={styles.bottomNav} aria-label="Navegação do DroneGestor">
            <BottomButton active={view === "inicio"} icon={<Home size={20} />} label="Início" onClick={() => go("inicio")} />
            <BottomButton active={["nova","calda","estrategia","controle","calibracao","checklist","sarpas","execucao"].includes(view)} icon={<Drone size={20} />} label="Operação" onClick={() => go("nova")} />
            <BottomButton active={view === "seguranca"} icon={<Map size={20} />} label="Mapa" onClick={() => go("seguranca")} />
            <BottomButton active={view === "relatorios"} icon={<FileText size={20} />} label="Dados" onClick={() => go("relatorios")} />
            <BottomButton active={view === "config"} icon={<Settings2 size={20} />} label="Mais" onClick={() => go("config")} />
          </nav>

          {notice && <div className={styles.toast}>{notice}</div>}
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return <div className={styles.brand}><span className={styles.brandIcon}><Drone size={28} /><Leaf size={17} /></span><span><strong>DroneGestor</strong><b>Agro</b></span></div>;
}

type CalcShape = {
  totalCalda: number;
  hectaresPorTanque: number;
  tanquesInteiros: number;
  ultimoTanque: number;
  totalTanques: number;
  velocidadeMs: number;
  vazao: number;
  capacidadeTeorica: number;
  tempoPulverizacaoH: number;
  tempoEstimadoH: number;
  reabastecimentos: number;
  trocasBateria: number;
  paradasMin: number;
  produtos: Array<{ product: Product; amount: ReturnType<typeof amountForProduct> }>;
};

function HomeView({ mission, calc, protocol, modelWeather, go, resetMission }: { mission: Mission; calc: CalcShape; protocol: ReturnType<typeof getTargetProtocol>; modelWeather: ModelWeather | null; go: (view: View) => void; resetMission: () => void }) {
  const hasMission = mission.area > 0;
  return <>
    <div className={styles.weatherCard}>
      <div><CloudSun size={25} /><span><strong>{modelWeather ? `${formatNumber(modelWeather.temperature,1)}°C` : "—"}</strong><small>Modelo meteorológico</small></span></div>
      <div><Wind size={22} /><span><strong>{modelWeather ? `${formatNumber(modelWeather.windSpeed,1)} km/h` : "—"}</strong><small>Vento a 10 m • não é anemômetro</small></span></div>
    </div>

    <Card title="Operação" icon={<ClipboardCheck size={19} />} action={() => go("nova")}>
      <div className={styles.bigMetricRow}>
        <div><strong>{hasMission ? formatNumber(mission.area,1) : "—"}</strong><span>{hasMission ? "ha" : ""}</span><small>{hasMission ? `${mission.cultura || "Cultura"} • ${mission.alvo || "Alvo"}` : "Nenhuma missão preenchida"}</small></div>
        <div className={styles.statusPill}><span /> {hasMission ? "Em preparação" : "Nova missão"}</div>
      </div>
    </Card>

    <Card title="Estratégia" icon={<Leaf size={19} />} action={() => go("estrategia")}>
      <div className={styles.twoColMetrics}>
        <div><small>Gota</small><strong>{hasMission ? protocol.gota : "A definir"}</strong></div>
        <div><small>Protocolo empresa</small><strong>{protocol.companyProtocol ? "Ativo" : "Não definido"}</strong></div>
      </div>
    </Card>

    <Card title="Planejamento" icon={<Gauge size={19} />} action={() => go("controle")}>
      <div className={styles.twoColMetrics}>
        <div><small>Capacidade teórica</small><strong>{calc.capacidadeTeorica > 0 ? `${formatNumber(calc.capacidadeTeorica,1)} ha/h` : "—"}</strong></div>
        <div><small>Tempo com paradas informadas</small><strong>{formatDuration(calc.tempoEstimadoH)}</strong></div>
      </div>
    </Card>

    <h3 className={styles.sectionLabel}>Ações rápidas</h3>
    <div className={styles.quickGrid}>
      <QuickAction icon={<Play />} label="Nova aplicação" onClick={resetMission} />
      <QuickAction icon={<Droplets />} label="Calcular calda" onClick={() => go("calda")} />
      <QuickAction icon={<Gauge />} label="Parâmetros" onClick={() => go("controle")} />
      <QuickAction icon={<FileSpreadsheet />} label="Dados" onClick={() => go("relatorios")} />
    </div>
    <div className={styles.noticeCard}><AlertTriangle size={20}/><p>Esta versão ainda salva os dados no dispositivo. Não trate o app como comprovante oficial até a conexão com o banco de produção estar concluída.</p></div>
  </>;
}

function NewMissionView({ mission, updateMission, updateProduct, addProduct, removeProduct, calc, onNext }: { mission: Mission; updateMission: <K extends keyof Mission>(key: K, value: Mission[K]) => void; updateProduct: (id:string, patch:Partial<Product>)=>void; addProduct:()=>void; removeProduct:(id:string)=>void; calc: CalcShape; onNext: () => void }) {
  return <div className={styles.stack}>
    <StepIndicator active={1} />
    <PanelTitle icon={<Sprout size={20} />} title="Dados da aplicação" text="A missão começa vazia. Preencha apenas dados reais da operação." />
    <div className={styles.formCard}>
      <Field label="Cultura *"><input value={mission.cultura} placeholder="Ex.: Milho" onChange={(e)=>updateMission("cultura",e.target.value)} /></Field>
      <Field label="Alvo *"><input value={mission.alvo} placeholder="Ex.: Cigarrinha" onChange={(e)=>updateMission("alvo",e.target.value)} /></Field>
      <NumberField label="Área do talhão *" value={mission.area} suffix="ha" onChange={(v)=>updateMission("area",v)} />
      <Field label="Drone *"><input value={mission.drone} placeholder="Ex.: DJI Agras T40" onChange={(e)=>updateMission("drone",e.target.value)} /></Field>
      <NumberField label="Volume de aplicação *" value={mission.volume} suffix="L/ha" onChange={(v)=>updateMission("volume",v)} />
      <NumberField label="Capacidade do tanque *" value={mission.tanque} suffix="L" onChange={(v)=>updateMission("tanque",v)} />
      <NumberField label="Faixa *" value={mission.faixa} suffix="m" onChange={(v)=>updateMission("faixa",v)} />
      <NumberField label="Velocidade desejada *" value={mission.velocidadeKmh} suffix="km/h" onChange={(v)=>updateMission("velocidadeKmh",v)} />
      <NumberField label="Altura planejada" value={mission.alturaM} suffix="m" onChange={(v)=>updateMission("alturaM",v)} />
    </div>

    <PanelTitle icon={<Droplets size={20} />} title="Produtos da receita/protocolo" text="O app calcula. Dose e compatibilidade devem vir da receita, bula e orientação técnica." />
    {mission.produtos.map((product,index)=><div className={styles.productCard} key={product.id}>
      <div className={styles.productHead}><strong>Produto {index+1}</strong>{mission.produtos.length>1 && <button onClick={()=>removeProduct(product.id)}>Remover</button>}</div>
      <Field label="Nome"><input value={product.nome} placeholder="Produto comercial" onChange={(e)=>updateProduct(product.id,{nome:e.target.value})}/></Field>
      <Field label="Dose"><div className={styles.doseGrid}><input type="number" step="any" value={product.dose || ""} onChange={(e)=>updateProduct(product.id,{dose:Number(e.target.value)})}/><select value={product.unidade} onChange={(e)=>updateProduct(product.id,{unidade:e.target.value as DoseUnit})}><option>mL/ha</option><option>L/ha</option><option>g/ha</option><option>kg/ha</option><option>mL/100L</option><option>g/100L</option></select></div></Field>
    </div>)}
    <button className={styles.secondaryButton} onClick={addProduct}>+ Adicionar produto</button>

    <PanelTitle icon={<TimerReset size={20} />} title="Tempo operacional" text="Opcional. Informe tempos reais para uma previsão melhor do que um percentual fixo." />
    <div className={styles.formCard}>
      <NumberField label="Abastecimento" value={mission.tempoAbastecimentoMin} suffix="min/parada" onChange={(v)=>updateMission("tempoAbastecimentoMin",v)} />
      <NumberField label="Troca de bateria" value={mission.tempoTrocaBateriaMin} suffix="min" onChange={(v)=>updateMission("tempoTrocaBateriaMin",v)} />
      <NumberField label="Tanques por bateria" value={mission.tanquesPorBateria} suffix="tanques" onChange={(v)=>updateMission("tanquesPorBateria",v)} />
      <NumberField label="Deslocamento" value={mission.tempoDeslocamentoMin} suffix="min" onChange={(v)=>updateMission("tempoDeslocamentoMin",v)} />
      <NumberField label="Bordadura" value={mission.tempoBordaduraMin} suffix="min" onChange={(v)=>updateMission("tempoBordaduraMin",v)} />
    </div>
    <div className={styles.summaryCard}><span>Resumo</span><div><small>Calda</small><strong>{calc.totalCalda>0?`${formatNumber(calc.totalCalda,0)} L`:"—"}</strong></div><div><small>Tempo estimado</small><strong>{formatDuration(calc.tempoEstimadoH)}</strong></div></div>
    <PrimaryButton onClick={onNext}>Calcular missão <ChevronRight size={18}/></PrimaryButton>
  </div>;
}

function CaldaView({ mission, calc, onNext }: { mission: Mission; calc: CalcShape; onNext: () => void }) {
  return <div className={styles.stack}>
    <StepIndicator active={2} />
    <PanelTitle icon={<Calculator size={20}/>} title="Cálculo de calda" text="Resultado matemático com base nos dados e doses informados pelo piloto." />
    <div className={styles.resultGrid}>
      <ResultCard icon={<Droplets/>} label="Calda total" value={calc.totalCalda>0?`${formatNumber(calc.totalCalda,1)} L`:"—"}/>
      <ResultCard icon={<Route/>} label="Área por tanque" value={calc.hectaresPorTanque>0?`${formatNumber(calc.hectaresPorTanque,2)} ha`:"—"}/>
      <ResultCard icon={<RotateCcw/>} label="Tanques" value={calc.totalTanques?String(calc.totalTanques):"—"} detail={calc.ultimoTanque>0?`Último: ${formatNumber(calc.ultimoTanque,1)} L`:undefined}/>
      <ResultCard icon={<Gauge/>} label="Vazão calculada" value={calc.vazao>0?`${formatNumber(calc.vazao,2)} L/min`:"—"}/>
    </div>
    {calc.produtos.map(({product,amount})=><div className={styles.productResult} key={product.id}><div><small>{product.nome||"Produto sem nome"}</small><strong>{product.dose||0} {product.unidade}</strong></div><div><small>Total</small><strong>{formatNumber(amount.total.value,3)} {amount.total.unit}</strong></div><div><small>Por tanque cheio</small><strong>{formatNumber(amount.tank.value,3)} {amount.tank.unit}</strong></div></div>)}
    <div className={styles.noticeCard}><AlertTriangle size={20}/><p>Quantidade calculada não é recomendação agronômica. Confirme receita, bula, compatibilidade e ordem de mistura.</p></div>
    <PrimaryButton onClick={onNext}>Ver estratégia <ChevronRight size={18}/></PrimaryButton>
  </div>;
}

function StrategyView({ mission, protocol, mandatory, accepted, setAccepted, onNext }: { mission: Mission; protocol: ReturnType<typeof getTargetProtocol>; mandatory:boolean; accepted:boolean; setAccepted:(v:boolean)=>void; onNext:()=>void }) {
  return <div className={styles.stack}>
    <StepIndicator active={3}/>
    <div className={styles.targetCard}><div><Sprout size={23}/><span><small>Cultura</small><strong>{mission.cultura||"—"}</strong></span></div><div><Target size={23}/><span><small>Alvo</small><strong>{mission.alvo||"—"}</strong></span></div></div>
    <ResultList icon={<Droplets/>} label="Tamanho de gota" value={protocol.gota}/>
    <ResultList icon={<Route/>} label="Estratégia" value={protocol.estrategia}/>
    <ResultList icon={<TimerReset/>} label="Janela" value={protocol.janela}/>
    <div className={styles.insightCard}><Sparkles size={24}/><div><strong>{protocol.companyProtocol?"Insight da empresa":"Orientação do sistema"}</strong><p>{protocol.insight}</p></div></div>
    <label className={styles.confirmRow}><input type="checkbox" checked={accepted} onChange={(e)=>setAccepted(e.target.checked)}/><span><strong>{mandatory?"Confirmação obrigatória da empresa":"Confirmar leitura"}</strong><small>Li a orientação e vou conferir produto, bula, receita e protocolo técnico.</small></span></label>
    <PrimaryButton disabled={mandatory&&!accepted} onClick={onNext}>Analisar segurança <ChevronRight size={18}/></PrimaryButton>
  </div>;
}

function SafetyView({ mission, settings, modelWeather, risk, accepted, setAccepted, updateMission, onNext }: { mission:Mission; settings:CompanySettings; modelWeather:ModelWeather|null; risk:{level:"warning"|"safe";label:string}; accepted:boolean; setAccepted:(v:boolean)=>void; updateMission:<K extends keyof Mission>(key:K,value:Mission[K])=>void; onNext:()=>void }) {
  const mapUrl = modelWeather ? (()=>{
    const d=.003;
    const w=modelWeather.longitude-d;
    const e=modelWeather.longitude+d;
    const s=modelWeather.latitude-d;
    const n=modelWeather.latitude+d;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${w}%2C${s}%2C${e}%2C${n}&layer=mapnik&marker=${modelWeather.latitude}%2C${modelWeather.longitude}`;
  })() : null;
  return <div className={styles.stack}>
    <div className={styles.realMap}>{mapUrl?<iframe title="Mapa real do ponto GPS" src={mapUrl}/>:<div className={styles.mapEmpty}><MapPin size={30}/><strong>GPS ainda não capturado</strong><small>Use o botão Clima + GPS para registrar o ponto real.</small></div>}</div>
    <div className={styles.mapCaption}><strong>Mapa real do ponto GPS</strong><small>O polígono do talhão e buffers automáticos ainda serão conectados. A distância abaixo é informada pelo piloto.</small></div>
    <div className={styles.legendCard}>
      <Legend color="amber" label="Margem preventiva interna da empresa" value={`${settings.margemPreventiva} m`}/>
      <Legend color="green" label="Distância informada da área sensível" value={mission.distanciaSensivel?`${mission.distanciaSensivel} m`:"Pendente"}/>
      <div className={styles.legalAuto}><ShieldCheck size={17}/><span><small>Regra legal</small><strong>Automática por UF/produto — motor regulatório ainda não conectado</strong></span></div>
    </div>
    <div className={`${styles.riskCard} ${styles[risk.level]}`}><AlertTriangle size={23}/><div><strong>{risk.label}</strong><p>A margem da empresa não substitui a regra legal nem as restrições do produto. Distância isolada também não elimina deriva.</p></div></div>

    <PanelTitle icon={<Wind size={20}/>} title="Medição de campo" text="Informe a medição feita no talhão. Não use a previsão meteorológica como substituta do anemômetro/medição local." />
    <div className={styles.formCard}>
      <NumberField label="Distância da área sensível" value={mission.distanciaSensivel} suffix="m" onChange={(v)=>updateMission("distanciaSensivel",v)}/>
      <NumberField label="Vento medido" value={mission.ventoCampoKmh} suffix="km/h" onChange={(v)=>updateMission("ventoCampoKmh",v)}/>
      <Field label="Direção do vento"><input value={mission.direcaoVentoCampo} placeholder="Ex.: NE → SO" onChange={(e)=>updateMission("direcaoVentoCampo",e.target.value)}/></Field>
      <NumberField label="Temperatura medida" value={mission.temperaturaCampo} suffix="°C" onChange={(v)=>updateMission("temperaturaCampo",v)}/>
      <NumberField label="Umidade medida" value={mission.umidadeCampo} suffix="%" onChange={(v)=>updateMission("umidadeCampo",v)}/>
    </div>
    {modelWeather && <div className={styles.modelWeather}><CloudSun size={21}/><div><strong>Modelo meteorológico do ponto</strong><small>{formatNumber(modelWeather.temperature,1)}°C • UR {formatNumber(modelWeather.humidity,0)}% • vento a 10 m {formatNumber(modelWeather.windSpeed,1)} km/h • rajada {formatNumber(modelWeather.windGust,1)} km/h • chuva {formatNumber(modelWeather.precipitation,1)} mm</small></div></div>}
    <label className={styles.confirmRow}><input type="checkbox" checked={accepted} onChange={(e)=>setAccepted(e.target.checked)}/><span><strong>Confirmar análise de risco</strong><small>Conferi a medição de campo, área sensível e protocolo aplicável.</small></span></label>
    <PrimaryButton disabled={settings.exigirConfirmacao&&!accepted} onClick={onNext}>Gerar parâmetros-base <ChevronRight size={18}/></PrimaryButton>
  </div>;
}

function ControlView({ mission, calc, protocol, onCopy, onNext }: { mission:Mission; calc:CalcShape; protocol:ReturnType<typeof getTargetProtocol>; onCopy:()=>void; onNext:()=>void }) {
  return <div className={styles.stack}>
    <div className={styles.releaseBanner}><AlertTriangle size={20}/><span><strong>Parâmetros calculados — ainda não liberados para voo</strong><small>Depois desta tela ainda há calibração, checklist e SARPAS.</small></span></div>
    <div className={styles.controlGrid}>
      <ControlMetric icon={<Gauge/>} label="Velocidade" value={calc.velocidadeMs?formatNumber(calc.velocidadeMs,1):"—"} suffix="m/s" detail={mission.velocidadeKmh?`${formatNumber(mission.velocidadeKmh,1)} km/h`:undefined}/>
      <ControlMetric icon={<Droplets/>} label="Volume" value={mission.volume?formatNumber(mission.volume,1):"—"} suffix="L/ha"/>
      <ControlMetric icon={<Route/>} label="Faixa" value={mission.faixa?formatNumber(mission.faixa,1):"—"} suffix="m"/>
      <ControlMetric icon={<Sparkles/>} label="Vazão" value={calc.vazao?formatNumber(calc.vazao,2):"—"} suffix="L/min"/>
    </div>
    <div className={styles.smallMetricGrid}>
      <div><small>Gota</small><strong>{protocol.gota}</strong></div>
      <div><small>Capacidade teórica</small><strong>{calc.capacidadeTeorica?`${formatNumber(calc.capacidadeTeorica,1)} ha/h`:"—"}</strong></div>
      <div><small>Tempo estimado</small><strong>{formatDuration(calc.tempoEstimadoH)}</strong></div>
    </div>
    <div className={styles.insightCard}><Compass size={23}/><div><strong>Conferência no controle</strong><p>Use estes números como base de cálculo. O ajuste final precisa respeitar equipamento, produto, bula, RT, condições reais e protocolo da empresa.</p></div></div>
    <PrimaryButton onClick={onNext}>Ir para calibração <ChevronRight size={18}/></PrimaryButton>
    <button className={styles.secondaryButton} onClick={onCopy}>Copiar parâmetros-base</button>
  </div>;
}

function CalibrationView({ calibration, setCalibration, onNext }: { calibration:CalibrationState; setCalibration:(v:CalibrationState)=>void; onNext:()=>void }) {
  return <div className={styles.stack}>
    <PanelTitle icon={<Wrench size={21}/>} title="Calibração antes da aplicação" text="Sequência operacional cadastrada no treinamento da equipe." />
    <CheckTask index="1" title="Eliminar o ar do sistema" detail="Faça a liberação de ar antes de calibrar os componentes." checked={calibration.ar} onChange={(v)=>setCalibration({...calibration,ar:v,fluxometro:v?calibration.fluxometro:false,bomba:v?calibration.bomba:false})}/>
    <CheckTask index="2" title="Calibrar o fluxômetro" detail="Só avance depois da etapa 1." checked={calibration.fluxometro} disabled={!calibration.ar} onChange={(v)=>setCalibration({...calibration,fluxometro:v,bomba:v?calibration.bomba:false})}/>
    <CheckTask index="3" title="Calibrar a bomba" detail="Última etapa da sequência cadastrada." checked={calibration.bomba} disabled={!calibration.fluxometro} onChange={(v)=>setCalibration({...calibration,bomba:v})}/>
    <div className={styles.noticeCard}><AlertTriangle size={20}/><p>O app registra a confirmação do procedimento; ele não verifica fisicamente se a calibração foi executada corretamente.</p></div>
    <PrimaryButton disabled={!(calibration.ar&&calibration.fluxometro&&calibration.bomba)} onClick={onNext}>Abrir checklist <ChevronRight size={18}/></PrimaryButton>
  </div>;
}

function ChecklistView({ checklist, setChecklist, onNext }: { checklist:ChecklistState; setChecklist:(v:ChecklistState)=>void; onNext:()=>void }) {
  const items:Array<[keyof ChecklistState,string,string]> = [
    ["area","Área e decolagem","Área de operação conferida e ponto de decolagem seguro."],
    ["pessoasAnimais","Pessoas e animais","Sem pessoas ou animais expostos na área operacional."],
    ["obstaculos","Obstáculos e rede elétrica","Árvores, postes, fios, edificações, água e áreas sensíveis conferidos."],
    ["drone","Drone","Estrutura, braços, motores, hélices, sensores e trem de pouso conferidos."],
    ["controle","Controle e navegação","Controle, bateria, missão, mapa, conexão/RTK quando aplicável conferidos."],
    ["pulverizacao","Sistema de pulverização","Tanque, mangueiras, filtros, atomizadores/bicos, bomba e fluxômetro conferidos."],
    ["clima","Medição climática","Vento, direção, temperatura e umidade medidos no talhão."],
    ["documentos","Documentos","Receita/protocolo, documentos da operação e autorizações aplicáveis conferidos."]
  ];
  const done=Object.values(checklist).filter(Boolean).length;
  return <div className={styles.stack}>
    <PanelTitle icon={<ClipboardCheck size={21}/>} title="Checklist pré-voo" text={`${done} de ${items.length} itens confirmados.`}/>
    {items.map(([key,title,detail])=><CheckTask key={key} title={title} detail={detail} checked={checklist[key]} onChange={(v)=>setChecklist({...checklist,[key]:v})}/>) }
    <PrimaryButton disabled={!Object.values(checklist).every(Boolean)} onClick={onNext}>Ir para SARPAS <ChevronRight size={18}/></PrimaryButton>
  </div>;
}

function SarpasView({ mission, updateMission, onNext, canStart }: { mission:Mission; updateMission:<K extends keyof Mission>(key:K,value:Mission[K])=>void; onNext:()=>void; canStart:boolean }) {
  return <div className={styles.stack}>
    <PanelTitle icon={<ShieldCheck size={21}/>} title="Confirmação SARPAS" text="A solicitação é feita no sistema oficial do DECEA. O DroneGestor apenas organiza e registra a referência informada pelo piloto." />
    <a className={styles.externalButton} href="https://servicos.decea.mil.br/sarpas/?login=1" target="_blank" rel="noreferrer"><Compass size={19}/> Abrir SARPAS oficial</a>
    <div className={styles.formCard}><Field label="Nº/Referência"><input value={mission.sarpasNumero} placeholder="Informe a referência da solicitação" onChange={(e)=>updateMission("sarpasNumero",e.target.value)}/></Field></div>
    <label className={styles.confirmRow}><input type="checkbox" checked={mission.sarpasConfirmado} onChange={(e)=>updateMission("sarpasConfirmado",e.target.checked)}/><span><strong>Confirmo que consultei o SARPAS</strong><small>Marque somente após verificar no sistema oficial que a operação está de acordo com a autorização/condição aplicável.</small></span></label>
    <div className={styles.noticeCard}><AlertTriangle size={20}/><p>O DroneGestor não envia nem aprova solicitações no SARPAS nesta versão.</p></div>
    <PrimaryButton disabled={!mission.sarpasConfirmado||!canStart} onClick={onNext}><Play size={18}/> Iniciar operação</PrimaryButton>
  </div>;
}

function ExecutionView({ mission, calc, progressHa, paused, setPaused, finishTank, onOccurrence, occurrences }: { mission:Mission; calc:CalcShape; progressHa:number; paused:boolean; setPaused:(v:boolean)=>void; finishTank:()=>void; onOccurrence:()=>void; occurrences:Occurrence[] }) {
  const percent=mission.area>0?Math.min(100,(progressHa/mission.area)*100):0;
  const currentTank=Math.min(calc.totalTanques||1,Math.max(1,Math.ceil(progressHa/Math.max(calc.hectaresPorTanque,.01))+1));
  const remaining=Math.max(0,mission.area-progressHa);
  const remainingHours=calc.capacidadeTeorica>0?remaining/calc.capacidadeTeorica:0;
  return <div className={styles.stack}>
    <div className={styles.missionProgressCard}><span>Aplicação em andamento</span><small>{mission.cultura} • {mission.alvo}</small><div className={styles.progressHeading}><strong>{formatNumber(percent,0)}%</strong><span>{formatNumber(progressHa,1)} de {formatNumber(mission.area,1)} ha</span></div><div className={styles.progressTrack}><span style={{width:`${percent}%`}}/></div></div>
    <ResultList icon={<RotateCcw/>} label="Tanque" value={`${currentTank} de ${calc.totalTanques||0}`}/>
    <ResultList icon={<Map/>} label="Área restante" value={`${formatNumber(remaining,1)} ha`}/>
    <ResultList icon={<TimerReset/>} label="Tempo de pulverização restante (teórico)" value={formatDuration(remainingHours)}/>
    <ResultList icon={<AlertTriangle/>} label="Ocorrências locais" value={`${occurrences.length}`}/>
    <div className={styles.quickGrid}><QuickAction icon={paused?<Play/>:<Pause/>} label={paused?"Retomar":"Pausar"} onClick={()=>setPaused(!paused)}/><QuickAction icon={<AlertTriangle/>} label="Anotar ocorrência" onClick={onOccurrence}/><QuickAction icon={<FileText/>} label="Imprimir tela" onClick={()=>window.print()}/><QuickAction icon={<Check/>} label="Finalizar tanque" onClick={finishTank}/></div>
  </div>;
}

function ReportsView({ mission, calc, onMission, onCsv, occurrences }: { mission:Mission; calc:CalcShape; onMission:()=>void; onCsv:()=>void; occurrences:Occurrence[] }) {
  return <div className={styles.stack}>
    <PanelTitle icon={<FileText size={21}/>} title="Dados da operação" text="Rascunhos para conferência. Nesta versão ainda não são relatórios oficiais nem comprovantes de envio." />
    <div className={styles.completedCard}><span><Check size={18}/> Missão local</span><strong>{mission.cultura||"Sem cultura"} • {formatNumber(mission.area,1)} ha</strong><small>{formatNumber(calc.totalCalda,0)} L de calda • {occurrences.length} ocorrência(s)</small></div>
    <ReportAction icon={<FileText/>} title="Rascunho da operação" detail="Resumo dos parâmetros, clima medido e confirmações." badge="Rascunho" onClick={onMission}/>
    <ReportAction icon={<FileSpreadsheet/>} title="Dados operacionais CSV" detail="Exportação simples para conferência e futura consolidação." badge="CSV" onClick={onCsv}/>
    <ReportAction icon={<ShieldCheck/>} title="Imprimir tela" detail="Imprime somente o conteúdo visível; não é dossiê oficial." badge="Local" onClick={()=>window.print()}/>
    <div className={styles.insightCard}><FileSpreadsheet size={23}/><div><strong>Relatório MAPA</strong><p>O relatório oficial mensal será habilitado quando o histórico estiver ligado ao banco e ao modelo oficial vigente. Não chamamos este CSV de relatório MAPA.</p></div></div>
  </div>;
}

function SettingsView({ settings, setSettings, onSaved }: { settings:CompanySettings; setSettings:(v:CompanySettings)=>void; onSaved:()=>void }) {
  const update=<K extends keyof CompanySettings>(key:K,value:CompanySettings[K])=>setSettings({...settings,[key]:value});
  return <div className={styles.stack}>
    <div className={styles.companyActive}><ShieldCheck size={26}/><div><strong>Configuração local da empresa</strong><small>Salva neste dispositivo até a conexão com o banco de produção.</small></div></div>
    <ToggleRow label="Insights de campo obrigatórios" detail="Bloqueia o avanço enquanto o piloto não confirmar a orientação." checked={settings.insightsObrigatorios} onChange={(v)=>update("insightsObrigatorios",v)}/>
    <SettingNumber label="Margem preventiva interna" value={settings.margemPreventiva} suffix="m" onChange={(v)=>update("margemPreventiva",Math.max(0,v))}/>
    <ToggleRow label="Exigir confirmação de risco" detail="O piloto precisa confirmar a análise antes da sequência pré-voo." checked={settings.exigirConfirmacao} onChange={(v)=>update("exigirConfirmacao",v)}/>
    <ToggleRow label="Bordadura para cigarrinha (padrão interno)" detail="Ative somente se esse protocolo tiver sido aprovado pela empresa/RT." checked={settings.protocoloBordaduraCigarrinha} onChange={(v)=>update("protocoloBordaduraCigarrinha",v)}/>
    <div className={styles.readOnlySetting}><Compass size={20}/><span><strong>Regra legal por UF</strong><small>Não é editável pelo piloto. Será preenchida pelo motor regulatório com fonte e versão.</small></span><b>Em implantação</b></div>
    <div className={styles.readOnlySetting}><Route size={20}/><span><strong>Protocolos por cultura/alvo/produto</strong><small>Não há gota ou dose universal gravada como recomendação automática.</small></span><b>Em implantação</b></div>
    <PrimaryButton onClick={onSaved}><Check size={18}/> Salvar configuração local</PrimaryButton>
  </div>;
}

function Card({ title, icon, action, children }: { title:string; icon:ReactNode; action?:()=>void; children:ReactNode }) { return <section className={styles.card}><button className={styles.cardHead} onClick={action}>{icon}<strong>{title}</strong>{action&&<ChevronRight size={18}/>}</button>{children}</section>; }
function QuickAction({ icon, label, onClick }: { icon:ReactNode; label:string; onClick:()=>void }) { return <button className={styles.quickButton} onClick={onClick}>{icon}<span>{label}</span><ChevronRight size={17}/></button>; }
function BottomButton({ active, icon, label, onClick }: { active:boolean; icon:ReactNode; label:string; onClick:()=>void }) { return <button className={active?styles.bottomActive:""} onClick={onClick}>{icon}<span>{label}</span></button>; }
function StepIndicator({ active }: { active:number }) { return <div className={styles.steps}>{[1,2,3,4].map(step=><span key={step} className={step<=active?styles.stepActive:""}>{step}</span>)}</div>; }
function PanelTitle({ icon, title, text }: { icon:ReactNode; title:string; text:string }) { return <div className={styles.panelTitle}>{icon}<div><strong>{title}</strong><p>{text}</p></div></div>; }
function Field({ label, children }: { label:string; children:ReactNode }) { return <label className={styles.field}><span>{label}</span>{children}</label>; }
function NumberField({ label, value, suffix, onChange }: { label:string; value:number; suffix:string; onChange:(v:number)=>void }) { return <label className={styles.field}><span>{label}</span><div className={styles.numberInput}><input type="number" step="any" value={value||""} onChange={(e)=>onChange(Number(e.target.value))}/><b>{suffix}</b></div></label>; }
function ResultCard({ icon, label, value, detail }: { icon:ReactNode; label:string; value:string; detail?:string }) { return <div className={styles.resultCard}>{icon}<small>{label}</small><strong>{value}</strong>{detail&&<span>{detail}</span>}</div>; }
function ResultList({ icon, label, value }: { icon:ReactNode; label:string; value:string }) { return <div className={styles.resultList}>{icon}<span><small>{label}</small><strong>{value}</strong></span></div>; }
function ControlMetric({ icon, label, value, suffix, detail }: { icon:ReactNode; label:string; value:string; suffix:string; detail?:string }) { return <div className={styles.controlMetric}>{icon}<small>{label}</small><strong>{value}</strong><span>{suffix}</span>{detail&&<b>{detail}</b>}</div>; }
function PrimaryButton({ children, onClick, disabled=false }: { children:ReactNode; onClick:()=>void; disabled?:boolean }) { return <button className={styles.primaryButton} onClick={onClick} disabled={disabled}>{children}</button>; }
function Legend({ color, label, value }: { color:"amber"|"green"; label:string; value:string }) { return <div className={styles.legend}><span className={styles[color]}/><small>{label}</small><strong>{value}</strong></div>; }
function ToggleRow({ label, detail, checked, onChange }: { label:string; detail:string; checked:boolean; onChange:(v:boolean)=>void }) { return <div className={styles.settingRow}><span><strong>{label}</strong><small>{detail}</small></span><button className={`${styles.toggle} ${checked?styles.toggleOn:""}`} onClick={()=>onChange(!checked)} aria-pressed={checked}><i/></button></div>; }
function SettingNumber({ label, value, suffix, onChange }: { label:string; value:number; suffix:string; onChange:(v:number)=>void }) { return <label className={styles.settingRow}><span><strong>{label}</strong><small>É margem interna, não regra legal.</small></span><div className={styles.settingInput}><input type="number" value={value} onChange={(e)=>onChange(Number(e.target.value))}/><b>{suffix}</b></div></label>; }
function ReportAction({ icon, title, detail, badge, onClick }: { icon:ReactNode; title:string; detail:string; badge:string; onClick:()=>void }) { return <button className={styles.reportAction} onClick={onClick}>{icon}<span><strong>{title}</strong><small>{detail}</small></span><b>{badge}</b><Download size={18}/></button>; }
function CheckTask({ index, title, detail, checked, disabled=false, onChange }: { index?:string; title:string; detail:string; checked:boolean; disabled?:boolean; onChange:(v:boolean)=>void }) { return <label className={`${styles.checkTask} ${disabled?styles.taskDisabled:""}`}><span className={styles.taskIndex}>{checked?<Check size={17}/>:index||""}</span><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(e)=>onChange(e.target.checked)}/></label>; }
