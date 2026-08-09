"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, ClipboardList, Download, FileSpreadsheet, History, LoaderCircle, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Product = { nome?: string; dose?: number; unidade?: string };
type TankRecord = { id?: string; at?: string; areaHa?: number; volumeL?: number; note?: string };
type Summary = {
  piloto?: string;
  ordemServicoNumero?: string;
  clienteNome?: string;
  fazendaNome?: string;
  talhaoNome?: string;
  municipio?: string;
  uf?: string;
  cultura?: string;
  alvo?: string;
  tipoAtividade?: string;
  areaHa?: number;
  areaConcluidaHa?: number;
  drone?: string;
  registroAnac?: string;
  pontaModelo?: string;
  volumeLHa?: number;
  totalCaldaL?: number;
  totalCaldaRealL?: number;
  faixaM?: number;
  velocidadeKmh?: number;
  alturaM?: number;
  sarpasNumero?: string;
  sarpasSituacao?: string;
  sarpasConfirmado?: boolean;
  climaCampoMedidoEm?: string;
  climaCampo?: { ventoKmh?: number | null; direcaoVento?: string; temperaturaC?: number | null; umidadePct?: number | null };
  areaSensivel?: { semAreaSensivel?: boolean; distanciaM?: number | null; margemPreventivaM?: number; bloqueioMargemAtivo?: boolean };
  gps?: { latitude?: number | null; longitude?: number | null; capturadoEm?: string; disponivel?: boolean };
  produtos?: Product[];
  tanques?: TankRecord[];
  calibracaoConcluida?: boolean;
  checklistConcluido?: boolean;
  insightConfirmado?: boolean;
  riscoConfirmado?: boolean;
  totalOcorrencias?: number;
  iniciadaEm?: string;
  finalizadaEm?: string;
};
type HistoryItem = { id: string; created_at: string; detalhes?: { operationId?: string; finalizedAt?: string; summary?: Summary } };

function number(value: unknown, decimals = 1) {
  const parsed = Number(value);
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number.isFinite(parsed) ? parsed : 0);
}
function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function endOfDay(date: string) { return date ? `${date}T23:59:59.999Z` : ""; }
function startOfDay(date: string) { return date ? `${date}T00:00:00.000Z` : ""; }

export function DroneHistoricoClientV2({ userName, companyMode }: { userName: string; companyMode: boolean }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const all: HistoryItem[] = [];
      let offset = 0;
      let hasMore = true;
      let pages = 0;
      while (hasMore && pages < 100) {
        const params = new URLSearchParams({ history: "1", limit: "500", offset: String(offset) });
        if (startDate) params.set("start", startOfDay(startDate));
        if (endDate) params.set("end", endOfDay(endDate));
        const response = await fetch(`/api/dronegestor/state?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || "Falha ao carregar histórico.");
        const page = Array.isArray(payload?.items) ? payload.items : [];
        all.push(...page);
        hasMore = Boolean(payload?.hasMore);
        offset = Number(payload?.nextOffset || 0);
        pages += 1;
        if (!hasMore) break;
      }
      if (hasMore) throw new Error("O histórico ultrapassou o limite de segurança da consulta. Aplique um período menor.");
      setItems(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar histórico.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const summary = item.detalhes?.summary ?? {};
      return [summary.ordemServicoNumero, summary.clienteNome, summary.fazendaNome, summary.talhaoNome, summary.piloto, summary.cultura, summary.alvo, summary.uf, summary.drone, summary.registroAnac]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [items, filter]);

  const totals = useMemo(() => visible.reduce((acc, item) => {
    const summary = item.detalhes?.summary;
    acc.area += Number(summary?.areaConcluidaHa ?? summary?.areaHa ?? 0) || 0;
    acc.caldaReal += Number(summary?.totalCaldaRealL ?? 0) || 0;
    acc.caldaPlanejada += Number(summary?.totalCaldaL ?? 0) || 0;
    acc.occurrences += Number(summary?.totalOcorrencias ?? 0) || 0;
    return acc;
  }, { area: 0, caldaReal: 0, caldaPlanejada: 0, occurrences: 0 }), [visible]);

  function exportCsv() {
    const header = [
      "data_conclusao","inicio","termino","os_numero","cliente","fazenda","talhao","municipio","uf","piloto","atividade","cultura","alvo",
      "area_planejada_ha","area_real_ha","drone","registro_anac","ponta_atomizador","volume_planejado_l_ha","calda_planejada_l","calda_real_l",
      "faixa_m","velocidade_kmh","altura_m","sarpas_situacao","sarpas_referencia","sarpas_confirmado","vento_kmh","direcao_vento","temperatura_c","umidade_pct","clima_medido_em",
      "area_sensivel_sem_area","distancia_area_sensivel_m","margem_preventiva_m","latitude","longitude","gps_capturado_em","produtos","abastecimentos","calibracao_concluida","checklist_concluido","insight_confirmado","risco_confirmado","ocorrencias"
    ];
    const rows = visible.map((item) => {
      const summary = item.detalhes?.summary ?? {};
      const products = (summary.produtos ?? []).map((product) => `${product.nome || "Produto"} | ${product.dose ?? 0} ${product.unidade || ""}`.trim()).join("; ");
      const tanks = (summary.tanques ?? []).map((tank, index) => `#${index + 1} ${tank.areaHa ?? 0} ha / ${tank.volumeL ?? 0} L`).join("; ");
      return [
        item.detalhes?.finalizedAt || item.created_at, summary.iniciadaEm, summary.finalizadaEm, summary.ordemServicoNumero, summary.clienteNome, summary.fazendaNome, summary.talhaoNome, summary.municipio, summary.uf, summary.piloto,
        summary.tipoAtividade, summary.cultura, summary.alvo, summary.areaHa, summary.areaConcluidaHa ?? summary.areaHa, summary.drone, summary.registroAnac, summary.pontaModelo,
        summary.volumeLHa, summary.totalCaldaL, summary.totalCaldaRealL, summary.faixaM, summary.velocidadeKmh, summary.alturaM, summary.sarpasSituacao, summary.sarpasNumero, summary.sarpasConfirmado ? "SIM" : "NÃO",
        summary.climaCampo?.ventoKmh, summary.climaCampo?.direcaoVento, summary.climaCampo?.temperaturaC, summary.climaCampo?.umidadePct, summary.climaCampoMedidoEm,
        summary.areaSensivel?.semAreaSensivel ? "SIM" : "NÃO", summary.areaSensivel?.distanciaM, summary.areaSensivel?.margemPreventivaM,
        summary.gps?.latitude, summary.gps?.longitude, summary.gps?.capturadoEm, products, tanks,
        summary.calibracaoConcluida ? "SIM" : "NÃO", summary.checklistConcluido ? "SIM" : "NÃO", summary.insightConfirmado ? "SIM" : "NÃO", summary.riscoConfirmado ? "SIM" : "NÃO", summary.totalOcorrencias ?? 0
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

  return <main className="min-h-screen bg-[#07110d] px-3 py-6 text-emerald-50"><div className="mx-auto grid w-full max-w-6xl gap-4">
    <header className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Link href="/apps/dronegestor" className="grid size-11 place-items-center rounded-xl border border-emerald-800 text-emerald-100"><ArrowLeft size={20}/></Link><div><small className="font-black uppercase text-emerald-300">DroneGestor Agro</small><h1 className="text-3xl font-black">Histórico de operações</h1><p className="text-sm text-emerald-200/70">{companyMode ? "Visão consolidada da empresa / RT" : `Operações de ${userName}`}</p></div></div><div className="flex gap-2"><Link href="/apps/dronegestor/gestao" className="rounded-xl border border-emerald-800 px-3 py-2 font-bold text-emerald-100 no-underline"><ClipboardList className="mr-2 inline" size={16}/>OS</Link><button onClick={()=>void load()} className="rounded-xl border border-emerald-800 px-3 py-2 font-bold"><RefreshCcw className="mr-2 inline" size={16}/>Atualizar</button><button disabled={!visible.length} onClick={exportCsv} className="rounded-xl bg-emerald-500 px-3 py-2 font-black text-slate-950 disabled:bg-slate-700"><Download className="mr-2 inline" size={16}/>CSV</button></div></header>

    <section className="grid gap-2 rounded-2xl border border-emerald-900 bg-slate-950/50 p-3 sm:grid-cols-[1fr_150px_150px_auto]"><input value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder="OS, cliente, fazenda, piloto, cultura, drone ou ANAC..." className="min-h-11 rounded-xl border border-emerald-900 bg-slate-950 px-3 text-white"/><input aria-label="Data inicial" type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="min-h-11 rounded-xl border border-emerald-900 bg-slate-950 px-3 text-white"/><input aria-label="Data final" type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="min-h-11 rounded-xl border border-emerald-900 bg-slate-950 px-3 text-white"/><button onClick={()=>void load()} className="min-h-11 rounded-xl bg-emerald-700 px-4 font-black">Aplicar período</button></section>

    <section className="grid grid-cols-2 gap-2 md:grid-cols-5"><Metric label="Operações" value={String(visible.length)}/><Metric label="Área real" value={`${number(totals.area,1)} ha`}/><Metric label="Calda real" value={`${number(totals.caldaReal,0)} L`}/><Metric label="Calda planejada" value={`${number(totals.caldaPlanejada,0)} L`}/><Metric label="Ocorrências" value={String(totals.occurrences)}/></section>
    <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm"><FileSpreadsheet className="mr-2 inline" size={18}/><strong>Consulta paginada completa do período.</strong> O CSV é base de conferência e não substitui o relatório mensal oficial.</div>
    {loading ? <div className="grid min-h-52 place-items-center"><LoaderCircle className="animate-spin"/></div> : error ? <div className="rounded-xl bg-red-950 p-4 text-red-200">{error}</div> : !visible.length ? <div className="grid min-h-52 place-items-center text-center"><div><History className="mx-auto" size={34}/><span>Nenhuma operação encontrada.</span></div></div> : <section className="grid gap-3">{visible.map((item)=><OperationCard key={item.id} item={item}/>)}</section>}
  </div></main>;
}

function Metric({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-emerald-900 bg-slate-950/60 p-4"><small className="text-slate-400">{label}</small><strong className="block text-xl">{value}</strong></div>; }
function OperationCard({item}:{item:HistoryItem}) {
  const summary = item.detalhes?.summary ?? {};
  const products = summary.produtos ?? [];
  const actualVolume = Number(summary.totalCaldaRealL ?? 0) || 0;
  return <article className="rounded-2xl border border-emerald-900 bg-slate-950/70 p-4"><div className="flex flex-wrap justify-between gap-3"><div><div className="text-xs font-black text-emerald-300"><CheckCircle2 className="mr-1 inline" size={15}/>OPERAÇÃO CONCLUÍDA {summary.ordemServicoNumero ? `• ${summary.ordemServicoNumero}` : ""}</div><h2 className="mt-2 text-xl font-black">{summary.cultura || "Cultura"} {summary.alvo ? `• ${summary.alvo}` : ""}</h2><small className="text-slate-400">{dateTime(summary.finalizadaEm || item.detalhes?.finalizedAt || item.created_at)} • {summary.piloto || "Piloto"}</small></div><div className="text-right"><strong className="block text-2xl text-emerald-200">{number(summary.areaConcluidaHa ?? summary.areaHa,2)} ha</strong><small className="text-slate-400">{actualVolume > 0 ? `${number(actualVolume,1)} L registrados` : "volume real não registrado"}</small></div></div>
    <div className="mt-3 grid gap-2 text-sm md:grid-cols-3"><Mini label="Cliente / área" value={[summary.clienteNome,summary.fazendaNome,summary.talhaoNome].filter(Boolean).join(" → ") || "—"}/><Mini label="Drone / ANAC" value={`${summary.drone || "—"} • ${summary.registroAnac || "—"}`}/><Mini label="Ponta / atomizador" value={summary.pontaModelo || "—"}/><Mini label="Início / término" value={`${dateTime(summary.iniciadaEm)} → ${dateTime(summary.finalizadaEm)}`}/><Mini label="SARPAS" value={`${summary.sarpasSituacao || "—"} ${summary.sarpasNumero || ""}`.trim()}/><Mini label="Clima campo" value={`${number(summary.climaCampo?.ventoKmh,1)} km/h • ${number(summary.climaCampo?.temperaturaC,1)}°C • UR ${number(summary.climaCampo?.umidadePct,0)}%`}/></div>
    <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2"><div>GPS: {summary.gps?.disponivel ? `${number(summary.gps.latitude,5)}, ${number(summary.gps.longitude,5)}` : "—"}</div><div>Margem preventiva snapshot: {number(summary.areaSensivel?.margemPreventivaM,1)} m</div><div>Calibração: {summary.calibracaoConcluida ? "concluída" : "pendente"}</div><div>Checklist: {summary.checklistConcluido ? "concluído" : "pendente"}</div></div>
    {products.length > 0 && <p className="mt-3 text-xs text-slate-300">Produtos: {products.map((product)=>`${product.nome} ${product.dose} ${product.unidade}`).join(" • ")}</p>}
  </article>;
}
function Mini({label,value}:{label:string;value:string}) { return <div className="rounded-xl bg-white/5 p-3"><small className="text-slate-400">{label}</small><strong className="block text-sm">{value}</strong></div>; }
