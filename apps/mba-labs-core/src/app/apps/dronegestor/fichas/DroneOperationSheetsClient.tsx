"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, History, ImageIcon, Loader2, MapPinned, Printer, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Product = { nome?: string; dose?: number; unidade?: string };
type TankRecord = { id?: string; at?: string; areaHa?: number; volumeL?: number; note?: string };
type Occurrence = { id?: string; at?: string; type?: string; note?: string };
type Summary = {
  piloto?: string; ordemServicoId?: string; ordemServicoNumero?: string; clienteNome?: string; fazendaNome?: string; talhaoNome?: string; municipio?: string; uf?: string;
  cultura?: string; alvo?: string; tipoAtividade?: string; areaHa?: number; areaConcluidaHa?: number; drone?: string; registroAnac?: string; pontaModelo?: string;
  volumeLHa?: number; totalCaldaL?: number; totalCaldaRealL?: number; faixaM?: number; velocidadeKmh?: number; alturaM?: number;
  sarpasNumero?: string; sarpasSituacao?: string; sarpasConfirmado?: boolean; climaCampoMedidoEm?: string;
  climaCampo?: { ventoKmh?: number | null; direcaoVento?: string; temperaturaC?: number | null; umidadePct?: number | null };
  areaSensivel?: { semAreaSensivel?: boolean; distanciaM?: number | null; margemPreventivaM?: number; bloqueioMargemAtivo?: boolean };
  gps?: { latitude?: number | null; longitude?: number | null; capturadoEm?: string; disponivel?: boolean };
  produtos?: Product[]; tanques?: TankRecord[]; ocorrencias?: Occurrence[]; calibracaoConcluida?: boolean; checklistConcluido?: boolean; insightConfirmado?: boolean; riscoConfirmado?: boolean;
  totalOcorrencias?: number; iniciadaEm?: string; finalizadaEm?: string;
};
type HistoryItem = { id: string; created_at: string; detalhes?: { operationId?: string; finalizedAt?: string; summary?: Summary } };
type MapPhoto = { id: string; url: string; uploadedAt?: string; source?: string };
type Geometry = { areaHa: number; pointCount: number; sourceName: string; sourceFormat: string; center?: { latitude: number; longitude: number } };

function num(value: unknown, decimals = 1) {
  const parsed = Number(value);
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number.isFinite(parsed) ? parsed : 0);
}
function dateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function yesNo(value?: boolean) { return value ? "Sim" : "Não"; }

export function DroneOperationSheetsClient({ userName, companyMode }: { userName: string; companyMode: boolean }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  const [mapPhoto, setMapPhoto] = useState<MapPhoto | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/dronegestor/state?history=1&limit=500&offset=0", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Falha ao carregar operações.");
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar operações.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const s = item.detalhes?.summary ?? {};
      return [s.ordemServicoNumero, s.clienteNome, s.fazendaNome, s.talhaoNome, s.cultura, s.alvo, s.piloto, s.drone]
        .some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [items, filter]);

  async function openSheet(item: HistoryItem) {
    setSelected(item);
    setMapPhoto(null);
    setGeometry(null);
    const osId = item.detalhes?.summary?.ordemServicoId || "";
    if (!osId) return;
    setLoadingEvidence(true);
    try {
      const [photoResponse, geometryResponse] = await Promise.all([
        fetch(`/api/dronegestor/mapa?osId=${encodeURIComponent(osId)}`, { cache: "no-store" }),
        fetch(`/api/dronegestor/mapa-geometria?osId=${encodeURIComponent(osId)}`, { cache: "no-store" })
      ]);
      if (photoResponse.ok) {
        const payload = await photoResponse.json().catch(() => null);
        setMapPhoto(payload?.evidence ?? null);
      }
      if (geometryResponse.ok) {
        const payload = await geometryResponse.json().catch(() => null);
        setGeometry(payload?.geometry ?? null);
      }
    } finally { setLoadingEvidence(false); }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_45%,#eef2f7_100%)] px-4 py-6 text-slate-950 print:bg-white print:p-0">
      <div className={`mx-auto w-full max-w-6xl ${selected ? "print:max-w-none" : ""}`}>
        <header className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/apps/dronegestor" className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700"><ArrowLeft size={20}/></Link>
            <div><span className="text-xs font-black uppercase tracking-[.12em] text-emerald-700">DroneGestor</span><h1 className="text-2xl font-black sm:text-3xl">Fichas das operações</h1><p className="text-sm text-slate-600">{companyMode ? "Operações da empresa / RT" : `Operações de ${userName}`}</p></div>
          </div>
          <Link href="/apps/dronegestor/historico" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 no-underline"><History size={17}/> Histórico / CSV</Link>
        </header>

        <section className="mt-5 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm print:hidden">
          <div className="flex items-center gap-3"><Search size={18} className="text-emerald-700"/><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar OS, cliente, fazenda, talhão, cultura ou drone..." className="min-h-11 min-w-0 flex-1 border-0 bg-white px-1 text-slate-950 outline-none placeholder:text-slate-400"/></div>
        </section>

        {loading ? <div className="grid min-h-64 place-items-center print:hidden"><Loader2 className="animate-spin text-emerald-700" size={28}/></div> : error ? <div className="mt-4 rounded-xl bg-red-50 p-4 text-red-800 print:hidden">{error}</div> : !selected ? (
          <section className="mt-4 grid gap-3 print:hidden">
            {visible.length === 0 ? <div className="grid min-h-52 place-items-center rounded-2xl border border-slate-200 bg-white text-center text-slate-500"><div><FileText className="mx-auto mb-2"/><p>Nenhuma operação encontrada.</p></div></div> : visible.map((item) => <SheetCard key={item.id} item={item} onOpen={() => void openSheet(item)}/>) }
          </section>
        ) : (
          <OperationSheet item={selected} mapPhoto={mapPhoto} geometry={geometry} loadingEvidence={loadingEvidence} onClose={() => setSelected(null)}/>
        )}
      </div>
    </main>
  );
}

function SheetCard({ item, onOpen }: { item: HistoryItem; onOpen: () => void }) {
  const s = item.detalhes?.summary ?? {};
  return <button type="button" onClick={onOpen} className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:flex-row sm:items-center">
    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 size={21}/></span>
    <span className="min-w-0 flex-1"><span className="block text-xs font-black uppercase tracking-wide text-emerald-700">{s.ordemServicoNumero || "Operação concluída"}</span><strong className="mt-1 block truncate text-lg text-slate-950">{s.clienteNome || "Cliente"} • {s.fazendaNome || "Fazenda"}</strong><span className="mt-1 block truncate text-sm text-slate-600">{s.talhaoNome || "Talhão"} • {s.cultura || "Cultura"} {s.alvo ? `• ${s.alvo}` : ""}</span></span>
    <span className="shrink-0 sm:text-right"><strong className="block text-xl text-emerald-800">{num(s.areaConcluidaHa ?? s.areaHa, 2)} ha</strong><span className="text-xs text-slate-500">{dateTime(s.finalizadaEm || item.detalhes?.finalizedAt || item.created_at)}</span></span>
  </button>;
}

function OperationSheet({ item, mapPhoto, geometry, loadingEvidence, onClose }: { item: HistoryItem; mapPhoto: MapPhoto | null; geometry: Geometry | null; loadingEvidence: boolean; onClose: () => void }) {
  const s = item.detalhes?.summary ?? {};
  const products = s.produtos ?? [];
  const tanks = s.tanques ?? [];
  const occurrences = s.ocorrencias ?? [];
  return <article className="mt-0 rounded-none bg-white text-slate-950 sm:mt-5 sm:rounded-[28px] sm:border sm:border-slate-200 sm:p-6 sm:shadow-sm print:m-0 print:border-0 print:p-0 print:shadow-none">
    <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
      <div><span className="text-xs font-black uppercase tracking-[.12em] text-emerald-700">Ficha interna da operação</span><h2 className="mt-1 text-2xl font-black">{s.ordemServicoNumero || "Operação concluída"}</h2><p className="mt-1 text-sm text-slate-600">Registro de conferência do DroneGestor. Não é relatório oficial nem comprovante de protocolo em órgão público.</p></div>
      <div className="flex gap-2 print:hidden"><button onClick={() => window.print()} className="grid size-11 place-items-center rounded-xl bg-emerald-700 text-white" aria-label="Imprimir ou salvar PDF"><Printer size={19}/></button><button onClick={onClose} className="grid size-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" aria-label="Fechar ficha"><X size={19}/></button></div>
    </div>

    <Section title="Serviço"><div className="grid gap-2 sm:grid-cols-3"><Data label="Cliente" value={s.clienteNome}/><Data label="Fazenda" value={s.fazendaNome}/><Data label="Talhão" value={s.talhaoNome}/><Data label="Município / UF" value={[s.municipio, s.uf].filter(Boolean).join(" / ")}/><Data label="Cultura" value={s.cultura}/><Data label="Alvo" value={s.alvo}/><Data label="Piloto" value={s.piloto}/><Data label="Início" value={dateTime(s.iniciadaEm)}/><Data label="Término" value={dateTime(s.finalizadaEm)}/></div></Section>

    <Section title="Aplicação"><div className="grid gap-2 sm:grid-cols-4"><Data label="Área planejada" value={`${num(s.areaHa, 2)} ha`}/><Data label="Área registrada" value={`${num(s.areaConcluidaHa ?? s.areaHa, 2)} ha`}/><Data label="Volume/ha" value={`${num(s.volumeLHa, 1)} L/ha`}/><Data label="Calda real" value={`${num(s.totalCaldaRealL, 1)} L`}/><Data label="Drone" value={s.drone}/><Data label="ANAC" value={s.registroAnac}/><Data label="Ponta / atomizador" value={s.pontaModelo}/><Data label="Faixa" value={`${num(s.faixaM, 1)} m`}/><Data label="Velocidade" value={`${num(s.velocidadeKmh, 1)} km/h`}/><Data label="Altura" value={`${num(s.alturaM, 1)} m`}/></div></Section>

    <Section title="Produtos e doses"><div className="grid gap-2">{products.length ? products.map((product, index) => <div key={`${product.nome}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"><strong>{product.nome || `Produto ${index + 1}`}</strong><span>{num(product.dose, 2)} {product.unidade || ""}</span></div>) : <Empty/>}</div></Section>

    <Section title="Clima e segurança"><div className="grid gap-2 sm:grid-cols-4"><Data label="Vento medido" value={`${num(s.climaCampo?.ventoKmh, 1)} km/h`}/><Data label="Direção" value={s.climaCampo?.direcaoVento}/><Data label="Temperatura" value={`${num(s.climaCampo?.temperaturaC, 1)} °C`}/><Data label="Umidade" value={`${num(s.climaCampo?.umidadePct, 0)} %`}/><Data label="Medição" value={dateTime(s.climaCampoMedidoEm)}/><Data label="Área sensível" value={s.areaSensivel?.semAreaSensivel ? "Sem área sensível informada" : `${num(s.areaSensivel?.distanciaM, 0)} m`}/><Data label="Margem interna" value={`${num(s.areaSensivel?.margemPreventivaM, 0)} m`}/><Data label="GPS" value={s.gps?.disponivel ? `${Number(s.gps.latitude).toFixed(5)}, ${Number(s.gps.longitude).toFixed(5)}` : "Não registrado"}/></div></Section>

    <Section title="Liberação e conferências"><div className="grid gap-2 sm:grid-cols-4"><Data label="SARPAS" value={`${s.sarpasSituacao || "—"}${s.sarpasNumero ? ` • ${s.sarpasNumero}` : ""}`}/><Data label="Calibração" value={yesNo(s.calibracaoConcluida)}/><Data label="Checklist" value={yesNo(s.checklistConcluido)}/><Data label="Risco conferido" value={yesNo(s.riscoConfirmado)}/><Data label="Insight interno" value={yesNo(s.insightConfirmado)}/></div></Section>

    <Section title="Abastecimentos"><div className="grid gap-2">{tanks.length ? tanks.map((tank, index) => <div key={tank.id || index} className="grid gap-1 rounded-xl bg-slate-50 px-3 py-2 text-sm sm:grid-cols-4"><strong>Carga {index + 1}</strong><span>{num(tank.areaHa, 2)} ha</span><span>{num(tank.volumeL, 1)} L</span><span className="text-slate-500">{tank.note || dateTime(tank.at)}</span></div>) : <Empty/>}</div></Section>

    <Section title="Ocorrências"><div className="grid gap-2">{occurrences.length ? occurrences.map((occurrence, index) => <div key={occurrence.id || index} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950"><strong>{occurrence.type || `Ocorrência ${index + 1}`}</strong><span className="ml-2">{occurrence.note || "Sem observação"}</span><small className="ml-2 text-amber-700">{dateTime(occurrence.at)}</small></div>) : <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">Nenhuma ocorrência registrada.</p>}</div></Section>

    <Section title="Mapa e evidências">
      {loadingEvidence ? <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={17}/> Carregando evidências...</div> : <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-black"><ImageIcon size={17}/> Foto do mapa/controle</div>{mapPhoto?.url ? <img src={mapPhoto.url} alt="Mapa usado no voo" className="max-h-72 w-full rounded-lg object-contain"/> : <Empty text="Sem foto registrada."/>}</div>
        <div className="rounded-xl border border-slate-200 p-3"><div className="mb-2 flex items-center gap-2 text-sm font-black"><MapPinned size={17}/> Polígono geográfico</div>{geometry ? <div className="grid gap-2"><Data label="Área calculada pelo arquivo" value={`${num(geometry.areaHa, 2)} ha`}/><Data label="Arquivo" value={geometry.sourceName}/><Data label="Formato / pontos" value={`${geometry.sourceFormat.toUpperCase()} • ${geometry.pointCount} pontos`}/></div> : <Empty text="Sem KML/GeoJSON registrado."/>}</div>
      </div>}
    </Section>

    <footer className="mt-6 border-t border-slate-200 pt-3 text-[11px] leading-5 text-slate-500">Ficha gerada a partir dos registros salvos no DroneGestor. Antes de qualquer uso regulatório ou envio a terceiros, confira os documentos oficiais, a receita agronômica e as exigências vigentes aplicáveis à operação.</footer>
  </article>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-5 break-inside-avoid"><h3 className="mb-2 text-sm font-black uppercase tracking-[.08em] text-emerald-800">{title}</h3>{children}</section>; }
function Data({ label, value }: { label: string; value?: string }) { return <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span><strong className="mt-0.5 block text-sm text-slate-800">{value || "—"}</strong></div>; }
function Empty({ text = "Nenhum registro." }: { text?: string }) { return <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">{text}</p>; }
