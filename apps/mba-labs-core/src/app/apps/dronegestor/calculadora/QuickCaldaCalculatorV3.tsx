"use client";

import Link from "next/link";
import { ArrowLeft, BookOpenCheck, Calculator, CheckCircle2, Droplets, FlaskConical, ListOrdered, Plus, RotateCcw, ShieldAlert, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductLookup, type ProductCatalogItem } from "./ProductLookup";

type DoseUnit = "mL/ha" | "L/ha" | "g/ha" | "kg/ha" | "mL/100L" | "g/100L";
type Formulation = "" | "COND" | "WG_WDG_DF" | "WP" | "SG_SP" | "SC_SE_CS" | "OD" | "EC_EW_ME" | "SL" | "ADJ_OIL" | "BIO_FERT_OTHER";
type Product = { id: string; name: string; dose: string; unit: DoseUnit; formulation: Formulation; catalog: ProductCatalogItem | null };
type Amount = { value: number; unit: string };
type SequenceSource = "bula" | "general" | "pending";
type CalculatedProduct = Product & {
  label: string;
  valid: boolean;
  formulationLabel: string;
  order: number;
  sequenceSource: SequenceSource;
  total: Amount;
  full: Amount;
  last: Amount;
};

const FORMULATIONS: Array<{ value: Formulation; label: string; short: string; order: number; automatic: boolean }> = [
  { value: "", label: "Selecionar formulação", short: "Não informada", order: 999, automatic: false },
  { value: "COND", label: "Condicionador / corretor de água", short: "Condicionador", order: 5, automatic: true },
  { value: "WG_WDG_DF", label: "WG / WDG / DF — grânulos dispersíveis", short: "WG/WDG/DF", order: 20, automatic: true },
  { value: "WP", label: "WP — pó molhável", short: "WP", order: 25, automatic: true },
  { value: "SG_SP", label: "SG / SP — sólido solúvel", short: "SG/SP", order: 30, automatic: true },
  { value: "SC_SE_CS", label: "SC / SE / CS — suspensão", short: "SC/SE/CS", order: 40, automatic: true },
  { value: "OD", label: "OD — dispersão oleosa", short: "OD", order: 45, automatic: true },
  { value: "EC_EW_ME", label: "EC / EW / ME — emulsificável", short: "EC/EW/ME", order: 50, automatic: true },
  { value: "SL", label: "SL — solução líquida", short: "SL", order: 60, automatic: true },
  { value: "ADJ_OIL", label: "Óleo / adjuvante", short: "Óleo/adjuvante", order: 70, automatic: true },
  { value: "BIO_FERT_OTHER", label: "Biológico / fertilizante / outra formulação", short: "Conferir especificamente", order: 999, automatic: false }
];

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
function productAmount(dose: number, unit: DoseUnit, areaHa: number, sprayL: number): Amount {
  if (!dose) return { value: 0, unit: "" };
  if (unit === "mL/ha") return humanize(areaHa * dose, "mL");
  if (unit === "L/ha") return { value: areaHa * dose, unit: "L" };
  if (unit === "g/ha") return humanize(areaHa * dose, "g");
  if (unit === "kg/ha") return { value: areaHa * dose, unit: "kg" };
  if (unit === "mL/100L") return humanize((sprayL / 100) * dose, "mL");
  return humanize((sprayL / 100) * dose, "g");
}
function formulationInfo(value: Formulation) {
  return FORMULATIONS.find((item) => item.value === value) || FORMULATIONS[0];
}
function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}
function mapFormulation(raw: string): Formulation {
  const value = normalizeText(raw);
  if (!value) return "";
  if (value.includes("CONDIC") || value.includes("CORRETOR") || value.includes("PH")) return "COND";
  if (/\b(WG|WDG|DF)\b/.test(value)) return "WG_WDG_DF";
  if (/\bWP\b/.test(value)) return "WP";
  if (/\b(SG|SP)\b/.test(value)) return "SG_SP";
  if (/\b(SC|SE|CS)\b/.test(value)) return "SC_SE_CS";
  if (/\bOD\b/.test(value)) return "OD";
  if (/\b(EC|EW|ME)\b/.test(value)) return "EC_EW_ME";
  if (/\bSL\b/.test(value)) return "SL";
  if (value.includes("ADJUV") || value.includes("OLEO") || value.includes("ÓLEO")) return "ADJ_OIL";
  if (value.includes("BIOLOG") || value.includes("FERTIL")) return "BIO_FERT_OTHER";
  return "";
}
function newProduct(index: number): Product {
  return { id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`, name: "", dose: "", unit: "mL/ha", formulation: "", catalog: null };
}

export function QuickCaldaCalculatorV3() {
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

    const productResults: CalculatedProduct[] = products.map((product, index) => {
      const dose = number(product.dose);
      const verifiedGroup = product.catalog?.verification.status === "verified" ? mapFormulation(product.catalog.verification.sequenceGroup) : "";
      const effectiveFormulation = verifiedGroup || product.formulation;
      const info = formulationInfo(effectiveFormulation);
      const sequenceSource: SequenceSource = product.catalog?.verification.status === "verified" && verifiedGroup ? "bula" : info.automatic ? "general" : "pending";
      return {
        ...product,
        formulation: effectiveFormulation,
        label: product.name.trim() || `Produto ${index + 1}`,
        valid: dose > 0,
        formulationLabel: info.short,
        order: info.order,
        sequenceSource,
        total: productAmount(dose, product.unit, areaHa, totalSprayL),
        full: productAmount(dose, product.unit, areaPerMixer, mixerL),
        last: productAmount(dose, product.unit, lastAreaHa, lastMixerL)
      };
    });

    const activeProducts = productResults.filter((product) => product.valid);
    const orderedProducts = [...activeProducts].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "pt-BR"));
    const pendingSequence = activeProducts.filter((product) => product.sequenceSource === "pending");
    const sequenceReady = activeProducts.length > 0 && pendingSequence.length === 0;
    const allBulaVerified = activeProducts.length > 0 && activeProducts.every((product) => product.catalog?.verification.status === "verified");

    return { ready: areaHa > 0 && mixerL > 0 && flowLHa > 0, areaHa, mixerL, flowLHa, totalSprayL, areaPerMixer, fullMixes, hasPartial, mixes, lastMixerL, lastAreaHa, productResults, activeProducts, orderedProducts, pendingSequence, sequenceReady, allBulaVerified };
  }, [area, mixer, flow, products]);

  function updateProduct(id: string, patch: Partial<Product>) {
    setProducts((current) => current.map((product) => product.id === id ? { ...product, ...patch } : product));
  }
  function selectCatalogProduct(id: string, item: ProductCatalogItem) {
    const suggested = mapFormulation(item.verification.sequenceGroup || item.formulation);
    updateProduct(id, { name: item.name, catalog: item, formulation: suggested || "" });
  }
  function addProduct() { setProducts((current) => [...current, newProduct(current.length + 1)]); }
  function removeProduct(id: string) { setProducts((current) => current.length === 1 ? current : current.filter((product) => product.id !== id)); }
  function clear() { setArea(""); setMixer(""); setFlow(""); setProducts([newProduct(1)]); }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#052e16_0%,#065f46_16%,#f8fafc_16%,#f8fafc_100%)] px-3 py-4 [-webkit-text-size-adjust:100%] [text-size-adjust:100%] sm:px-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-xl gap-4">
        <header className="rounded-[26px] border border-emerald-200 bg-white p-4 shadow-xl shadow-emerald-950/10 sm:p-5">
          <div className="flex items-start gap-3">
            <Link href="/apps/dronegestor/campo" className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" aria-label="Voltar para o DroneGestor"><ArrowLeft size={20}/></Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-emerald-700 sm:text-xs"><Calculator size={15}/> DroneGestor Agro</div>
              <h1 className="mt-1 text-[27px] font-black leading-[1.02] tracking-[-0.035em] text-slate-950 sm:text-[34px]">Calda fácil</h1>
              <p className="mt-2 text-[14px] leading-5 text-slate-600">Busque o produto no catálogo, informe a dose e receba o preparo por carga.</p>
              <Link href="/apps/dronegestor/produtos" className="mt-3 inline-flex items-center gap-2 text-xs font-black text-emerald-700"><BookOpenCheck size={15}/> Biblioteca de produtos e bulas</Link>
            </div>
          </div>
        </header>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberInput label="1. Quantos hectares?" value={area} onChange={setArea} suffix="ha" placeholder="Ex.: 10"/>
            <NumberInput label="2. Misturador" value={mixer} onChange={setMixer} suffix="L" placeholder="Ex.: 200"/>
            <NumberInput label="3. Vazão" value={flow} onChange={setFlow} suffix="L/ha" placeholder="Ex.: 10"/>
          </div>
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700"><FlaskConical size={19}/></span>
            <div className="min-w-0 flex-1"><strong className="text-slate-950">4. Produtos e doses</strong><p className="mt-1 text-sm leading-5 text-slate-500">Pesquise primeiro na biblioteca. Se não encontrar, ainda é possível preencher manualmente.</p></div>
          </div>

          <div className="mt-4 grid gap-3">
            {products.map((product, index) => (
              <div key={product.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-3"><strong className="text-sm text-slate-800">Produto {index + 1}</strong>{products.length > 1 && <button type="button" onClick={() => removeProduct(product.id)} className="inline-flex items-center gap-1 text-xs font-black text-red-600"><Trash2 size={15}/> Remover</button>}</div>
                <div className="grid gap-3">
                  <ProductLookup value={product.name} selected={product.catalog} onChange={(name) => updateProduct(product.id, { name, catalog: product.catalog?.name === name ? product.catalog : null })} onSelect={(item) => selectCatalogProduct(product.id, item)}/>
                  <div className="grid grid-cols-[minmax(0,1fr)_128px] gap-2">
                    <NumberInput label="Dose" value={product.dose} onChange={(dose) => updateProduct(product.id, { dose })} suffix="" placeholder="Ex.: 500"/>
                    <label className="grid gap-1.5 text-sm font-bold text-slate-700">Unidade<select className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-2 text-[15px] font-semibold text-slate-900 outline-none focus:border-emerald-500" value={product.unit} onChange={(event) => updateProduct(product.id, { unit: event.target.value as DoseUnit })}>{(["mL/ha","L/ha","g/ha","kg/ha","mL/100L","g/100L"] as DoseUnit[]).map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
                  </div>
                  <label className="grid gap-1.5 text-sm font-bold text-slate-700">Formulação / tipo<select className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-semibold text-slate-900 outline-none focus:border-emerald-500" value={product.formulation} onChange={(event) => updateProduct(product.id, { formulation: event.target.value as Formulation })}>{FORMULATIONS.map((item) => <option key={item.value || "empty"} value={item.value}>{item.label}</option>)}</select></label>
                  {product.catalog?.formulation && <p className="text-xs text-slate-500">Formulação no catálogo: <strong>{product.catalog.formulation}</strong></p>}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={addProduct} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-black text-emerald-800"><Plus size={18}/> Adicionar outro produto</button>
        </section>

        <section className="rounded-[26px] border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-emerald-950"><Droplets size={20}/><strong className="text-base">Resultado da calda</strong></div>
          {!result.ready ? <p className="rounded-2xl bg-white px-4 py-5 text-center text-sm font-bold leading-5 text-slate-500">Informe hectares, litros do misturador e vazão em L/ha.</p> : <>
            <div className="grid grid-cols-2 gap-3"><Result label="Calda total" value={`${format(result.totalSprayL, 1)} L`}/><Result label="Misturas" value={`${result.mixes}`}/><Result label={result.fullMixes > 0 ? "Cada carga cheia cobre" : "Carga única cobre"} value={`${format(result.fullMixes > 0 ? result.areaPerMixer : result.lastAreaHa, 2)} ha`}/><Result label={result.hasPartial ? (result.fullMixes > 0 ? "Última carga" : "Carga única") : "Carga padrão"} value={`${format(result.lastMixerL, 1)} L`}/></div>

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
              <strong className="text-base text-emerald-950">Preparo fácil</strong>
              <p className="mt-1 text-sm font-bold text-slate-700">{result.fullMixes === 0 && result.hasPartial ? `Faça 1 carga de ${format(result.lastMixerL, 1)} L.` : result.hasPartial ? `Faça ${result.fullMixes} carga(s) cheia(s) + 1 carga final de ${format(result.lastMixerL, 1)} L.` : `Faça ${result.fullMixes} carga(s) cheia(s) de ${format(result.mixerL, 1)} L.`}</p>
              <div className="mt-3 grid gap-3 text-sm">{result.fullMixes > 0 && <LoadCard title={`Carga cheia — ${format(result.mixerL, 1)} L`} subtitle={`Cobre aproximadamente ${format(result.areaPerMixer, 2)} ha.`} products={result.productResults} mode="full" tone="green"/>}{result.hasPartial && <LoadCard title={`${result.fullMixes > 0 ? "Última carga" : "Carga única"} — ${format(result.lastMixerL, 1)} L`} subtitle={`Cobre ${format(result.lastAreaHa, 2)} ha.`} products={result.productResults} mode="last" tone="amber"/>}</div>
            </div>

            {result.activeProducts.length > 0 && <>
              <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <div className="flex items-center gap-2 text-sky-950"><ListOrdered size={19}/><strong>Sequência de mistura</strong></div>
                <p className="mt-1 text-xs leading-5 text-sky-900">Itens marcados <strong>Bula</strong> usam o grupo de sequência validado na biblioteca. Itens <strong>Geral</strong> usam somente a referência por formulação e ainda não são “conforme bula”.</p>
                <div className="mt-3 grid gap-2">{result.orderedProducts.filter((product) => product.sequenceSource !== "pending").map((product, index) => <SequenceRow key={product.id} product={product} index={index}/>)}</div>
                {result.pendingSequence.length > 0 && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-5 text-amber-950"><strong>Conferência obrigatória:</strong> {result.pendingSequence.map((product) => product.label).join(", ")} não recebeu posição segura. Confira a bula/receita/RT antes de misturar.</div>}
                {!result.allBulaVerified && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-bold leading-5 text-slate-600">A sequência completa ainda não é classificada como “verificada na bula” porque existe produto sem revisão concluída.</p>}
              </section>

              <section className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <div className="flex items-center gap-2 text-violet-950"><FlaskConical size={19}/><strong>Receita do preparo</strong></div>
                <p className="mt-1 text-xs leading-5 text-violet-900">As quantidades são calculadas pela dose informada. A compatibilidade da mistura continua exigindo conferência específica.</p>
                {result.fullMixes > 0 && <RecipeCard title={`${result.fullMixes} carga(s) cheia(s) — repetir este preparo`} finalLiters={result.mixerL} areaHa={result.areaPerMixer} products={result.orderedProducts} mode="full" sequenceReady={result.sequenceReady}/>} 
                {result.hasPartial && <RecipeCard title={result.fullMixes > 0 ? "Última carga" : "Carga única"} finalLiters={result.lastMixerL} areaHa={result.lastAreaHa} products={result.orderedProducts} mode="last" sequenceReady={result.sequenceReady}/>} 
              </section>
            </>}

            {result.activeProducts.length > 0 && <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><strong className="text-sm text-slate-900">Total de produto para toda a área</strong><div className="mt-2 grid gap-2">{result.activeProducts.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-600">{product.label}</span><strong className="shrink-0 text-slate-950">{format(product.total.value, 3)} {product.total.unit}</strong></div>)}</div></div>}
          </>}
        </section>

        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-950"><div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 shrink-0" size={18}/><div><strong>Antes de misturar:</strong> confirme dose, compatibilidade, formulação, bula/receita e qualidade da água. Selecionar um produto no AGROFIT não significa que a ordem de mistura está automaticamente validada.</div></div></div>
        <button onClick={clear} className="mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 font-black text-slate-700"><RotateCcw size={18}/> Limpar calculadora</button>
      </div>
    </main>
  );
}

function SequenceRow({ product, index }: { product: CalculatedProduct; index: number }) {
  const verified = product.sequenceSource === "bula";
  return <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-700 text-xs font-black text-white">{index + 1}</span><div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{product.label}</strong><span className="text-xs text-slate-500">{product.formulationLabel}</span></div><span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${verified ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{verified && <CheckCircle2 size={11}/>} {verified ? "Bula" : "Geral"}</span></div>;
}

function LoadCard({ title, subtitle, products, mode, tone }: { title: string; subtitle: string; products: CalculatedProduct[]; mode: "full" | "last"; tone: "green" | "amber" }) {
  const validProducts = products.filter((product) => product.valid);
  const toneClass = tone === "green" ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950";
  return <div className={`rounded-xl p-3 ${toneClass}`}><strong>{title}</strong><span className="mt-1 block text-xs opacity-80">{subtitle}</span>{validProducts.length ? <div className="mt-3 grid gap-2">{validProducts.map((product) => { const amount = mode === "full" ? product.full : product.last; return <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/85 px-3 py-2"><span className="min-w-0 truncate font-bold text-slate-700">{product.label}</span><strong className="shrink-0 text-slate-950">{format(amount.value, 3)} {amount.unit}</strong></div>; })}</div> : <span className="mt-2 block text-xs text-slate-500">Informe as doses para ver a quantidade de cada produto.</span>}</div>;
}

function RecipeCard({ title, finalLiters, areaHa, products, mode, sequenceReady }: { title: string; finalLiters: number; areaHa: number; products: CalculatedProduct[]; mode: "full" | "last"; sequenceReady: boolean }) {
  const ordered = products.filter((product) => product.valid && product.sequenceSource !== "pending");
  const pending = products.filter((product) => product.valid && product.sequenceSource === "pending");
  return <div className="mt-3 rounded-2xl border border-violet-200 bg-white p-4"><strong className="text-sm text-violet-950">{title}</strong><span className="mt-1 block text-xs text-slate-500">Volume final: {format(finalLiters, 1)} L • Área: {format(areaHa, 2)} ha</span><ol className="mt-3 grid gap-2 text-sm leading-5 text-slate-700"><li><strong>1.</strong> Separe os produtos desta carga e confira nome, dose, validade, formulação e EPI.</li><li><strong>2.</strong> Adicione água suficiente para iniciar agitação/recirculação, sem completar o volume final.</li>{ordered.map((product, index) => { const amount = mode === "full" ? product.full : product.last; return <li key={product.id}><strong>{index + 3}.</strong> Adicione <strong>{format(amount.value, 3)} {amount.unit} de {product.label}</strong> ({product.formulationLabel}). {product.catalog?.verification.status === "verified" && product.catalog.verification.preparationSummary ? <span className="text-emerald-800">Bula revisada: {product.catalog.verification.preparationSummary}</span> : <span>Sequência baseada apenas na formulação; confira a bula.</span>}</li>; })}{pending.length > 0 && <li className="rounded-lg bg-amber-50 p-2 text-amber-950"><strong>{ordered.length + 3}.</strong> Antes de adicionar <strong>{pending.map((product) => product.label).join(", ")}</strong>, confirme a posição correta na bula/receita/RT.</li>}<li><strong>{ordered.length + (pending.length ? 4 : 3)}.</strong> Complete com água até <strong>{format(finalLiters, 1)} L de volume final</strong>, mantendo a agitação.</li><li><strong>{ordered.length + (pending.length ? 5 : 4)}.</strong> Confira a homogeneidade e mantenha a agitação conforme orientação dos produtos.</li></ol>{!sequenceReady && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-950">Receita parcial: existe produto sem posição segura. Não inicie a mistura até confirmar esse item.</p>}</div>;
}

function NumberInput({ label, value, onChange, suffix, placeholder }: { label: string; value: string; onChange: (value: string) => void; suffix: string; placeholder?: string }) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-700">{label}<div className="flex min-h-12 overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-emerald-500"><input inputMode="decimal" type="text" className="min-w-0 flex-1 px-3 text-[16px] font-black text-slate-950 outline-none placeholder:font-bold placeholder:text-slate-400" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value.replace(/[^0-9,.]/g, ""))}/>{suffix && <span className="grid shrink-0 place-items-center border-l border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-500">{suffix}</span>}</div></label>;
}
function Result({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl border border-white bg-white p-3 shadow-sm sm:p-4"><span className="block text-[10px] font-bold uppercase leading-4 tracking-wide text-slate-500 sm:text-xs">{label}</span><strong className="mt-1 block break-words text-lg font-black leading-6 text-slate-950 sm:text-xl">{value}</strong></div>;
}
