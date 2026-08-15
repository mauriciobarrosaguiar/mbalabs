"use client";

import { CheckCircle2, Clock3, Download, FileCheck2, FileText, MapPinned, PlaneTakeoff, ShieldCheck, Sprout, TriangleAlert, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AnyRecord = Record<string, any>;
type Doc = { id?: string; tipo?: string; nome?: string; url?: string };
type OperationPayload = { ok?: boolean; state?: AnyRecord; source?: string; pilotName?: string; syncUpdatedAt?: string; os?: { id?: string; status?: string; numero?: string; fechamentoStatus?: string; pendencias?: string[] }; error?: string };

function n(value: unknown, decimals = 1) {
  const parsed = Number(value);
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number.isFinite(parsed) ? parsed : 0);
}
function dt(value: unknown) {
  const raw = String(value || "");
  if (!raw) return "Não informado";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
function duration(start: unknown, end: unknown) {
  const a = Date.parse(String(start || "")), b = Date.parse(String(end || ""));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return "Não calculada";
  const total = Math.round((b - a) / 60000), h = Math.floor(total / 60), m = total % 60;
  return h ? `${h}h ${m}min` : `${m} min`;
}
function yes(value: unknown) { return value === true ? "Conferido" : "Pendente"; }

export function DroneFinalOsSummary() {
  const [payload, setPayload] = useState<OperationPayload | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [mapOk, setMapOk] = useState(false);
  const [sarpas, setSarpas] = useState<AnyRecord>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let osId = params.get("osId") || "";
    if (!osId) {
      try { osId = JSON.parse(localStorage.getItem("dronegestor:mission:v2") || "{}").ordemServicoId || ""; } catch {}
    }
    if (!osId) { setLoading(false); return; }
    const encoded = encodeURIComponent(osId);
    void Promise.all([
      fetch(`/api/dronegestor/operacao-os?osId=${encoded}`, { cache: "no-store" }),
      fetch(`/api/dronegestor/documentos?osId=${encoded}`, { cache: "no-store" }),
      fetch(`/api/dronegestor/mapa?osId=${encoded}`, { cache: "no-store" }),
      fetch(`/api/dronegestor/sarpas?osId=${encoded}`, { cache: "no-store" }),
    ]).then(async ([o, d, m, s]) => {
      const [op, dp, mp, sp] = await Promise.all([o.json().catch(() => null), d.json().catch(() => null), m.json().catch(() => null), s.json().catch(() => null)]);
      if (o.ok && op?.ok) setPayload(op);
      if (d.ok) setDocs(Array.isArray(dp?.items) ? dp.items : []);
      if (m.ok) setMapOk(Boolean(mp?.evidence?.url || mp?.evidence));
      if (s.ok) setSarpas(sp?.sarpas || {});
    }).finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const state = payload?.state || {}, mission = state.mission || {};
    const tanks = Array.isArray(state.tankRecords) ? state.tankRecords : [];
    const products = Array.isArray(mission.produtos) ? mission.produtos : [];
    const occurrences = Array.isArray(state.occurrences) ? state.occurrences : [];
    const progress = Number(state.progressHa) || 0, area = Number(mission.area) || 0;
    const totalReal = tanks.reduce((sum: number, item: AnyRecord) => sum + Math.max(0, Number(item?.volumeL) || 0), 0);
    const weather = state.weather || {};
    const osStatus = payload?.os?.status || "";
    const closure = payload?.os?.fechamentoStatus || "";
    const pending = Array.isArray(payload?.os?.pendencias) ? payload!.os!.pendencias! : [];
    const status = osStatus === "concluida" ? "OS encerrada" : osStatus === "campo_concluido" ? (closure === "pronto" ? "Pronta para encerrar" : "Campo concluído - regularização") : "Operação em andamento";
    return { state, mission, tanks, products, occurrences, progress, area, totalReal, weather, osStatus, closure, pending, status };
  }, [payload]);

  if (loading || !payload?.state || !summary.mission?.ordemServicoId) return null;

  const m = summary.mission, state = summary.state;
  const sarpasStatus = String(sarpas?.status || m.sarpasSituacao || "");
  const sarpasNumero = String(sarpas?.numero || m.sarpasNumero || "");
  const docsCount = docs.length;
  const closed = summary.osStatus === "concluida";
  const pdfHref = `/api/dronegestor/pacote-operacao/pdf?osId=${encodeURIComponent(String(m.ordemServicoId))}`;

  return <section className="mx-auto mt-5 w-full max-w-5xl px-3 sm:px-6">
    <div className="overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-sm">
      <header className="bg-[linear-gradient(135deg,#064e3b,#087a55)] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider"><FileCheck2 size={15}/> Resumo da OS</div><h2 className="mt-3 text-2xl font-black">{payload.os?.numero || m.ordemServicoNumero || "Ordem de serviço"}</h2><p className="mt-1 text-sm text-emerald-100">{m.fazendaNome || "Fazenda"} • {m.talhaoNome || "Talhão"} • {n(m.area, 2)} ha</p></div>
          <span className={`rounded-full px-3 py-2 text-xs font-black ${closed ? "bg-emerald-200 text-emerald-950" : summary.osStatus === "campo_concluido" ? "bg-amber-200 text-amber-950" : "bg-white/15 text-white"}`}>{summary.status}</span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-emerald-100">Este é o resumo simples da aplicação. Use os blocos abaixo para conferir o serviço sem precisar procurar informação em várias telas.</p>
      </header>

      <div className="grid gap-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info icon={<UserRound size={18}/>} label="Quem fez" value={payload.pilotName || "Piloto não identificado"} sub={m.drone ? `${m.drone} • ANAC ${m.registroAnac || "não informado"}` : "Drone não informado"}/>
          <Info icon={<MapPinned size={18}/>} label="Onde" value={[m.clienteNome, m.fazendaNome, m.talhaoNome].filter(Boolean).join(" → ") || "Não informado"} sub={[m.municipio, m.uf].filter(Boolean).join("/") || "Localidade não informada"}/>
          <Info icon={<Sprout size={18}/>} label="O que foi feito" value={`${m.cultura || "Cultura não informada"}${m.alvo ? ` • ${m.alvo}` : ""}`} sub={`${n(summary.progress || summary.area, 2)} ha realizados de ${n(summary.area, 2)} ha`}/>
          <Info icon={<Clock3 size={18}/>} label="Quando" value={`${dt(state.startedAt)} → ${dt(state.endedAt || state.concluidaNoDispositivoEm)}`} sub={`Duração: ${duration(state.startedAt, state.endedAt || state.concluidaNoDispositivoEm)}`}/>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Card title="Aplicação e produtos" icon={<Sprout size={18}/>}>
            <Line label="Volume planejado" value={`${n(m.volume, 1)} L/ha`}/><Line label="Faixa / velocidade / altura" value={`${n(m.faixa, 1)} m • ${n(m.velocidadeKmh, 1)} km/h • ${n(m.alturaM, 1)} m`}/><Line label="Cargas registradas" value={String(summary.tanks.length)}/><Line label="Volume real registrado" value={`${n(summary.totalReal, 1)} L`}/>
            <div className="mt-3 grid gap-2">{summary.products.length ? summary.products.map((p: AnyRecord, i: number) => <div key={`${p?.nome || "produto"}-${i}`} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm"><strong>{p?.nome || `Produto ${i + 1}`}</strong><span className="ml-2 text-slate-600">{n(p?.dose, 2)} {p?.unidade || ""}</span></div>) : <p className="text-sm text-slate-500">Nenhum produto registrado.</p>}</div>
          </Card>
          <Card title="Segurança e ocorrências" icon={<ShieldCheck size={18}/>}>
            <Line label="Calibração" value={yes(Object.values(state.calibration || {}).length > 0 && Object.values(state.calibration || {}).every(Boolean))}/><Line label="Checklist pré-voo" value={yes(Object.values(state.checklist || {}).length > 0 && Object.values(state.checklist || {}).every(Boolean))}/><Line label="Análise de risco" value={yes(state.riskAccepted === true)}/><Line label="GPS" value={Number.isFinite(Number(summary.weather?.latitude)) && Number.isFinite(Number(summary.weather?.longitude)) ? `${Number(summary.weather.latitude).toFixed(5)}, ${Number(summary.weather.longitude).toFixed(5)}` : "Pendente"}/><Line label="Ocorrências" value={String(summary.occurrences.length)}/>
          </Card>
        </div>

        <Card title="Regularização e documentos" icon={<FileText size={18}/>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><Status ok={sarpasStatus === "autorizado" && Boolean(sarpasNumero)} label="SARPAS" detail={sarpasStatus === "autorizado" ? `Autorizado • ${sarpasNumero || "sem referência"}` : "Pendente"}/><Status ok={docsCount > 0} label="Documentos" detail={`${docsCount} arquivo(s) vinculado(s)`}/><Status ok={mapOk} label="Mapa do voo" detail={mapOk ? "Evidência vinculada" : "Pendente"}/><Status ok={summary.pending.length === 0 && summary.osStatus === "concluida"} label="Fechamento" detail={summary.osStatus === "concluida" ? "OS encerrada" : summary.pending.length ? `${summary.pending.length} pendência(s)` : "Aguardando encerramento"}/></div>
          {docsCount > 0 && <div className="mt-3 flex flex-wrap gap-2">{docs.slice(0, 8).map((doc, i) => <span key={doc.id || i} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{doc.nome || doc.tipo || "Documento"}</span>)}</div>}
        </Card>

        <div className="grid gap-2 sm:grid-cols-3"><a href={pdfHref} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white no-underline"><Download size={18}/>Gerar pacote em PDF</a><a href={`/apps/dronegestor/documentos?osId=${encodeURIComponent(String(m.ordemServicoId))}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 no-underline"><FileText size={18}/>Ver documentos</a><button type="button" onClick={()=>window.print()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"><FileCheck2 size={18}/>Imprimir resumo</button></div>
        <p className="text-xs leading-5 text-slate-500">O PDF é o prontuário interno desta aplicação e reúne os dados e a relação de evidências vinculadas. Ele não substitui o relatório mensal oficial do MAPA.</p>
      </div>
    </div>
  </section>;
}

function Info({icon,label,value,sub}:{icon:React.ReactNode;label:string;value:string;sub:string}) { return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-emerald-700">{icon}<span className="text-xs font-black uppercase tracking-wide">{label}</span></div><strong className="mt-2 block text-sm text-slate-950">{value}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{sub}</p></div>; }
function Card({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}) { return <section className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-emerald-700">{icon}<strong className="text-sm text-slate-950">{title}</strong></div><div className="mt-3">{children}</div></section>; }
function Line({label,value}:{label:string;value:string}) { return <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0"><span className="text-slate-500">{label}</span><strong className="text-right text-slate-900">{value}</strong></div>; }
function Status({ok,label,detail}:{ok:boolean;label:string;detail:string}) { return <div className={`rounded-xl border p-3 ${ok ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><div className="flex items-center gap-2">{ok ? <CheckCircle2 className="text-emerald-700" size={17}/> : <TriangleAlert className="text-amber-700" size={17}/>}<strong className="text-sm text-slate-950">{label}</strong></div><p className="mt-1 text-xs text-slate-600">{detail}</p></div>; }
