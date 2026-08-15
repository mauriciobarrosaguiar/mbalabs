"use client";

import { Calculator, Droplets } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DoseUnit = "mL/ha" | "L/ha" | "g/ha" | "kg/ha" | "mL/100L" | "g/100L";
type Product = { id: string; nome: string; dose: number; unidade: DoseUnit };
type Mission = { volume?: number; produtos?: Product[] };

const MISSION_KEY = "dronegestor:mission:v2";
const VIEW_KEY = "dronegestor:view:v3";
const CALC_KEY = "dronegestor:mixer-calculator:v1";
const SLOT_ID = "dronegestor-mixer-calculator-slot";

function readMission(): Mission {
  try { return JSON.parse(localStorage.getItem(MISSION_KEY) || "{}") as Mission; } catch { return {}; }
}
function readSaved() {
  try { return JSON.parse(localStorage.getItem(CALC_KEY) || "{}") as { misturador?: number; vazao?: number; produtoId?: string }; } catch { return {}; }
}
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function fmt(value: number, digits = 2) { return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0); }
function humanAmount(value: number, unit: string) {
  if (unit === "mL" && value >= 1000) return `${fmt(value / 1000, 3)} L (${fmt(value, 0)} mL)`;
  if (unit === "g" && value >= 1000) return `${fmt(value / 1000, 3)} kg (${fmt(value, 0)} g)`;
  return `${fmt(value, 3)} ${unit}`;
}
function findCalculationTitle() {
  return Array.from(document.querySelectorAll("strong")).find((element) => element.textContent?.trim() === "Cálculo de calda") ?? null;
}

export function DroneMixerCalculator() {
  const saved = useMemo(() => typeof window === "undefined" ? {} : readSaved(), []);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [mission, setMission] = useState<Mission>({});
  const [misturador, setMisturador] = useState(num(saved.misturador));
  const [vazao, setVazao] = useState(num(saved.vazao));
  const [produtoId, setProdutoId] = useState(String(saved.produtoId || ""));
  const lastMission = useRef("");

  useEffect(() => {
    const sync = () => {
      if ((localStorage.getItem(VIEW_KEY) || "inicio") !== "calda") { setSlot(null); return; }
      const raw = localStorage.getItem(MISSION_KEY) || "{}";
      if (raw !== lastMission.current) {
        lastMission.current = raw;
        const next = readMission();
        setMission(next);
        setVazao((current) => current > 0 ? current : num(next.volume));
        const products = Array.isArray(next.produtos) ? next.produtos : [];
        setProdutoId((current) => products.some((item) => item.id === current) ? current : (products[0]?.id || ""));
      }

      const title = findCalculationTitle();
      const titleRoot = title?.parentElement?.parentElement;
      if (!titleRoot?.parentElement) return;
      let node = document.getElementById(SLOT_ID);
      if (!node) {
        node = document.createElement("div");
        node.id = SLOT_ID;
        titleRoot.insertAdjacentElement("afterend", node);
      }
      if (node.parentElement !== titleRoot.parentElement) titleRoot.insertAdjacentElement("afterend", node);
      setSlot(node);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(sync, 450);
    return () => { observer.disconnect(); window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    localStorage.setItem(CALC_KEY, JSON.stringify({ misturador, vazao, produtoId }));
  }, [misturador, vazao, produtoId]);

  const products = Array.isArray(mission.produtos) ? mission.produtos : [];
  const product = products.find((item) => item.id === produtoId) ?? products[0] ?? null;
  const dose = num(product?.dose);
  const unit = product?.unidade || "mL/ha";
  const perHectare = unit.endsWith("/ha");
  const areaMisturador = misturador > 0 && vazao > 0 ? misturador / vazao : 0;
  const factor100L = misturador > 0 ? misturador / 100 : 0;
  const factor = perHectare ? areaMisturador : factor100L;
  const amount = dose > 0 && factor > 0 ? dose * factor : 0;
  const outputUnit = unit.startsWith("mL") ? "mL" : unit.startsWith("L") ? "L" : unit.startsWith("kg") ? "kg" : "g";
  const ready = misturador > 0 && vazao > 0 && Boolean(product) && dose > 0;

  if (!slot) return null;

  return createPortal(
    <section className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><Calculator size={20}/></span>
        <div><strong className="block text-base text-slate-950">Calculadora do misturador</strong><p className="mt-1 text-xs leading-5 text-slate-600">Preencha o misturador, confira a vazão e escolha o produto. O sistema mostra a conta completa, não só o resultado.</p></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-bold text-slate-700"><span>Misturador (M)</span><div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3"><input className="min-w-0 flex-1 outline-none" type="number" step="any" min="0" value={misturador || ""} onChange={(event) => setMisturador(Math.max(0, num(event.target.value)))}/><b className="ml-2 text-xs text-slate-500">L</b></div></label>
        <label className="grid gap-1 text-sm font-bold text-slate-700"><span>Vazão (V)</span><div className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-3"><input className="min-w-0 flex-1 outline-none" type="number" step="any" min="0" value={vazao || ""} onChange={(event) => setVazao(Math.max(0, num(event.target.value)))}/><b className="ml-2 text-xs text-slate-500">L/ha</b></div></label>
        <label className="grid gap-1 text-sm font-bold text-slate-700"><span>Produto (P)</span><select className="min-h-11 rounded-xl border border-slate-200 bg-white px-3" value={product?.id || ""} onChange={(event) => setProdutoId(event.target.value)}>{products.length === 0 && <option value="">Sem produto</option>}{products.map((item) => <option key={item.id} value={item.id}>{item.nome || "Produto"} — {fmt(num(item.dose), 3)} {item.unidade}</option>)}</select></label>
      </div>

      {product && <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs text-slate-700"><Droplets size={15} className="text-emerald-700"/><span><strong>P = {fmt(dose, 3)} {unit}</strong> • {product.nome}</span></div>}

      {ready ? perHectare ? <div className="grid gap-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3"><span className="text-[11px] font-black uppercase tracking-wide text-emerald-700">1. M ÷ V</span><strong className="mt-1 block text-base text-slate-950">{fmt(misturador, 2)} L ÷ {fmt(vazao, 2)} L/ha = {fmt(areaMisturador, 3)} ha</strong><p className="mt-1 text-xs text-slate-500">O misturador cobre {fmt(areaMisturador, 3)} hectares nessa vazão.</p></div>
        <div className="rounded-xl border border-emerald-300 bg-emerald-100/70 p-3"><span className="text-[11px] font-black uppercase tracking-wide text-emerald-800">2. P × (M ÷ V)</span><strong className="mt-1 block text-base text-emerald-950">{fmt(dose, 3)} {unit} × {fmt(areaMisturador, 3)} ha = {humanAmount(amount, outputUnit)}</strong><p className="mt-1 text-xs text-emerald-800">Quantidade de {product.nome} para {fmt(misturador, 1)} L de calda.</p></div>
      </div> : <div className="grid gap-2">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><span className="text-[11px] font-black uppercase tracking-wide text-amber-800">Dose por 100 L</span><strong className="mt-1 block text-base text-amber-950">{fmt(misturador, 2)} L ÷ 100 L = {fmt(factor100L, 3)}</strong><p className="mt-1 text-xs text-amber-800">Como a dose está em {unit}, a conta correta usa o volume de 100 L, e não M ÷ V.</p></div>
        <div className="rounded-xl border border-emerald-300 bg-emerald-100/70 p-3"><span className="text-[11px] font-black uppercase tracking-wide text-emerald-800">P × (M ÷ 100)</span><strong className="mt-1 block text-base text-emerald-950">{fmt(dose, 3)} {unit} × {fmt(factor100L, 3)} = {humanAmount(amount, outputUnit)}</strong><p className="mt-1 text-xs text-emerald-800">Quantidade de {product.nome} para {fmt(misturador, 1)} L de calda.</p></div>
      </div> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">Informe um valor maior que zero para <strong>Misturador</strong> e <strong>Vazão</strong>, e mantenha o produto com dose preenchida. A conta aparecerá aqui.</div>}
    </section>,
    slot
  );
}
