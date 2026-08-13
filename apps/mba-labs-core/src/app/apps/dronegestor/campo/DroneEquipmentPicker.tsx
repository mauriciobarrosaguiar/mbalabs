"use client";

import Link from "next/link";
import { Check, ChevronDown, Drone, Loader2, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Equipment = {
  id: string;
  entityId: string;
  data: {
    nome: string;
    marca: string;
    modelo: string;
    numeroSerie?: string;
    registroAnac: string;
    tanqueL: number;
    pontaModelo: string;
    faixaPadraoM: number;
    velocidadePadraoKmh: number;
    alturaPadraoM: number;
    volumePadraoLHa: number;
  };
};

const EQUIPMENT_KEY = "dronegestor:equipmentId:v1";
const EQUIPMENT_NAME_KEY = "dronegestor:equipmentName:v1";
const MISSION_KEY = "dronegestor:mission:v2";
const STARTED_KEY = "dronegestor:started:v3";

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function DroneEquipmentPicker({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<Equipment[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [manualDismissed, setManualDismissed] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/dronegestor/equipamentos", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || "Falha ao carregar equipamentos.");
        const next = (payload.items ?? []) as Equipment[];
        setItems(next);

        const current = localStorage.getItem(EQUIPMENT_KEY) || "";
        const mission = readJson<Record<string, any>>(MISSION_KEY, {});
        const missionEquipmentId = String(mission.equipamentoId || "");
        const started = Boolean(readJson(STARTED_KEY, false));
        const currentExists = Boolean(current && next.some((item) => item.entityId === current));
        const belongsToThisMission = Boolean(currentExists && (started || current === missionEquipmentId));

        if (belongsToThisMission) {
          setSelectedId(current);
        } else {
          localStorage.removeItem(EQUIPMENT_KEY);
          localStorage.removeItem(EQUIPMENT_NAME_KEY);
          setSelectedId("");
          if (next.length > 0) setOpen(true);
        }
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar equipamentos."))
      .finally(() => setLoading(false));
  }, []);

  const selected = useMemo(() => items.find((item) => item.entityId === selectedId) ?? null, [items, selectedId]);
  const operationStarted = typeof window !== "undefined" ? Boolean(readJson(STARTED_KEY, false)) : false;

  function openSelector() {
    setManualDismissed(false);
    setOpen(true);
  }

  function apply(item: Equipment) {
    if (operationStarted) {
      setMessage("A operação já foi iniciada. Finalize ou suspenda antes de trocar o drone.");
      setOpen(false);
      return;
    }
    const previous = readJson<Record<string, any>>(MISSION_KEY, {});
    const mission = {
      ...previous,
      equipamentoId: item.entityId,
      equipamentoNome: item.data.nome,
      drone: `${item.data.marca || ""} ${item.data.modelo || ""}`.trim() || item.data.nome,
      registroAnac: item.data.registroAnac || previous.registroAnac || "",
      tanque: Number(item.data.tanqueL) || previous.tanque || 0,
      pontaModelo: item.data.pontaModelo || previous.pontaModelo || "",
      faixa: Number(item.data.faixaPadraoM) > 0 ? Number(item.data.faixaPadraoM) : previous.faixa || 0,
      velocidadeKmh: Number(item.data.velocidadePadraoKmh) > 0 ? Number(item.data.velocidadePadraoKmh) : previous.velocidadeKmh || 0,
      alturaM: Number(item.data.alturaPadraoM) > 0 ? Number(item.data.alturaPadraoM) : previous.alturaM || 0,
      volume: Number(item.data.volumePadraoLHa) > 0 ? Number(item.data.volumePadraoLHa) : previous.volume || 0
    };

    localStorage.setItem(MISSION_KEY, JSON.stringify(mission));
    localStorage.setItem(EQUIPMENT_KEY, item.entityId);
    localStorage.setItem(EQUIPMENT_NAME_KEY, item.data.nome);

    localStorage.setItem("dronegestor:calibration:v2", JSON.stringify({ ar: false, fluxometro: false, bomba: false }));
    localStorage.setItem("dronegestor:checklist:v2", JSON.stringify({ area: false, pessoasAnimais: false, obstaculos: false, drone: false, controle: false, pulverizacao: false, clima: false, documentos: false }));
    localStorage.setItem("dronegestor:insightAccepted:v2", JSON.stringify(false));
    localStorage.setItem("dronegestor:riskAccepted:v2", JSON.stringify(false));

    window.location.reload();
  }

  if (loading) {
    return <div className="border-b border-emerald-100 bg-white px-4 py-2.5 text-sm font-bold text-slate-500"><div className="mx-auto flex max-w-3xl items-center gap-2"><Loader2 className="animate-spin" size={16}/> Carregando equipamento...</div></div>;
  }

  if (items.length === 0) {
    return (
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Drone size={18} className="shrink-0"/>
          <span className="min-w-0 flex-1"><strong>Nenhum drone cadastrado.</strong> Você ainda pode preencher os dados manualmente.</span>
          {canManage && <Link href="/apps/dronegestor/equipamentos" className="shrink-0 rounded-lg bg-amber-900 px-3 py-2 text-xs font-black text-white no-underline">Cadastrar</Link>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-emerald-100 bg-white px-4 py-2.5 shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Drone size={18}/></span>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-[.12em] text-emerald-700">Drone da operação</span>
            <strong className="block truncate text-sm text-slate-950">{selected ? `${selected.data.nome} • ${selected.data.marca} ${selected.data.modelo}` : "Selecione o equipamento"}</strong>
          </div>
          <button disabled={operationStarted} onClick={openSelector} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-45">{selected ? "Trocar" : "Selecionar"}<ChevronDown size={15}/></button>
        </div>
        {message && <div className="mx-auto mt-2 max-w-3xl rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800">{message}</div>}
      </div>

      {open && !manualDismissed && (
        <div className="fixed inset-0 z-[100] grid place-items-end bg-slate-950/45 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-5">
          <section className="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-[28px] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Drone size={24}/></span>
              <div className="min-w-0 flex-1"><span className="text-xs font-black uppercase tracking-[.12em] text-emerald-700">Antes de continuar</span><h2 className="mt-1 text-2xl font-black text-slate-950">Qual drone será usado?</h2><p className="mt-1 text-sm leading-5 text-slate-500">Escolha uma vez nesta operação. Tanque, ANAC, bico e parâmetros padrão entram automaticamente.</p></div>
              {selected && <button onClick={() => setOpen(false)} className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600" aria-label="Fechar"><X size={17}/></button>}
            </div>

            <div className="mt-5 grid gap-3">
              {items.map((item) => {
                const active = item.entityId === selectedId;
                return <button key={item.entityId} onClick={() => apply(item)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${active ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{active ? <Check size={20}/> : <Drone size={20}/>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-slate-950">{item.data.nome}</strong><span className="block truncate text-sm text-slate-500">{item.data.marca} {item.data.modelo} • tanque {item.data.tanqueL} L</span></span></button>;
              })}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {canManage && <Link href="/apps/dronegestor/equipamentos" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 no-underline"><Settings2 size={17}/> Gerenciar drones</Link>}
              {!selected && <button onClick={() => { setManualDismissed(true); setOpen(false); }} className="min-h-11 rounded-xl px-4 text-sm font-bold text-slate-500">Preencher manualmente desta vez</button>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
