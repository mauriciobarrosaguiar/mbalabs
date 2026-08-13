"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, FolderCheck, Loader2, MapPinned, PlaneTakeoff, Printer, Save, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Mission = {
  ordemServicoId?: string;
  ordemServicoNumero?: string;
  clienteNome?: string;
  fazendaNome?: string;
  talhaoNome?: string;
  municipio?: string;
  uf?: string;
  cultura?: string;
  alvo?: string;
  area?: number;
  drone?: string;
  registroAnac?: string;
  sarpasSituacao?: string;
  responsavelPropriedade?: string;
  enderecoPropriedade?: string;
};

type Doc = { id:string; tipo:string; nome:string; url:string };
type Evidence = { url?:string } | null;
type Sarpas = { status?:string; numero?:string } | null;

function readJson<T>(key:string, fallback:T):T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function missionContext():Mission {
  const current = readJson<Mission>("dronegestor:mission:v2", {});
  if (current.ordemServicoId) return current;
  return { ...readJson<Mission>("dronegestor:activeMissionContext:v1", {}), ...current };
}

function closureSnapshot() {
  return {
    mission: missionContext(),
    calibration: readJson("dronegestor:calibration:v2", {}),
    checklist: readJson("dronegestor:checklist:v2", {}),
    weather: readJson("dronegestor:weather", {}),
    riskAccepted: Boolean(readJson("dronegestor:riskAccepted:v2", false)),
    progressHa: Number(readJson("dronegestor:progress:v2", 0)) || 0,
    tankRecords: readJson("dronegestor:tankRecords:v4", [])
  };
}

export function DroneOperationPackage() {
  const [mission, setMission] = useState<Mission>({});
  const [docs, setDocs] = useState<Doc[]>([]);
  const [mapa, setMapa] = useState<Evidence>(null);
  const [sarpas, setSarpas] = useState<Sarpas>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [serverMissing, setServerMissing] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [closed, setClosed] = useState(false);
  const [responsavel, setResponsavel] = useState("");
  const [endereco, setEndereco] = useState("");

  useEffect(() => {
    const next = missionContext();
    setMission(next);
    setResponsavel(next.responsavelPropriedade || "");
    setEndereco(next.enderecoPropriedade || "");
    setClosed(readJson<string>("dronegestor:closureStatus:v1", "") === "concluida");
    if (!next.ordemServicoId) {
      setLoading(false);
      return;
    }
    const osId = encodeURIComponent(next.ordemServicoId);
    void Promise.all([
      fetch(`/api/dronegestor/documentos?osId=${osId}`, { cache:"no-store" }),
      fetch(`/api/dronegestor/mapa?osId=${osId}`, { cache:"no-store" }),
      fetch(`/api/dronegestor/sarpas?osId=${osId}`, { cache:"no-store" })
    ]).then(async ([d,m,s]) => {
      const [dp,mp,sp] = await Promise.all([d.json().catch(()=>null),m.json().catch(()=>null),s.json().catch(()=>null)]);
      if (d.ok) setDocs(dp?.items ?? []);
      if (m.ok) setMapa(mp?.evidence ?? null);
      if (s.ok) setSarpas(sp?.sarpas ?? null);
    }).finally(() => setLoading(false));
  }, []);

  async function closure(action:"status"|"save_pending"|"finalize") {
    const current = missionContext();
    const osId = String(current.ordemServicoId || "");
    if (!osId) return;
    setChecking(true);
    setMessage("");
    try {
      const response = await fetch("/api/dronegestor/fechamento", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ action, osId, snapshot:closureSnapshot() }),
        cache:"no-store"
      });
      const payload = await response.json().catch(() => null);
      setServerMissing(Array.isArray(payload?.missing) ? payload.missing : []);
      if (action === "save_pending" && response.ok) {
        localStorage.setItem("dronegestor:closureStatus:v1", JSON.stringify("pendente_regularizacao"));
        setMessage("Pendências salvas. Você pode regularizar depois sem perder o que já foi registrado.");
      }
      if (action === "finalize" && response.ok) {
        localStorage.setItem("dronegestor:closureStatus:v1", JSON.stringify("concluida"));
        localStorage.setItem("dronegestor:missionStatus:v4", JSON.stringify("finalizada"));
        localStorage.setItem("dronegestor:started:v3", JSON.stringify(false));
        setClosed(true);
        setMessage("Operação finalizada e OS encerrada.");
      }
      if (!response.ok && payload?.error) setMessage(payload.error);
    } catch {
      setMessage("Não foi possível conferir o fechamento agora.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (mission.ordemServicoId && !loading) void closure("status");
  }, [mission.ordemServicoId, loading]);

  function saveProperty() {
    const current = missionContext();
    const next = { ...current, responsavelPropriedade:responsavel.trim(), enderecoPropriedade:endereco.trim() };
    localStorage.setItem("dronegestor:mission:v2", JSON.stringify(next));
    localStorage.setItem("dronegestor:activeMissionContext:v1", JSON.stringify(next));
    localStorage.setItem("dronegestor:updatedAt:v2", new Date().toISOString());
    setMission(next);
    setMessage("Dados complementares da propriedade salvos nesta operação.");
  }

  const pending = useMemo(() => {
    const items:string[] = [...serverMissing];
    if (!mission.clienteNome || !mission.fazendaNome || !mission.talhaoNome) items.push("Cliente, fazenda e talhão");
    if (!mission.municipio || !mission.uf) items.push("Município e UF");
    if (!mission.drone || !mission.registroAnac) items.push("Drone e identificação ANAC");
    if (!responsavel.trim()) items.push("Responsável/proprietário da propriedade");
    if (!endereco.trim()) items.push("Endereço ou referência cadastral da propriedade");
    if (!mapa?.url) items.push("Mapa/evidência do voo");
    const sarpasStatus = sarpas?.status || mission.sarpasSituacao || "";
    if (!["autorizado","dispensado","nao_aplicavel"].includes(sarpasStatus)) items.push("Situação SARPAS");
    return Array.from(new Set(items));
  }, [mission, mapa, sarpas, serverMissing, responsavel, endereco]);

  const ready = pending.length === 0 && !closed;

  return <main className="min-h-screen bg-[#f4f8f1] px-3 pb-28 pt-4 text-[#143d31] sm:px-6 sm:py-8">
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/apps/dronegestor" className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#d6e5dc] bg-white text-[#276650]"><ArrowLeft size={20}/></Link>
          <div className="min-w-0"><h1 className="text-2xl font-black">Finalizar operação</h1><p className="text-sm text-[#6b7c73]">Conferência do pacote da OS ativa.</p></div>
        </div>
        <button onClick={()=>window.print()} className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#087a55] text-white" aria-label="Imprimir"><Printer size={19}/></button>
      </header>

      {!mission.ordemServicoId ? <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5"><TriangleAlert className="mr-2 inline" size={18}/><strong>Nenhuma OS ativa foi encontrada.</strong><p className="mt-2 text-sm">Retorne a Operação, selecione ou retome a OS e volte aqui.</p></section> : <>
        <section className="mt-5 rounded-3xl bg-[#064e3b] p-5 text-white"><span className="text-xs font-black uppercase tracking-wider text-emerald-200">{mission.ordemServicoNumero || "OS ativa"}</span><h2 className="mt-2 text-xl font-black">{mission.fazendaNome || "Fazenda"} • {mission.talhaoNome || "Talhão"}</h2><p className="mt-2 text-sm text-emerald-100">{mission.clienteNome || "Cliente"} • {mission.cultura || "—"} • {mission.area || 0} ha</p></section>

        <section className="mt-4 rounded-3xl border border-[#d9e8df] bg-white p-5"><strong>Dados complementares da propriedade</strong><p className="mt-1 text-xs text-slate-600">Conferência interna para fechar a OS.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold"><span>Responsável / proprietário *</span><input value={responsavel} onChange={e=>setResponsavel(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3"/></label><label className="grid gap-1 text-xs font-bold"><span>Endereço / referência *</span><input value={endereco} onChange={e=>setEndereco(e.target.value)} className="min-h-11 rounded-xl border border-slate-200 px-3"/></label></div><button type="button" disabled={!responsavel.trim() || !endereco.trim()} onClick={saveProperty} className="mt-3 min-h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-black text-white disabled:opacity-40">Salvar dados da propriedade</button></section>

        <section className={`mt-4 rounded-3xl border p-5 ${closed || ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-start gap-3">{closed || ready ? <CheckCircle2 className="shrink-0 text-emerald-700"/> : <TriangleAlert className="shrink-0 text-amber-700"/>}<div className="min-w-0 flex-1"><strong className="block">{closed ? "Operação finalizada" : ready ? "Pronto para finalizar operação" : "Atenção: existem pendências"}</strong><p className="mt-1 text-sm">{closed ? "A OS foi encerrada após a conferência." : ready ? "Todos os itens obrigatórios desta conferência estão completos." : "Salve o que já foi feito e regularize o restante. O fechamento definitivo continua bloqueado."}</p></div>{checking && <Loader2 className="animate-spin" size={18}/>}</div>
          {!closed && pending.length > 0 && <div className="mt-3 grid gap-2">{pending.map(item => <div key={item} className="rounded-xl bg-white px-3 py-2 text-sm font-bold">• {item}</div>)}</div>}
          {!closed && <button type="button" disabled={checking} onClick={()=>void closure(ready ? "finalize" : "save_pending")} className={`mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:opacity-50 ${ready ? "bg-emerald-700" : "bg-amber-700"}`}>{ready ? <CheckCircle2 size={18}/> : <Save size={18}/>} {ready ? "Finalizar operação" : "Salvar pendências para regularizar"}</button>}
          {message && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold">{message}</p>}
        </section>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link href="/apps/dronegestor/documentos" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#087a55] px-4 text-center font-black text-white no-underline"><PlaneTakeoff size={18}/>SARPAS e documentos</Link>
          <Link href="/apps/dronegestor/campo" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#c8ddd1] bg-white px-4 text-center font-black text-[#176a4c] no-underline"><MapPinned size={18}/>Voltar à operação</Link>
          <Link href="/apps/dronegestor/relatorio-mensal" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#c8ddd1] bg-white px-4 text-center font-black text-[#176a4c] no-underline"><FileText size={18}/>Relatório MAPA</Link>
        </div>

        <section className="mt-4 rounded-3xl border border-[#d9e8df] bg-white p-5"><div className="flex items-center gap-2"><FolderCheck size={19}/><strong>Arquivos vinculados</strong></div><p className="mt-2 text-sm text-slate-600">{loading ? "Carregando..." : `${docs.length} documento(s) vinculado(s) a esta OS.`}</p></section>
      </>}
    </div>
  </main>;
}
