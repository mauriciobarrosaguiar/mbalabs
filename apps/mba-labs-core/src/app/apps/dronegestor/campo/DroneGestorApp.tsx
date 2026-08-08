"use client";

import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
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
  Wind
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./dronegestor.module.css";

type View =
  | "inicio"
  | "nova"
  | "calda"
  | "estrategia"
  | "seguranca"
  | "controle"
  | "execucao"
  | "relatorios"
  | "config";

type Mission = {
  cultura: string;
  alvo: string;
  area: number;
  drone: string;
  volume: number;
  tanque: number;
  doseMlHa: number;
  faixa: number;
  velocidadeKmh: number;
  ventoKmh: number;
  direcaoVento: string;
  temperatura: number;
  umidade: number;
  distanciaSensivel: number;
};

type CompanySettings = {
  insightsObrigatorios: boolean;
  margemPreventiva: number;
  limiteLegalReferencia: number;
  exigirConfirmacao: boolean;
  eficienciaOperacional: number;
  protocoloBordaduraCigarrinha: boolean;
};

const initialMission: Mission = {
  cultura: "Milho",
  alvo: "Cigarrinha",
  area: 62,
  drone: "DJI Agras T40",
  volume: 10,
  tanque: 40,
  doseMlHa: 500,
  faixa: 8,
  velocidadeKmh: 18,
  ventoKmh: 7,
  direcaoVento: "NE → SO",
  temperatura: 27,
  umidade: 68,
  distanciaSensivel: 96
};

const initialSettings: CompanySettings = {
  insightsObrigatorios: true,
  margemPreventiva: 90,
  limiteLegalReferencia: 20,
  exigirConfirmacao: true,
  eficienciaOperacional: 74,
  protocoloBordaduraCigarrinha: true
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
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function getTargetProtocol(target: string) {
  const normalized = target.toLowerCase();

  if (normalized.includes("cigarrinha")) {
    return {
      gota: "Média",
      micras: 250,
      janela: "Final da tarde",
      estrategia: "Iniciar pela bordadura e depois avançar para as faixas internas.",
      insight:
        "Inseto móvel: use o protocolo de contenção por perímetro quando ele estiver validado pelo responsável técnico da operação."
    };
  }

  return {
    gota: "Conforme protocolo",
    micras: 0,
    janela: "Validar clima + bula",
    estrategia: "Usar o protocolo técnico cadastrado para cultura, alvo e produto.",
    insight: "Confirme bula, receituário e orientação do responsável técnico antes de liberar os parâmetros."
  };
}

export function DroneGestorApp({ userName }: { userName: string }) {
  const [view, setView] = useState<View>("inicio");
  const [mission, setMission] = useState<Mission>(initialMission);
  const [settings, setSettings] = useState<CompanySettings>(initialSettings);
  const [insightAccepted, setInsightAccepted] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [progressHa, setProgressHa] = useState(12.4);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const savedMission = localStorage.getItem("dronegestor:mission");
      const savedSettings = localStorage.getItem("dronegestor:settings");
      if (savedMission) setMission({ ...initialMission, ...JSON.parse(savedMission) });
      if (savedSettings) setSettings({ ...initialSettings, ...JSON.parse(savedSettings) });
    } catch {
      // Dados locais inválidos não impedem o uso do copiloto.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("dronegestor:mission", JSON.stringify(mission));
  }, [mission]);

  useEffect(() => {
    localStorage.setItem("dronegestor:settings", JSON.stringify(settings));
  }, [settings]);

  const calc = useMemo(() => {
    const totalCalda = mission.area * mission.volume;
    const produtoTotalL = (mission.area * mission.doseMlHa) / 1000;
    const hectaresPorTanque = mission.volume > 0 ? mission.tanque / mission.volume : 0;
    const tanquesExatos = mission.tanque > 0 ? totalCalda / mission.tanque : 0;
    const tanquesInteiros = Math.floor(tanquesExatos);
    const ultimoTanque = totalCalda - tanquesInteiros * mission.tanque;
    const produtoPorTanqueL = (hectaresPorTanque * mission.doseMlHa) / 1000;
    const velocidadeMs = mission.velocidadeKmh / 3.6;
    const vazao = (mission.volume * mission.velocidadeKmh * mission.faixa) / 600;
    const capacidadeTeorica = (mission.velocidadeKmh * mission.faixa) / 10;
    const capacidadeEfetiva = capacidadeTeorica * (settings.eficienciaOperacional / 100);
    const tempoEstimadoH = capacidadeEfetiva > 0 ? mission.area / capacidadeEfetiva : 0;
    const hectaresEm5h = capacidadeEfetiva * 5;
    const totalTanques = Math.ceil(tanquesExatos);

    return {
      totalCalda,
      produtoTotalL,
      hectaresPorTanque,
      tanquesInteiros,
      ultimoTanque,
      produtoPorTanqueL,
      velocidadeMs,
      vazao,
      capacidadeTeorica,
      capacidadeEfetiva,
      tempoEstimadoH,
      hectaresEm5h,
      totalTanques
    };
  }, [mission, settings.eficienciaOperacional]);

  const protocol = useMemo(() => getTargetProtocol(mission.alvo), [mission.alvo]);

  const risk = useMemo(() => {
    if (mission.distanciaSensivel < settings.limiteLegalReferencia) {
      return { level: "danger" as const, label: "Abaixo da referência legal cadastrada" };
    }
    if (mission.distanciaSensivel < settings.margemPreventiva) {
      return { level: "warning" as const, label: "Dentro da margem preventiva da empresa" };
    }
    if (mission.ventoKmh >= 12) {
      return { level: "warning" as const, label: "Vento elevado para o protocolo cadastrado" };
    }
    return { level: "safe" as const, label: "Fora da margem preventiva cadastrada" };
  }, [mission.distanciaSensivel, mission.ventoKmh, settings]);

  const canRelease =
    (!settings.insightsObrigatorios || insightAccepted) && (!settings.exigirConfirmacao || riskAccepted);

  function updateMission<K extends keyof Mission>(key: K, value: Mission[K]) {
    setMission((current) => ({ ...current, [key]: value }));
    if (["alvo", "cultura", "ventoKmh", "distanciaSensivel"].includes(String(key))) {
      setInsightAccepted(false);
      setRiskAccepted(false);
    }
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
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

  function downloadMissionReport() {
    const report = [
      "DRONEGESTOR AGRO - RELATÓRIO DA MISSÃO",
      "",
      `Cultura: ${mission.cultura}`,
      `Alvo: ${mission.alvo}`,
      `Área: ${mission.area} ha`,
      `Drone: ${mission.drone}`,
      `Volume de aplicação: ${mission.volume} L/ha`,
      `Dose informada: ${mission.doseMlHa} mL/ha`,
      `Calda calculada: ${round(calc.totalCalda, 1)} L`,
      `Produto calculado: ${round(calc.produtoTotalL, 2)} L`,
      `Velocidade: ${round(calc.velocidadeMs, 2)} m/s (${mission.velocidadeKmh} km/h)`,
      `Faixa: ${mission.faixa} m`,
      `Vazão calculada: ${round(calc.vazao, 2)} L/min`,
      `Vento: ${mission.ventoKmh} km/h - ${mission.direcaoVento}`,
      `Temperatura: ${mission.temperatura} °C`,
      `Umidade: ${mission.umidade}%`,
      `Margem preventiva da empresa: ${settings.margemPreventiva} m`,
      `Distância da área sensível: ${mission.distanciaSensivel} m`,
      `Estratégia: ${protocol.estrategia}`,
      "",
      "Observação: parâmetros agronômicos devem ser conferidos com bula, receituário e responsável técnico."
    ].join("\n");
    downloadText("dronegestor-relatorio-missao.txt", report);
    flash("Relatório da missão gerado.");
  }

  function downloadMapaCsv() {
    const header = [
      "data",
      "cultura",
      "alvo",
      "area_ha",
      "drone",
      "volume_l_ha",
      "dose_ml_ha",
      "calda_l",
      "velocidade_kmh",
      "faixa_m",
      "vazao_l_min",
      "vento_kmh",
      "temperatura_c",
      "umidade_pct"
    ];
    const row = [
      new Date().toLocaleDateString("pt-BR"),
      mission.cultura,
      mission.alvo,
      mission.area,
      mission.drone,
      mission.volume,
      mission.doseMlHa,
      round(calc.totalCalda, 1),
      mission.velocidadeKmh,
      mission.faixa,
      round(calc.vazao, 2),
      mission.ventoKmh,
      mission.temperatura,
      mission.umidade
    ];
    downloadText(
      "dronegestor-preenchimento-mensal.csv",
      `${header.join(";")}\n${row.join(";")}`,
      "text/csv;charset=utf-8"
    );
    flash("Pré-preenchimento mensal exportado.");
  }

  function finishTank() {
    const next = Math.min(mission.area, progressHa + calc.hectaresPorTanque);
    setProgressHa(round(next, 1));
    flash(next >= mission.area ? "Aplicação concluída." : "Tanque finalizado e progresso atualizado.");
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
    controle: "Configuração do controle",
    execucao: "Operação em andamento",
    relatorios: "Relatórios e comprovação",
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
          <div className={styles.brandFeature}><BarChart3 size={18} /> Eficiência</div>
          <div className={styles.brandFeature}><ShieldCheck size={18} /> Segurança</div>
          <div className={styles.brandFeature}><Leaf size={18} /> Produtividade</div>
        </aside>

        <div className={styles.phone}>
          <header className={styles.topbar}>
            <button className={styles.iconButton} onClick={() => (view === "inicio" ? flash("Menu do DroneGestor") : go("inicio"))}>
              {view === "inicio" ? <Menu size={22} /> : <ArrowLeft size={22} />}
            </button>
            <div>
              <span className={styles.topbarEyebrow}>{view === "inicio" ? `Bom dia, ${userName.split(" ")[0]}` : "DroneGestor Agro"}</span>
              <strong>{titleByView[view]}</strong>
            </div>
            <button className={styles.iconButton} onClick={() => go("config")} aria-label="Configurações">
              <Settings2 size={21} />
            </button>
          </header>

          <div className={styles.content}>
            {view === "inicio" && (
              <HomeView
                mission={mission}
                calc={calc}
                protocol={protocol}
                go={go}
              />
            )}

            {view === "nova" && (
              <NewMissionView mission={mission} updateMission={updateMission} calc={calc} onNext={() => go("calda")} />
            )}

            {view === "calda" && (
              <CaldaView mission={mission} calc={calc} onNext={() => go("estrategia")} />
            )}

            {view === "estrategia" && (
              <StrategyView
                mission={mission}
                protocol={protocol}
                mandatory={settings.insightsObrigatorios}
                accepted={insightAccepted}
                setAccepted={setInsightAccepted}
                onNext={() => go("seguranca")}
              />
            )}

            {view === "seguranca" && (
              <SafetyView
                mission={mission}
                settings={settings}
                risk={risk}
                accepted={riskAccepted}
                setAccepted={setRiskAccepted}
                updateMission={updateMission}
                onNext={() => go("controle")}
              />
            )}

            {view === "controle" && (
              <ControlView
                mission={mission}
                calc={calc}
                protocol={protocol}
                canRelease={canRelease}
                onCopy={() => {
                  const text = `${formatNumber(calc.velocidadeMs, 1)} m/s | ${mission.volume} L/ha | ${mission.faixa} m | ${formatNumber(calc.vazao, 2)} L/min`;
                  navigator.clipboard?.writeText(text);
                  flash("Parâmetros copiados.");
                }}
                onStart={() => {
                  if (!canRelease) {
                    flash("Confirme os insights e a análise de risco antes de iniciar.");
                    return;
                  }
                  setProgressHa(0);
                  go("execucao");
                }}
              />
            )}

            {view === "execucao" && (
              <ExecutionView
                mission={mission}
                calc={calc}
                progressHa={progressHa}
                paused={paused}
                setPaused={setPaused}
                finishTank={finishTank}
                onOccurrence={() => flash("Ocorrência registrada na missão.")}
              />
            )}

            {view === "relatorios" && (
              <ReportsView mission={mission} calc={calc} onMission={downloadMissionReport} onCsv={downloadMapaCsv} />
            )}

            {view === "config" && (
              <SettingsView settings={settings} setSettings={setSettings} onSaved={() => flash("Padrão da empresa salvo.")} />
            )}
          </div>

          <nav className={styles.bottomNav} aria-label="Navegação do DroneGestor">
            <BottomButton active={view === "inicio"} icon={<Home size={20} />} label="Início" onClick={() => go("inicio")} />
            <BottomButton active={["nova", "calda", "estrategia", "controle", "execucao"].includes(view)} icon={<Drone size={20} />} label="Operação" onClick={() => go("nova")} />
            <BottomButton active={view === "seguranca"} icon={<Map size={20} />} label="Mapa" onClick={() => go("seguranca")} />
            <BottomButton active={view === "relatorios"} icon={<FileText size={20} />} label="Relatórios" onClick={() => go("relatorios")} />
            <BottomButton active={view === "config"} icon={<Settings2 size={20} />} label="Mais" onClick={() => go("config")} />
          </nav>

          {notice && <div className={styles.toast}>{notice}</div>}
        </div>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className={styles.brand}>
      <span className={styles.brandIcon}><Drone size={28} /><Leaf size={17} /></span>
      <span><strong>DroneGestor</strong><b>Agro</b></span>
    </div>
  );
}

function HomeView({
  mission,
  calc,
  protocol,
  go
}: {
  mission: Mission;
  calc: ReturnType<typeof calculateShapePlaceholder>;
  protocol: ReturnType<typeof getTargetProtocol>;
  go: (view: View) => void;
}) {
  return (
    <>
      <div className={styles.weatherCard}>
        <div><CloudSun size={25} /><span><strong>{mission.temperatura}°C</strong><small>Condição informada</small></span></div>
        <div><Wind size={22} /><span><strong>{mission.ventoKmh} km/h</strong><small>{mission.direcaoVento}</small></span></div>
      </div>

      <Card title="Operação planejada" icon={<ClipboardCheck size={19} />} action={() => go("nova")}>
        <div className={styles.bigMetricRow}>
          <div><strong>{formatNumber(mission.area, 1)}</strong><span>ha</span><small>{mission.cultura} • {mission.alvo}</small></div>
          <div className={styles.statusPill}><span /> Pronta para cálculo</div>
        </div>
      </Card>

      <Card title="Janela e estratégia" icon={<Leaf size={19} />} action={() => go("estrategia")}>
        <div className={styles.twoColMetrics}>
          <div><small>Melhor janela-base</small><strong>{protocol.janela}</strong></div>
          <div><small>Gota do protocolo</small><strong>{protocol.gota}{protocol.micras ? ` • ${protocol.micras} µm` : ""}</strong></div>
        </div>
      </Card>

      <Card title="Capacidade prevista" icon={<Gauge size={19} />} action={() => go("controle")}>
        <div className={styles.twoColMetrics}>
          <div><small>Capacidade efetiva</small><strong>{formatNumber(calc.capacidadeEfetiva, 1)} ha/h</strong></div>
          <div><small>Tempo estimado</small><strong>{formatDuration(calc.tempoEstimadoH)}</strong></div>
        </div>
      </Card>

      <h3 className={styles.sectionLabel}>Ações rápidas</h3>
      <div className={styles.quickGrid}>
        <QuickAction icon={<Play />} label="Nova aplicação" onClick={() => go("nova")} />
        <QuickAction icon={<Droplets />} label="Calcular calda" onClick={() => go("calda")} />
        <QuickAction icon={<Gauge />} label="Configurar controle" onClick={() => go("controle")} />
        <QuickAction icon={<FileSpreadsheet />} label="Relatórios" onClick={() => go("relatorios")} />
      </div>
    </>
  );
}

// Tipagem auxiliar para os cálculos usados pelos componentes.
function calculateShapePlaceholder() {
  return {
    totalCalda: 0,
    produtoTotalL: 0,
    hectaresPorTanque: 0,
    tanquesInteiros: 0,
    ultimoTanque: 0,
    produtoPorTanqueL: 0,
    velocidadeMs: 0,
    vazao: 0,
    capacidadeTeorica: 0,
    capacidadeEfetiva: 0,
    tempoEstimadoH: 0,
    hectaresEm5h: 0,
    totalTanques: 0
  };
}

type CalcShape = ReturnType<typeof calculateShapePlaceholder>;

function NewMissionView({
  mission,
  updateMission,
  calc,
  onNext
}: {
  mission: Mission;
  updateMission: <K extends keyof Mission>(key: K, value: Mission[K]) => void;
  calc: CalcShape;
  onNext: () => void;
}) {
  return (
    <div className={styles.stack}>
      <StepIndicator active={1} />
      <PanelTitle icon={<Sprout size={20} />} title="Dados da aplicação" text="Informe o básico. O copiloto calcula o restante." />
      <div className={styles.formCard}>
        <Field label="Cultura"><select value={mission.cultura} onChange={(e) => updateMission("cultura", e.target.value)}><option>Milho</option><option>Soja</option><option>Algodão</option><option>Pastagem</option><option>Outra</option></select></Field>
        <Field label="Alvo"><select value={mission.alvo} onChange={(e) => updateMission("alvo", e.target.value)}><option>Cigarrinha</option><option>Lagarta</option><option>Ferrugem</option><option>Planta daninha</option><option>Outro</option></select></Field>
        <NumberField label="Área do talhão" value={mission.area} suffix="ha" onChange={(v) => updateMission("area", v)} />
        <Field label="Drone"><select value={mission.drone} onChange={(e) => updateMission("drone", e.target.value)}><option>DJI Agras T40</option><option>DJI Agras T50</option><option>DJI Agras T25</option><option>Outro</option></select></Field>
        <NumberField label="Volume de aplicação" value={mission.volume} suffix="L/ha" onChange={(v) => updateMission("volume", v)} />
        <NumberField label="Capacidade do tanque" value={mission.tanque} suffix="L" onChange={(v) => updateMission("tanque", v)} />
        <NumberField label="Dose prescrita" value={mission.doseMlHa} suffix="mL/ha" onChange={(v) => updateMission("doseMlHa", v)} />
        <NumberField label="Faixa" value={mission.faixa} suffix="m" onChange={(v) => updateMission("faixa", v)} />
        <NumberField label="Velocidade desejada" value={mission.velocidadeKmh} suffix="km/h" onChange={(v) => updateMission("velocidadeKmh", v)} />
      </div>
      <div className={styles.summaryCard}>
        <span>Resumo da missão</span>
        <div><small>Calda prevista</small><strong>{formatNumber(calc.totalCalda, 0)} L</strong></div>
        <div><small>Tempo estimado</small><strong>{formatDuration(calc.tempoEstimadoH)}</strong></div>
      </div>
      <PrimaryButton onClick={onNext}>Calcular missão <ChevronRight size={18} /></PrimaryButton>
    </div>
  );
}

function CaldaView({ mission, calc, onNext }: { mission: Mission; calc: CalcShape; onNext: () => void }) {
  return (
    <div className={styles.stack}>
      <StepIndicator active={2} />
      <PanelTitle icon={<Calculator size={20} />} title="Cálculo de calda" text="Baseado nos dados informados pelo piloto e na dose prescrita." />
      <div className={styles.parameterCard}>
        <InfoRow label="Área" value={`${formatNumber(mission.area, 1)} ha`} />
        <InfoRow label="Volume" value={`${formatNumber(mission.volume, 1)} L/ha`} />
        <InfoRow label="Tanque" value={`${formatNumber(mission.tanque, 0)} L`} />
        <InfoRow label="Dose" value={`${formatNumber(mission.doseMlHa, 0)} mL/ha`} />
      </div>
      <div className={styles.resultGrid}>
        <ResultCard icon={<Droplets />} label="Calda total" value={`${formatNumber(calc.totalCalda, 0)} L`} />
        <ResultCard icon={<Sparkles />} label="Produto total" value={`${formatNumber(calc.produtoTotalL, 2)} L`} />
        <ResultCard icon={<Route />} label="Área por tanque" value={`${formatNumber(calc.hectaresPorTanque, 2)} ha`} />
        <ResultCard icon={<RotateCcw />} label="Tanques" value={`${calc.totalTanques}`} detail={calc.ultimoTanque > 0 ? `Último com ${formatNumber(calc.ultimoTanque, 1)} L` : "Todos completos"} />
      </div>
      <div className={styles.highlightCard}>
        <Droplets size={24} />
        <div><small>Produto por tanque cheio</small><strong>{formatNumber(calc.produtoPorTanqueL, 2)} L</strong></div>
      </div>
      <PrimaryButton onClick={onNext}>Ver estratégia de campo <ChevronRight size={18} /></PrimaryButton>
    </div>
  );
}

function StrategyView({
  mission,
  protocol,
  mandatory,
  accepted,
  setAccepted,
  onNext
}: {
  mission: Mission;
  protocol: ReturnType<typeof getTargetProtocol>;
  mandatory: boolean;
  accepted: boolean;
  setAccepted: (value: boolean) => void;
  onNext: () => void;
}) {
  return (
    <div className={styles.stack}>
      <StepIndicator active={3} />
      <div className={styles.targetCard}>
        <div><Sprout size={23} /><span><small>Cultura</small><strong>{mission.cultura}</strong></span></div>
        <div><Target size={23} /><span><small>Alvo</small><strong>{mission.alvo}</strong></span></div>
      </div>
      <ResultList icon={<Droplets />} label="Classe de gota" value={protocol.micras ? `${protocol.gota} • ${protocol.micras} µm` : protocol.gota} />
      <ResultList icon={<Route />} label="Estratégia sugerida" value={protocol.estrategia} />
      <ResultList icon={<TimerReset />} label="Janela-base" value={protocol.janela} />
      <ResultList icon={<Wind />} label="Condição informada" value={`${mission.ventoKmh} km/h • ${mission.temperatura}°C • UR ${mission.umidade}%`} />
      <div className={styles.insightCard}>
        <Sparkles size={24} />
        <div><strong>Insight de campo</strong><p>{protocol.insight}</p></div>
      </div>
      <label className={styles.confirmRow}>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span><strong>{mandatory ? "Confirmação obrigatória da empresa" : "Confirmar insight"}</strong><small>Li o protocolo e vou conferir bula, receituário e orientação técnica.</small></span>
      </label>
      <PrimaryButton disabled={mandatory && !accepted} onClick={onNext}>Analisar segurança <ChevronRight size={18} /></PrimaryButton>
    </div>
  );
}

function SafetyView({
  mission,
  settings,
  risk,
  accepted,
  setAccepted,
  updateMission,
  onNext
}: {
  mission: Mission;
  settings: CompanySettings;
  risk: { level: "danger" | "warning" | "safe"; label: string };
  accepted: boolean;
  setAccepted: (value: boolean) => void;
  updateMission: <K extends keyof Mission>(key: K, value: Mission[K]) => void;
  onNext: () => void;
}) {
  return (
    <div className={styles.stack}>
      <div className={styles.mapMock}>
        <div className={styles.river} />
        <div className={styles.fieldOuter}><div className={styles.fieldPreventive}><div className={styles.fieldSafe}><Drone size={26} /></div></div></div>
        <span className={styles.mapTag}>APP</span>
        <span className={styles.homeMarker}>⌂</span>
      </div>
      <div className={styles.legendCard}>
        <Legend color="red" label="Referência legal cadastrada" value={`${settings.limiteLegalReferencia} m`} />
        <Legend color="amber" label="Margem preventiva da empresa" value={`${settings.margemPreventiva} m`} />
        <Legend color="green" label="Área sensível identificada" value={`${mission.distanciaSensivel} m`} />
      </div>
      <div className={`${styles.riskCard} ${styles[risk.level]}`}>
        <AlertTriangle size={23} />
        <div><strong>{risk.label}</strong><p>Distância isolada não elimina risco de deriva. Confira vento, direção, rajadas, gota, altura e área vizinha.</p></div>
      </div>
      <div className={styles.formCard}>
        <NumberField label="Distância da área sensível" value={mission.distanciaSensivel} suffix="m" onChange={(v) => updateMission("distanciaSensivel", v)} />
        <NumberField label="Vento" value={mission.ventoKmh} suffix="km/h" onChange={(v) => updateMission("ventoKmh", v)} />
        <Field label="Direção do vento"><input value={mission.direcaoVento} onChange={(e) => updateMission("direcaoVento", e.target.value)} /></Field>
        <NumberField label="Temperatura" value={mission.temperatura} suffix="°C" onChange={(v) => updateMission("temperatura", v)} />
        <NumberField label="Umidade" value={mission.umidade} suffix="%" onChange={(v) => updateMission("umidade", v)} />
      </div>
      <label className={styles.confirmRow}>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span><strong>Confirmar análise de risco</strong><small>Conferi a área sensível e as condições antes de liberar a missão.</small></span>
      </label>
      <PrimaryButton disabled={settings.exigirConfirmacao && !accepted} onClick={onNext}>Gerar parâmetros do controle <ChevronRight size={18} /></PrimaryButton>
    </div>
  );
}

function ControlView({
  mission,
  calc,
  protocol,
  canRelease,
  onCopy,
  onStart
}: {
  mission: Mission;
  calc: CalcShape;
  protocol: ReturnType<typeof getTargetProtocol>;
  canRelease: boolean;
  onCopy: () => void;
  onStart: () => void;
}) {
  return (
    <div className={styles.stack}>
      <div className={styles.releaseBanner}>
        {canRelease ? <Check size={20} /> : <AlertTriangle size={20} />}
        <span><strong>{canRelease ? "Missão liberada pelo fluxo interno" : "Parâmetros aguardando confirmações"}</strong><small>Confira os números no controle antes da decolagem.</small></span>
      </div>
      <div className={styles.controlGrid}>
        <ControlMetric icon={<Gauge />} label="Velocidade" value={formatNumber(calc.velocidadeMs, 1)} suffix="m/s" detail={`${formatNumber(mission.velocidadeKmh, 0)} km/h`} />
        <ControlMetric icon={<Droplets />} label="Volume" value={formatNumber(mission.volume, 0)} suffix="L/ha" />
        <ControlMetric icon={<Route />} label="Faixa" value={formatNumber(mission.faixa, 1)} suffix="m" />
        <ControlMetric icon={<Sparkles />} label="Vazão" value={formatNumber(calc.vazao, 2)} suffix="L/min" />
      </div>
      <div className={styles.smallMetricGrid}>
        <div><small>Gota-base</small><strong>{protocol.micras ? `${protocol.micras} µm` : protocol.gota}</strong></div>
        <div><small>Capacidade</small><strong>{formatNumber(calc.capacidadeEfetiva, 1)} ha/h</strong></div>
        <div><small>Tempo</small><strong>{formatDuration(calc.tempoEstimadoH)}</strong></div>
      </div>
      <div className={styles.insightCard}><Compass size={23} /><div><strong>Antes de colocar no controle</strong><p>Use estes valores como base calculada. Ajuste final deve respeitar o equipamento, o produto, a bula, o RT e as condições reais do talhão.</p></div></div>
      <PrimaryButton disabled={!canRelease} onClick={onStart}><Play size={18} /> Iniciar operação</PrimaryButton>
      <button className={styles.secondaryButton} onClick={onCopy}>Copiar parâmetros</button>
    </div>
  );
}

function ExecutionView({
  mission,
  calc,
  progressHa,
  paused,
  setPaused,
  finishTank,
  onOccurrence
}: {
  mission: Mission;
  calc: CalcShape;
  progressHa: number;
  paused: boolean;
  setPaused: (value: boolean) => void;
  finishTank: () => void;
  onOccurrence: () => void;
}) {
  const percent = mission.area > 0 ? Math.min(100, (progressHa / mission.area) * 100) : 0;
  const currentTank = Math.min(calc.totalTanques, Math.max(1, Math.ceil(progressHa / Math.max(calc.hectaresPorTanque, 0.01)) + 1));
  const remaining = Math.max(0, mission.area - progressHa);
  const remainingHours = calc.capacidadeEfetiva > 0 ? remaining / calc.capacidadeEfetiva : 0;

  return (
    <div className={styles.stack}>
      <div className={styles.missionProgressCard}>
        <span>Aplicação de defensivo</span>
        <small>{mission.cultura} • {mission.alvo}</small>
        <div className={styles.progressHeading}><strong>{formatNumber(percent, 0)}%</strong><span>{formatNumber(progressHa, 1)} de {formatNumber(mission.area, 1)} ha</span></div>
        <div className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>
      </div>
      <ResultList icon={<RotateCcw />} label="Tanque" value={`${currentTank} de ${calc.totalTanques}`} />
      <ResultList icon={<Map />} label="Área aplicada" value={`${formatNumber(progressHa, 1)} ha`} />
      <ResultList icon={<Route />} label="Área restante" value={`${formatNumber(remaining, 1)} ha`} />
      <ResultList icon={<TimerReset />} label="Tempo restante estimado" value={formatDuration(remainingHours)} />
      <ResultList icon={<Leaf />} label="Status" value={paused ? "Operação pausada" : "Operação em andamento"} />
      <div className={styles.quickGrid}>
        <QuickAction icon={paused ? <Play /> : <Pause />} label={paused ? "Retomar" : "Pausar"} onClick={() => setPaused(!paused)} />
        <QuickAction icon={<AlertTriangle />} label="Ocorrência" onClick={onOccurrence} />
        <QuickAction icon={<FileText />} label="Registro" onClick={() => window.print()} />
        <QuickAction icon={<Check />} label="Finalizar tanque" onClick={finishTank} />
      </div>
    </div>
  );
}

function ReportsView({ mission, calc, onMission, onCsv }: { mission: Mission; calc: CalcShape; onMission: () => void; onCsv: () => void }) {
  return (
    <div className={styles.stack}>
      <PanelTitle icon={<FileText size={21} />} title="Operação documentada" text="Os dados preenchidos durante a missão ficam prontos para reaproveitamento nos relatórios." />
      <div className={styles.completedCard}>
        <span><Check size={18} /> Missão atual</span>
        <strong>{mission.cultura} • {formatNumber(mission.area, 1)} ha</strong>
        <small>{formatNumber(calc.totalCalda, 0)} L de calda • {formatDuration(calc.tempoEstimadoH)} estimados</small>
      </div>
      <ReportAction icon={<FileText />} title="Relatório da missão" detail="Resumo completo dos parâmetros e condições registradas." badge="Pronto" onClick={onMission} />
      <ReportAction icon={<FileSpreadsheet />} title="Pré-preenchimento mensal" detail="Exporta CSV para conferência antes do relatório oficial do MAPA." badge="Exportar" onClick={onCsv} />
      <ReportAction icon={<ShieldCheck />} title="Dossiê da operação" detail="Estrutura para SARPAS, receituário, mapa, clima e evidências." badge="Estrutura pronta" onClick={() => window.print()} />
      <div className={styles.insightCard}><FileSpreadsheet size={23} /><div><strong>Relatório regulatório</strong><p>O envio oficial deve sempre usar o modelo vigente do órgão competente. Esta versão já organiza os dados da missão e deixa o preenchimento preparado.</p></div></div>
    </div>
  );
}

function SettingsView({
  settings,
  setSettings,
  onSaved
}: {
  settings: CompanySettings;
  setSettings: (settings: CompanySettings) => void;
  onSaved: () => void;
}) {
  const update = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => setSettings({ ...settings, [key]: value });
  return (
    <div className={styles.stack}>
      <div className={styles.companyActive}><ShieldCheck size={26} /><div><strong>Padrão da empresa ativo</strong><small>Essas regras são aplicadas às missões desta equipe.</small></div></div>
      <ToggleRow label="Insights de campo obrigatórios" detail="Bloqueia o avanço enquanto o piloto não confirmar o protocolo." checked={settings.insightsObrigatorios} onChange={(v) => update("insightsObrigatorios", v)} />
      <SettingNumber label="Margem preventiva padrão" value={settings.margemPreventiva} suffix="m" onChange={(v) => update("margemPreventiva", v)} />
      <SettingNumber label="Referência legal cadastrada" value={settings.limiteLegalReferencia} suffix="m" onChange={(v) => update("limiteLegalReferencia", v)} />
      <ToggleRow label="Exigir confirmação de risco" detail="O piloto precisa confirmar a análise antes da liberação." checked={settings.exigirConfirmacao} onChange={(v) => update("exigirConfirmacao", v)} />
      <ToggleRow label="Protocolo de bordadura para cigarrinha" detail="Define a estratégia da empresa como padrão quando esse alvo for selecionado." checked={settings.protocoloBordaduraCigarrinha} onChange={(v) => update("protocoloBordaduraCigarrinha", v)} />
      <SettingNumber label="Eficiência operacional de planejamento" value={settings.eficienciaOperacional} suffix="%" onChange={(v) => update("eficienciaOperacional", Math.min(100, Math.max(10, v)))} />
      <div className={styles.listMenu}><Route size={20} /><span><strong>Protocolos por cultura e alvo</strong><small>Biblioteca expansível de estratégias e observações.</small></span><ChevronRight size={19} /></div>
      <div className={styles.listMenu}><Compass size={20} /><span><strong>Regras por estado</strong><small>Separar regra legal, margem da empresa e insight de campo.</small></span><ChevronRight size={19} /></div>
      <PrimaryButton onClick={onSaved}><Check size={18} /> Salvar padrão da empresa</PrimaryButton>
    </div>
  );
}

function Card({ title, icon, action, children }: { title: string; icon: React.ReactNode; action?: () => void; children: React.ReactNode }) {
  return <section className={styles.card}><button className={styles.cardHead} onClick={action}>{icon}<strong>{title}</strong>{action && <ChevronRight size={18} />}</button>{children}</section>;
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={styles.quickButton} onClick={onClick}>{icon}<span>{label}</span><ChevronRight size={17} /></button>;
}

function BottomButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button className={active ? styles.bottomActive : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function StepIndicator({ active }: { active: number }) {
  return <div className={styles.steps}>{[1, 2, 3, 4].map((step) => <span key={step} className={step <= active ? styles.stepActive : ""}>{step}</span>)}</div>;
}

function PanelTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className={styles.panelTitle}>{icon}<div><strong>{title}</strong><p>{text}</p></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}

function NumberField({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void }) {
  return <label className={styles.field}><span>{label}</span><div className={styles.numberInput}><input type="number" step="any" value={value} onChange={(e) => onChange(Number(e.target.value))} /><b>{suffix}</b></div></label>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className={styles.infoRow}><span>{label}</span><strong>{value}</strong></div>;
}

function ResultCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return <div className={styles.resultCard}>{icon}<small>{label}</small><strong>{value}</strong>{detail && <span>{detail}</span>}</div>;
}

function ResultList({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className={styles.resultList}>{icon}<span><small>{label}</small><strong>{value}</strong></span></div>;
}

function ControlMetric({ icon, label, value, suffix, detail }: { icon: React.ReactNode; label: string; value: string; suffix: string; detail?: string }) {
  return <div className={styles.controlMetric}>{icon}<small>{label}</small><strong>{value}</strong><span>{suffix}</span>{detail && <b>{detail}</b>}</div>;
}

function PrimaryButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button className={styles.primaryButton} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Legend({ color, label, value }: { color: "red" | "amber" | "green"; label: string; value: string }) {
  return <div className={styles.legend}><span className={styles[color]} /><small>{label}</small><strong>{value}</strong></div>;
}

function ToggleRow({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className={styles.settingRow}><span><strong>{label}</strong><small>{detail}</small></span><button className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`} onClick={() => onChange(!checked)} aria-pressed={checked}><i /></button></div>;
}

function SettingNumber({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void }) {
  return <label className={styles.settingRow}><span><strong>{label}</strong><small>Configuração padrão da empresa.</small></span><div className={styles.settingInput}><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} /><b>{suffix}</b></div></label>;
}

function ReportAction({ icon, title, detail, badge, onClick }: { icon: React.ReactNode; title: string; detail: string; badge: string; onClick: () => void }) {
  return <button className={styles.reportAction} onClick={onClick}>{icon}<span><strong>{title}</strong><small>{detail}</small></span><b>{badge}</b><Download size={18} /></button>;
}
