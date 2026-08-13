"use client";

import { BookOpenCheck, Check, Loader2, Search, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type MissionProduct = { id: string; nome: string; dose: number; unidade: string };
type Mission = { produtos?: MissionProduct[]; sarpasNumero?: string; sarpasSituacao?: string; sarpasConfirmado?: boolean } & Record<string, unknown>;
type VerificationStatus = "verified" | "no_explicit_order" | "review_required";
type ProductResult = {
  key: string;
  name: string;
  registration?: string;
  activeIngredient?: string;
  formulation?: string;
  holder?: string;
  verification?: { status?: VerificationStatus; sourceTitle?: string };
};

type View = "inicio" | "nova" | "calda" | "estrategia" | "seguranca" | "controle" | "calibracao" | "checklist" | "sarpas" | "execucao" | "relatorios" | "config";

const MISSION_KEY = "dronegestor:mission:v2";
const VIEW_KEY = "dronegestor:view:v3";
const LOCKED_STATUSES = new Set(["pendente_sync", "finalizada"]);

function readView(): View {
  try { return (localStorage.getItem(VIEW_KEY) || "inicio") as View; } catch { return "inicio"; }
}
function readMission(): Mission {
  try { return JSON.parse(localStorage.getItem(MISSION_KEY) || "{}") as Mission; } catch { return {}; }
}
function isLocked() {
  try {
    const started = Boolean(JSON.parse(localStorage.getItem("dronegestor:started:v3") || "false"));
    const status = JSON.parse(localStorage.getItem("dronegestor:missionStatus:v4") || '"rascunho"') as string;
    return started || LOCKED_STATUSES.has(status);
  } catch { return false; }
}

function verificationLabel(status?: VerificationStatus) {
  if (status === "verified") return "Revisado pelo RT";
  if (status === "no_explicit_order") return "Fonte revisada";
  return "Identificação oficial";
}

export function DroneProductMissionPicker() {
  const [view, setView] = useState<View>("inicio");
  const [mission, setMission] = useState<Mission>({});
  const [open, setOpen] = useState(false);
  const [slotId, setSlotId] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ProductResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sync = () => {
      setView(readView());
      setMission(readMission());
    };
    sync();
    const interval = window.setInterval(sync, 450);
    return () => window.clearInterval(interval);
  }, []);

  const products = useMemo(() => Array.isArray(mission.produtos) ? mission.produtos : [], [mission.produtos]);
  const visible = view === "nova" || view === "calda";

  function startSearch(product?: MissionProduct) {
    if (isLocked()) return;
    const selected = product || products[0];
    setSlotId(selected?.id || "");
    setQuery(selected?.nome || "");
    setItems([]);
    setMessage("");
    setOpen(true);
  }

  async function search(event?: FormEvent) {
    event?.preventDefault();
    const value = query.trim();
    if (value.length < 2) return setMessage("Digite pelo menos 2 caracteres para buscar.");
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/dronegestor/produtos?q=${encodeURIComponent(value)}&limit=15`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível consultar a biblioteca.");
      const next = (payload?.items ?? []) as ProductResult[];
      setItems(next);
      if (!next.length) setMessage("Nenhum produto encontrado. Você pode continuar digitando o nome manualmente na missão.");
      else if (payload?.officialAvailable === false) setMessage("Fonte oficial temporariamente indisponível; resultados locais podem estar incompletos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na consulta.");
    } finally {
      setLoading(false);
    }
  }

  function choose(item: ProductResult) {
    if (isLocked()) return setMessage("A operação já está bloqueada para alteração de produtos.");
    const current = readMission();
    const currentProducts = Array.isArray(current.produtos) ? current.produtos : [];
    const target = slotId || currentProducts[0]?.id || "";
    if (!target) return setMessage("Adicione um produto na missão antes de selecionar pela biblioteca.");
    const nextProducts = currentProducts.map((product) => product.id === target ? { ...product, nome: item.name } : product);
    const next: Mission = {
      ...current,
      produtos: nextProducts,
      sarpasConfirmado: false,
      sarpasSituacao: "",
      sarpasNumero: ""
    };
    localStorage.setItem(MISSION_KEY, JSON.stringify(next));
    localStorage.setItem("dronegestor:insightAccepted:v2", JSON.stringify(false));
    localStorage.setItem("dronegestor:riskAccepted:v2", JSON.stringify(false));
    localStorage.setItem("dronegestor:calibration:v2", JSON.stringify({ ar: false, fluxometro: false, bomba: false }));
    localStorage.setItem("dronegestor:checklist:v2", JSON.stringify({ area: false, pessoasAnimais: false, obstaculos: false, drone: false, controle: false, pulverizacao: false, clima: false, documentos: false }));
    localStorage.setItem("dronegestor:syncDirty:v4", "1");
    localStorage.setItem("dronegestor:updatedAt:v2", new Date().toISOString());
    setOpen(false);
    window.location.reload();
  }

  if (!visible || products.length === 0) return null;

  return (
    <>
      <section className="border-b border-emerald-100 bg-white px-3 py-2.5 sm:px-5">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-700"><BookOpenCheck size={18}/></span>
          <div className="min-w-0 flex-1">
            <strong className="block text-xs font-black text-emerald-950">Produto correto, sem adivinhar</strong>
            <p className="mt-0.5 text-[11px] leading-4 text-emerald-800">Busque na base oficial para preencher o nome. A dose continua sendo digitada conforme receita/bula.</p>
          </div>
          <button disabled={isLocked()} type="button" onClick={() => startSearch()} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Buscar</button>
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><BookOpenCheck size={21}/></span>
              <div className="min-w-0 flex-1"><span className="text-xs font-black uppercase tracking-[.1em] text-emerald-700">Biblioteca oficial</span><h2 className="mt-1 text-xl font-black text-slate-950">Qual produto é este?</h2><p className="mt-1 text-sm leading-5 text-slate-600">Escolha somente o nome correto. O DroneGestor não altera a dose que você informou.</p></div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600" aria-label="Fechar"><X size={18}/></button>
            </div>

            {products.length > 1 && <div className="mt-4"><label className="grid gap-1 text-sm font-bold text-slate-700"><span>Qual linha da mistura?</span><select value={slotId} onChange={(event) => { const id = event.target.value; setSlotId(id); const found = products.find((product) => product.id === id); setQuery(found?.nome || ""); setItems([]); }} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-slate-950">{products.map((product, index) => <option key={product.id} value={product.id}>Produto {index + 1}{product.nome ? ` — ${product.nome}` : ""}</option>)}</select></label></div>}

            <form onSubmit={search} className="mt-4 flex gap-2">
              <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, registro ou ingrediente ativo" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-slate-950 outline-none placeholder:text-slate-400 focus:border-emerald-500"/>
              <button disabled={loading} className="grid size-12 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white disabled:opacity-60" type="submit" aria-label="Buscar produto">{loading ? <Loader2 className="animate-spin" size={19}/> : <Search size={19}/>}</button>
            </form>

            {message && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-950">{message}</p>}

            <div className="mt-4 grid gap-2">
              {items.map((item) => <button key={item.key} type="button" onClick={() => choose(item)} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-300"><span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Check size={18}/></span><span className="min-w-0 flex-1"><strong className="block text-sm text-slate-950">{item.name}</strong><span className="mt-1 block text-xs leading-5 text-slate-600">{[item.registration ? `Reg. ${item.registration}` : "", item.activeIngredient, item.formulation].filter(Boolean).join(" • ")}</span><span className="mt-1 block text-[11px] font-bold text-emerald-700">{verificationLabel(item.verification?.status)}</span></span></button>)}
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">A seleção serve para identificar corretamente o produto. Dose, compatibilidade, sequência de mistura e indicação agronômica continuam dependentes da receita, bula vigente e RT.</p>
          </section>
        </div>
      )}
    </>
  );
}
