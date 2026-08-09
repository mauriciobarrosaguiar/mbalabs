"use client";

import Link from "next/link";
import { ArrowLeft, Calculator, Droplets, FlaskConical, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";

type DoseUnit = "mL/ha" | "L/ha" | "g/ha" | "kg/ha" | "mL/100L" | "g/100L";

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function format(value: number, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
}

function productAmount(dose: number, unit: DoseUnit, areaHa: number, sprayL: number) {
  if (!dose) return { value: 0, unit: "" };
  if (unit === "mL/ha") return humanize(areaHa * dose, "mL");
  if (unit === "L/ha") return { value: areaHa * dose, unit: "L" };
  if (unit === "g/ha") return humanize(areaHa * dose, "g");
  if (unit === "kg/ha") return { value: areaHa * dose, unit: "kg" };
  if (unit === "mL/100L") return humanize((sprayL / 100) * dose, "mL");
  return humanize((sprayL / 100) * dose, "g");
}

function humanize(value: number, unit: "mL" | "g") {
  if (value >= 1000) return { value: value / 1000, unit: unit === "mL" ? "L" : "kg" };
  return { value, unit };
}

export function QuickCaldaCalculator() {
  const [area, setArea] = useState("");
  const [volume, setVolume] = useState("");
  const [tank, setTank] = useState("");
  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState<DoseUnit>("mL/ha");

  const result = useMemo(() => {
    const areaHa = number(area);
    const lHa = number(volume);
    const tankL = number(tank);
    const doseValue = number(dose);
    const totalSprayL = areaHa * lHa;
    const areaPerTank = lHa > 0 && tankL > 0 ? tankL / lHa : 0;
    const tanks = totalSprayL > 0 && tankL > 0 ? Math.ceil(totalSprayL / tankL) : 0;
    const fullTanks = tankL > 0 ? Math.floor(totalSprayL / tankL) : 0;
    const remainder = totalSprayL > 0 && tankL > 0 ? totalSprayL - fullTanks * tankL : 0;
    const lastTankL = tanks ? (remainder > 0.0001 ? remainder : tankL) : 0;
    const lastAreaHa = lHa > 0 ? lastTankL / lHa : 0;

    return {
      ready: areaHa > 0 && lHa > 0 && tankL > 0,
      areaHa,
      lHa,
      tankL,
      totalSprayL,
      areaPerTank,
      tanks,
      lastTankL,
      totalProduct: productAmount(doseValue, doseUnit, areaHa, totalSprayL),
      fullTankProduct: productAmount(doseValue, doseUnit, areaPerTank, tankL),
      lastTankProduct: productAmount(doseValue, doseUnit, lastAreaHa, lastTankL),
      hasDose: doseValue > 0
    };
  }, [area, volume, tank, dose, doseUnit]);

  function clear() {
    setArea("");
    setVolume("");
    setTank("");
    setDose("");
    setDoseUnit("mL/ha");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#052e16_0%,#065f46_22%,#f8fafc_22%,#f8fafc_100%)] px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-2xl gap-4">
        <header className="rounded-[28px] border border-emerald-200 bg-white p-5 shadow-xl shadow-emerald-950/10">
          <div className="flex items-center gap-3">
            <Link href="/apps/dronegestor/campo" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-700" aria-label="Voltar para o DroneGestor">
              <ArrowLeft size={20}/>
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-emerald-700"><Calculator size={16}/> DroneGestor Agro</div>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Calculadora rápida de calda</h1>
              <p className="mt-1 text-sm text-slate-600">Preencha só 3 dados. O resultado aparece automaticamente.</p>
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-3">
            <NumberInput label="1. Área" value={area} onChange={setArea} suffix="ha" placeholder="Ex.: 10"/>
            <NumberInput label="2. Volume" value={volume} onChange={setVolume} suffix="L/ha" placeholder="Ex.: 10"/>
            <NumberInput label="3. Tanque" value={tank} onChange={setTank} suffix="L" placeholder="Ex.: 40"/>
          </div>
        </section>

        <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-5">
          <div className="mb-4 flex items-center gap-2 text-emerald-950"><Droplets size={20}/><strong>Resultado</strong></div>
          {!result.ready ? (
            <p className="rounded-2xl bg-white px-4 py-5 text-center text-sm font-bold text-slate-500">Informe área, L/ha e capacidade do tanque.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Result label="Calda total" value={`${format(result.totalSprayL, 1)} L`}/>
              <Result label="Área / tanque" value={`${format(result.areaPerTank, 2)} ha`}/>
              <Result label="Tanques" value={`${result.tanks}`}/>
              <Result label="Último tanque" value={`${format(result.lastTankL, 1)} L`}/>
            </div>
          )}
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><FlaskConical size={19}/></span>
            <div>
              <strong className="text-slate-950">Produto — opcional</strong>
              <p className="mt-1 text-sm text-slate-500">Só preencha se já tiver a dose definida na receita/bula/orientação técnica.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-[1fr_140px] gap-2">
            <NumberInput label="Dose" value={dose} onChange={setDose} suffix="" placeholder="Ex.: 500"/>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700">Unidade
              <select className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold text-slate-900 outline-none focus:border-emerald-500" value={doseUnit} onChange={(e)=>setDoseUnit(e.target.value as DoseUnit)}>
                {(["mL/ha","L/ha","g/ha","kg/ha","mL/100L","g/100L"] as DoseUnit[]).map((unit)=><option key={unit} value={unit}>{unit}</option>)}
              </select>
            </label>
          </div>
          {result.ready && result.hasDose && <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Result label="Produto total" value={`${format(result.totalProduct.value, 3)} ${result.totalProduct.unit}`}/>
            <Result label="Por tanque cheio" value={`${format(result.fullTankProduct.value, 3)} ${result.fullTankProduct.unit}`}/>
            <Result label="No último tanque" value={`${format(result.lastTankProduct.value, 3)} ${result.lastTankProduct.unit}`}/>
          </div>}
        </section>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Cálculo matemático.</strong> Esta tela não recomenda dose nem substitui receita, bula, RT ou conferência de compatibilidade da mistura.
        </div>

        <button onClick={clear} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-black text-slate-700"><RotateCcw size={18}/> Limpar calculadora</button>
      </div>
    </main>
  );
}

function NumberInput({label,value,onChange,suffix,placeholder}:{label:string;value:string;onChange:(value:string)=>void;suffix:string;placeholder?:string}) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-700">{label}<div className="flex min-h-12 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-emerald-500"><input inputMode="decimal" type="number" min="0" step="any" className="min-w-0 flex-1 px-3 text-lg font-black text-slate-950 outline-none" value={value} placeholder={placeholder} onChange={(e)=>onChange(e.target.value)}/>{suffix&&<span className="grid place-items-center border-l border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-500">{suffix}</span>}</div></label>;
}

function Result({label,value}:{label:string;value:string}) {
  return <div className="rounded-2xl border border-white bg-white p-4 shadow-sm"><span className="block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span><strong className="mt-1 block text-xl font-black text-slate-950">{value}</strong></div>;
}
