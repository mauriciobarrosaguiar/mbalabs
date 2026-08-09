"use client";

import Link from "next/link";
import { ArrowLeft, Calculator, Droplets, FlaskConical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

type DoseUnit = "mL/ha" | "L/ha" | "g/ha" | "kg/ha" | "mL/100L" | "g/100L";
type Product = { id: string; name: string; dose: string; unit: DoseUnit };

function number(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function format(value: number, digits = 2) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(Number.isFinite(value) ? value : 0);
}

function humanize(value: number, unit: "mL" | "g") {
  if (value >= 1000) return { value: value / 1000, unit: unit === "mL" ? "L" : "kg" };
  return { value, unit };
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

function newProduct(index: number): Product {
  return { id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`, name: "", dose: "", unit: "mL/ha" };
}

export function QuickCaldaCalculator() {
  const [area, setArea] = useState("");
  const [mixer, setMixer] = useState("");
  const [flow, setFlow] = useState("");
  const [products, setProducts] = useState<Product[]>([newProduct(1)]);

  const result = useMemo(() => {
    const areaHa = number(area);
    const mixerL = number(mixer);
    const flowLHa = number(flow);
    const totalSprayL = areaHa * flowLHa;
    const areaPerMixer = mixerL > 0 && flowLHa > 0 ? mixerL / flowLHa : 0;
    const fullMixes = mixerL > 0 ? Math.floor(totalSprayL / mixerL) : 0;
    const remainderL = mixerL > 0 ? totalSprayL - fullMixes * mixerL : 0;
    const hasPartial = remainderL > 0.0001;
    const mixes = totalSprayL > 0 && mixerL > 0 ? Math.ceil(totalSprayL / mixerL) : 0;
    const lastMixerL = mixes ? (hasPartial ? remainderL : mixerL) : 0;
    const lastAreaHa = flowLHa > 0 ? lastMixerL / flowLHa : 0;

    const productResults = products.map((product, index) => {
      const dose = number(product.dose);
      return {
        ...product,
        label: product.name.trim() || `Produto ${index + 1}`,
        valid: dose > 0,
        total: productAmount(dose, product.unit, areaHa, totalSprayL),
        full: productAmount(dose, product.unit, areaPerMixer, mixerL),
        last: productAmount(dose, product.unit, lastAreaHa, lastMixerL)
      };
    });

    return {
      ready: areaHa > 0 && mixerL > 0 && flowLHa > 0,
      areaHa,
      mixerL,
      flowLHa,
      totalSprayL,
      areaPerMixer,
      fullMixes,
      hasPartial,
      mixes,
      lastMixerL,
      lastAreaHa,
      productResults
    };
  }, [area, mixer, flow, products]);

  function updateProduct(id: string, patch: Partial<Product>) {
    setProducts((current) => current.map((product) => product.id === id ? { ...product, ...patch } : product));
  }

  function addProduct() {
    setProducts((current) => [...current, newProduct(current.length + 1)]);
  }

  function removeProduct(id: string) {
    setProducts((current) => current.length === 1 ? current : current.filter((product) => product.id !== id));
  }

  function clear() {
    setArea("");
    setMixer("");
    setFlow("");
    setProducts([newProduct(1)]);
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#052e16_0%,#065f46_16%,#f8fafc_16%,#f8fafc_100%)] px-3 py-4 [-webkit-text-size-adjust:100%] [text-size-adjust:100%] sm:px-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-xl gap-4">
        <header className="rounded-[26px] border border-emerald-200 bg-white p-4 shadow-xl shadow-emerald-950/10 sm:p-5">
          <div className="flex items-start gap-3">
            <Link href="/apps/dronegestor/campo" className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" aria-label="Voltar para o DroneGestor"><ArrowLeft size={20}/></Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-emerald-700 sm:text-xs"><Calculator size={15}/> DroneGestor Agro</div>
              <h1 className="mt-1 text-[27px] font-black leading-[1.02] tracking-[-0.035em] text-slate-950 sm:text-[34px]">Calda fácil</h1>
              <p className="mt-2 text-[14px] leading-5 text-slate-600">Informe área, misturador, vazão e as doses. O preparo sai pronto por carga.</p>
            </div>
          </div>
        </header>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberInput label="1. Quantos hectares?" value={area} onChange={setArea} suffix="ha" placeholder="Ex.: 10"/>
            <NumberInput label="2. Misturador" value={mixer} onChange={setMixer} suffix="L" placeholder="Ex.: 200"/>
            <NumberInput label="3. Vazão" value={flow} onChange={setFlow} suffix="L/ha" placeholder="Ex.: 10"/>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500"><strong className="text-slate-700">Vazão:</strong> use o volume de aplicação configurado, em litros por hectare.</p>
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><FlaskConical size={19}/></span>
            <div className="min-w-0 flex-1"><strong className="text-slate-950">4. Produtos e doses</strong><p className="mt-1 text-sm leading-5 text-slate-500">Adicione quantos produtos houver na receita. A calculadora separa a quantidade de cada um.</p></div>
          </div>

          <div className="mt-4 grid gap-3">
            {products.map((product, index) => (
              <div key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <strong className="text-sm text-slate-800">Produto {index + 1}</strong>
                  {products.length > 1 && <button type="button" onClick={() => removeProduct(product.id)} className="inline-flex items-center gap-1 text-xs font-black text-red-600"><Trash2 size={15}/> Remover</button>}
                </div>
                <div className="grid gap-3">
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">Nome <input className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-[16px] font-semibold text-slate-950 outline-none focus:border-emerald-500" value={product.name} placeholder={`Ex.: Produto ${index + 1}`} onChange={(e) => updateProduct(product.id, { name: e.target.value })}/></label>
                  <div className="grid grid-cols-[minmax(0,1fr)_128px] gap-2">
                    <NumberInput label="Dose" value={product.dose} onChange={(value) => updateProduct(product.id, { dose: value })} suffix="" placeholder="Ex.: 500"/>
                    <label className="grid gap-1.5 text-sm font-bold text-slate-700">Unidade
                      <select className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-2 text-[15px] font-semibold text-slate-900 outline-none focus:border-emerald-500" value={product.unit} onChange={(e) => updateProduct(product.id, { unit: e.target.value as DoseUnit })}>
                        {(["mL/ha","L/ha","g/ha","kg/ha","mL/100L","g/100L"] as DoseUnit[]).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addProduct} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-black text-emerald-800"><Plus size={18}/> Adicionar outro produto</button>
        </section>

        <section className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-emerald-950"><Droplets size={20}/><strong className="text-base">Resultado da calda</strong></div>
          {!result.ready ? (
            <p className="rounded-2xl bg-white px-4 py-5 text-center text-sm font-bold leading-5 text-slate-500">Informe hectares, litros do misturador e vazão em L/ha.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Result label="Calda total" value={`${format(result.totalSprayL, 1)} L`}/>
                <Result label="Misturas" value={`${result.mixes}`}/>
                <Result label={result.fullMixes > 0 ? "Cada carga cheia cobre" : "Carga única cobre"} value={`${format(result.fullMixes > 0 ? result.areaPerMixer : result.lastAreaHa, 2)} ha`}/>
                <Result label={result.hasPartial ? (result.fullMixes > 0 ? "Última carga" : "Carga única") : "Carga padrão"} value={`${format(result.lastMixerL, 1)} L`}/>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
                <strong className="text-base text-emerald-950">Preparo fácil</strong>
                <p className="mt-1 text-sm font-bold text-slate-700">
                  {result.fullMixes === 0 && result.hasPartial
                    ? `Faça 1 carga de ${format(result.lastMixerL, 1)} L.`
                    : result.hasPartial
                      ? `Faça ${result.fullMixes} carga(s) cheia(s) + 1 carga final de ${format(result.lastMixerL, 1)} L.`
                      : `Faça ${result.fullMixes} carga(s) cheia(s) de ${format(result.mixerL, 1)} L.`}
                </p>
                <div className="mt-3 grid gap-3 text-sm">
                  {result.fullMixes > 0 && <div className="rounded-xl bg-emerald-50 p-3 text-emerald-950">
                    <strong>Carga cheia — {format(result.mixerL, 1)} L de calda final</strong>
                    <span className="mt-1 block text-xs text-emerald-800">Cobre aproximadamente {format(result.areaPerMixer, 2)} ha.</span>
                    <ProductList products={result.productResults} mode="full"/>
                  </div>}
                  {result.hasPartial && <div className="rounded-xl bg-amber-50 p-3 text-amber-950">
                    <strong>{result.fullMixes > 0 ? "Última carga" : "Carga única"} — {format(result.lastMixerL, 1)} L de calda final</strong>
                    <span className="mt-1 block text-xs text-amber-800">Cobre {format(result.lastAreaHa, 2)} ha.</span>
                    <ProductList products={result.productResults} mode="last"/>
                  </div>}
                </div>
              </div>

              {result.productResults.some((product) => product.valid) && <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <strong className="text-sm text-slate-900">Total de produto para toda a área</strong>
                <div className="mt-2 grid gap-2">
                  {result.productResults.filter((product) => product.valid).map((product) => <div key={product.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-600">{product.label}</span><strong className="shrink-0 text-slate-950">{format(product.total.value, 3)} {product.total.unit}</strong></div>)}
                </div>
              </div>}
            </>
          )}
        </section>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950"><strong>Importante:</strong> a calculadora apenas divide matematicamente as doses já definidas. Ordem de mistura, compatibilidade, adjuvantes e dose devem seguir receita, bula e orientação técnica.</div>

        <button onClick={clear} className="mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-black text-slate-700"><RotateCcw size={18}/> Limpar calculadora</button>
      </div>
    </main>
  );
}

function ProductList({ products, mode }: { products: Array<Product & { label: string; valid: boolean; full: { value: number; unit: string }; last: { value: number; unit: string } }>; mode: "full" | "last" }) {
  const validProducts = products.filter((product) => product.valid);
  if (!validProducts.length) return <span className="mt-2 block text-xs text-slate-500">Informe a dose dos produtos para ver a quantidade desta carga.</span>;
  return <div className="mt-3 grid gap-2">{validProducts.map((product) => { const amount = mode === "full" ? product.full : product.last; return <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2"><span className="min-w-0 truncate font-bold text-slate-700">{product.label}</span><strong className="shrink-0 text-slate-950">{format(amount.value, 3)} {amount.unit}</strong></div>; })}</div>;
}

function NumberInput({ label, value, onChange, suffix, placeholder }: { label: string; value: string; onChange: (value: string) => void; suffix: string; placeholder?: string }) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-700">{label}<div className="flex min-h-12 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-emerald-500"><input inputMode="decimal" type="number" min="0" step="any" className="min-w-0 flex-1 px-3 text-[16px] font-black text-slate-950 outline-none placeholder:font-bold placeholder:text-slate-400" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}/>{suffix && <span className="grid shrink-0 place-items-center border-l border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-500">{suffix}</span>}</div></label>;
}

function Result({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl border border-white bg-white p-3 shadow-sm sm:p-4"><span className="block text-[10px] font-bold uppercase leading-4 tracking-wide text-slate-500 sm:text-xs">{label}</span><strong className="mt-1 block break-words text-lg font-black leading-6 text-slate-950 sm:text-xl">{value}</strong></div>;
}
