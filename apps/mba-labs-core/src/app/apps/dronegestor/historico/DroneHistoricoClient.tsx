"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, History, LoaderCircle, MapPin, RefreshCcw, ShieldCheck, Sprout } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Product = { nome?: string; dose?: number; unidade?: string };
type Summary = {
  piloto?: string;
  cultura?: string;
  alvo?: string;
  areaHa?: number;
  areaConcluidaHa?: number;
  drone?: string;
  volumeLHa?: number;
  totalCaldaL?: number;
  faixaM?: number;
  velocidadeKmh?: number;
  alturaM?: number;
  sarpasNumero?: string;
  sarpasConfirmado?: boolean;
  climaCampo?: {
    ventoKmh?: number;
    direcaoVento?: string;
    temperaturaC?: number;
    umidadePct?: number;
  };
  gps?: { latitude?: number; longitude?: number; capturadoEm?: string };
  produtos?: Product[];
  calibracaoConcluida?: boolean;
  checklistConcluido?: boolean;
  totalOcorrencias?: number;
};

type HistoryItem = {
  id: string;
  usuario_id?: string;
  empresa_id?: string;
  created_at: string;
  detalhes?: {
    operationId?: string;
    finalizedAt?: string;
    summary?: Summary;
  };
};

function number(value: unknown, decimals = 1) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(value) || 0);
}

function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

export function DroneHistoricoClient({ userName, companyMode }: { userName: string; companyMode: boolean }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dronegestor/state?history=1", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Falha ao carregar o histórico.");
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const summary = item.detalhes?.summary;
        acc.area += Number(summary?.areaConcluidaHa ?? summary?.areaHa ?? 0) || 0;
        acc.calda += Number(summary?.totalCaldaL ?? 0) || 0;
        acc.occurrences += Number(summary?.totalOcorrencias ?? 0) || 0;
        return acc;
      },
      { area: 0, calda: 0, occurrences: 0 }
    );
  }, [items]);

  function exportCsv() {
    const header = [
      "data_conclusao",
      "piloto",
      "cultura",
      "alvo",
      "area_ha",
      "drone",
      "volume_l_ha",
      "calda_total_l",
      "faixa_m",
      "velocidade_kmh",
      "altura_m",
      "sarpas_referencia",
      "sarpas_confirmado",
      "vento_kmh",
      "direcao_vento",
      "temperatura_c",
      "umidade_pct",
      "latitude",
      "longitude",
      "produtos",
      "calibracao_concluida",
      "checklist_concluido",
      "ocorrencias"
    ];

    const rows = items.map((item) => {
      const s = item.detalhes?.summary ?? {};
      const products = (s.produtos ?? [])
        .map((product) => `${product.nome || "Produto"} | ${product.dose ?? 0} ${product.unidade || ""}`.trim())
        .join("; ");
      return [
        item.detalhes?.finalizedAt || item.created_at,
        s.piloto,
        s.cultura,
        s.alvo,
        s.areaConcluidaHa ?? s.areaHa,
        s.drone,
        s.volumeLHa,
        s.totalCaldaL,
        s.faixaM,
        s.velocidadeKmh,
        s.alturaM,
        s.sarpasNumero,
        s.sarpasConfirmado ? "SIM" : "NÃO",
        s.climaCampo?.ventoKmh,
        s.climaCampo?.direcaoVento,
        s.climaCampo?.temperaturaC,
        s.climaCampo?.umidadePct,
        s.gps?.latitude,
        s.gps?.longitude,
        products,
        s.calibracaoConcluida ? "SIM" : "NÃO",
        s.checklistConcluido ? "SIM" : "NÃO",
        s.totalOcorrencias ?? 0
      ].map(csvCell).join(";");
    });

    const blob = new Blob(["\ufeff", header.join(";"), "\n", rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dronegestor-historico-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(180deg,#06120d,#0a1c14 48%,#07110d)", color: "#ecfdf5", padding: "22px 14px 50px" }}>
      <div style={{ width: "min(980px,100%)", margin: "0 auto", display: "grid", gap: 16 }}>
        <header style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/apps/dronegestor/campo" aria-label="Voltar ao campo" style={{ width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", color: "#d1fae5", background: "rgba(16,185,129,.12)", border: "1px solid rgba(52,211,153,.25)" }}>
              <ArrowLeft size={20} />
            </Link>
            <div>
              <small style={{ color: "#6ee7b7", fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>DroneGestor Agro</small>
              <h1 style={{ margin: "3px 0 0", fontSize: "clamp(24px,5vw,36px)", lineHeight: 1.05 }}>Histórico de operações</h1>
              <p style={{ margin: "6px 0 0", color: "#a7f3d0", fontSize: 13 }}>{companyMode ? "Visão consolidada da empresa" : `Operações registradas por ${userName}`}</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => void load()} style={{ minHeight: 40, display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 11, padding: "0 12px", background: "rgba(15,23,42,.85)", color: "#e2e8f0", border: "1px solid rgba(148,163,184,.25)", fontWeight: 800 }}>
              <RefreshCcw size={16} /> Atualizar
            </button>
            <button type="button" onClick={exportCsv} disabled={!items.length} style={{ minHeight: 40, display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 11, padding: "0 12px", background: items.length ? "#10b981" : "#334155", color: "white", border: 0, fontWeight: 900 }}>
              <Download size={16} /> CSV
            </button>
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
          <Metric label="Operações" value={String(items.length)} />
          <Metric label="Área concluída" value={`${number(totals.area, 1)} ha`} />
          <Metric label="Calda registrada" value={`${number(totals.calda, 0)} L`} />
          <Metric label="Ocorrências" value={String(totals.occurrences)} />
        </section>

        <section style={{ borderRadius: 18, padding: 14, background: "rgba(5,46,22,.52)", border: "1px solid rgba(74,222,128,.2)", display: "flex", gap: 11, alignItems: "flex-start" }}>
          <FileSpreadsheet size={22} style={{ flex: "0 0 auto", color: "#86efac" }} />
          <div>
            <strong style={{ display: "block" }}>Base estruturada para consolidação MAPA</strong>
            <p style={{ margin: "4px 0 0", color: "#bbf7d0", fontSize: 13, lineHeight: 1.45 }}>O CSV reúne os dados já existentes nas operações. Ele ainda não é o relatório oficial mensal do MAPA; o modelo oficial será gerado em etapa própria, com validação dos campos obrigatórios vigentes.</p>
          </div>
        </section>

        {loading ? (
          <div style={{ minHeight: 220, display: "grid", placeItems: "center", color: "#a7f3d0" }}><LoaderCircle size={28} className="animate-spin" /></div>
        ) : error ? (
          <div style={{ borderRadius: 16, padding: 16, background: "rgba(127,29,29,.35)", border: "1px solid rgba(248,113,113,.3)", color: "#fecaca" }}>{error}</div>
        ) : !items.length ? (
          <div style={{ minHeight: 240, display: "grid", placeItems: "center", textAlign: "center", borderRadius: 18, border: "1px dashed rgba(110,231,183,.25)", color: "#a7f3d0" }}>
            <div><History size={34} style={{ margin: "0 auto 10px" }} /><strong style={{ display: "block", color: "white" }}>Nenhuma operação concluída ainda</strong><small>Conclua uma aplicação no campo e toque em “Concluir e salvar”.</small></div>
          </div>
        ) : (
          <section style={{ display: "grid", gap: 12 }}>
            {items.map((item) => <OperationCard key={item.id} item={item} />)}
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 16, padding: 14, background: "rgba(15,23,42,.58)", border: "1px solid rgba(110,231,183,.14)" }}>
      <small style={{ color: "#94a3b8", fontWeight: 800 }}>{label}</small>
      <strong style={{ display: "block", marginTop: 5, fontSize: 22 }}>{value}</strong>
    </div>
  );
}

function OperationCard({ item }: { item: HistoryItem }) {
  const s = item.detalhes?.summary ?? {};
  const products = s.produtos ?? [];
  const gpsReady = Boolean(s.gps?.latitude && s.gps?.longitude);

  return (
    <article style={{ borderRadius: 19, overflow: "hidden", background: "rgba(15,23,42,.72)", border: "1px solid rgba(110,231,183,.15)", boxShadow: "0 18px 50px rgba(0,0,0,.16)" }}>
      <div style={{ padding: 15, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", gap: 7, alignItems: "center", color: "#6ee7b7", fontSize: 12, fontWeight: 900 }}><CheckCircle2 size={15} /> OPERAÇÃO CONCLUÍDA</div>
          <h2 style={{ margin: "7px 0 3px", fontSize: 20 }}>{s.cultura || "Cultura não informada"} {s.alvo ? `• ${s.alvo}` : ""}</h2>
          <small style={{ color: "#94a3b8" }}>{dateTime(item.detalhes?.finalizedAt || item.created_at)} • {s.piloto || "Piloto"}</small>
        </div>
        <div style={{ textAlign: "right" }}><strong style={{ display: "block", fontSize: 23, color: "#a7f3d0" }}>{number(s.areaConcluidaHa ?? s.areaHa, 1)} ha</strong><small style={{ color: "#94a3b8" }}>{s.drone || "Drone não informado"}</small></div>
      </div>

      <div style={{ padding: "0 15px 15px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8 }}>
        <Mini label="Volume" value={`${number(s.volumeLHa, 1)} L/ha`} />
        <Mini label="Calda total" value={`${number(s.totalCaldaL, 0)} L`} />
        <Mini label="Vento" value={`${number(s.climaCampo?.ventoKmh, 1)} km/h ${s.climaCampo?.direcaoVento || ""}`.trim()} />
        <Mini label="Temp. / UR" value={`${number(s.climaCampo?.temperaturaC, 1)} °C • ${number(s.climaCampo?.umidadePct, 0)}%`} />
      </div>

      <div style={{ padding: "12px 15px", borderTop: "1px solid rgba(148,163,184,.12)", display: "grid", gap: 8, fontSize: 13 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}><ShieldCheck size={16} color="#6ee7b7" /><span>SARPAS: <strong>{s.sarpasNumero || "sem referência"}</strong> • {s.sarpasConfirmado ? "confirmado" : "não confirmado"}</span></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Sprout size={16} color="#6ee7b7" /><span>Produtos: <strong>{products.length ? products.map((product) => product.nome || "Produto").join(", ") : "não informados"}</strong></span></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}><MapPin size={16} color="#6ee7b7" /><span>{gpsReady ? `${s.gps?.latitude}, ${s.gps?.longitude}` : "GPS não registrado nesta operação"}</span></div>
      </div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div style={{ borderRadius: 12, padding: 10, background: "rgba(2,6,23,.4)" }}><small style={{ color: "#94a3b8" }}>{label}</small><strong style={{ display: "block", marginTop: 3 }}>{value}</strong></div>;
}
