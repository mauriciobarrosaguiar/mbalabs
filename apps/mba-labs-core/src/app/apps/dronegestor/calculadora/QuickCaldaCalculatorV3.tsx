"use client";

import {
  Beaker,
  Droplets,
  ListChecks,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { useMemo, useState } from "react";

type DoseUnit = "mL/ha" | "L/ha" | "g/ha" | "kg/ha" | "mL/100L" | "g/100L";
type Product = { id: string; name: string; dose: string; unit: DoseUnit };
type Amount = { value: number; unit: string };
type CalculatedProduct = Product & {
  label: string;
  valid: boolean;
  total: Amount;
  full: Amount;
  last: Amount;
};

function number(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function format(value: number, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(Number.isFinite(value) ? value : 0);
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

function newProduct(index: number): Product {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    dose: "",
    unit: "mL/ha"
  };
}

export function QuickCaldaCalculatorV3() {
  const [area, setArea] = useState("");
  const [tank, setTank] = useState("");
  const [flow, setFlow] = useState("");
  const [products, setProducts] = useState<Product[]>([newProduct(1)]);

  const result = useMemo(() => {
    const areaHa = number(area);
    const tankL = number(tank);
    const flowLHa = number(flow);
    const totalSprayL = areaHa * flowLHa;
    const areaPerTank = tankL > 0 && flowLHa > 0 ? tankL / flowLHa : 0;
    const fullLoads = tankL > 0 ? Math.floor(totalSprayL / tankL) : 0;
    const remainderL = tankL > 0 ? totalSprayL - fullLoads * tankL : 0;
    const hasPartial = remainderL > 0.0001;
    const loads = totalSprayL > 0 && tankL > 0 ? Math.ceil(totalSprayL / tankL) : 0;
    const lastTankL = loads ? (hasPartial ? remainderL : tankL) : 0;
    const lastAreaHa = flowLHa > 0 ? lastTankL / flowLHa : 0;

    const productResults: CalculatedProduct[] = products.map((product, index) => {
      const dose = number(product.dose);
      return {
        ...product,
        label: product.name.trim() || `Produto ${index + 1}`,
        valid: dose > 0,
        total: productAmount(dose, product.unit, areaHa, totalSprayL),
        full: productAmount(dose, product.unit, areaPerTank, tankL),
        last: productAmount(dose, product.unit, lastAreaHa, lastTankL)
      };
    });

    return {
      ready: areaHa > 0 && tankL > 0 && flowLHa > 0,
      areaHa,
      tankL,
      flowLHa,
      totalSprayL,
      areaPerTank,
      fullLoads,
      hasPartial,
      loads,
      lastTankL,
      lastAreaHa,
      productResults,
      activeProducts: productResults.filter((product) => product.valid)
    };
  }, [area, tank, flow, products]);

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
    setTank("");
    setFlow("");
    setProducts([newProduct(1)]);
  }

  return (
    <main className="min-h-screen bg-[#fbfaf3] text-[#142219] [-webkit-text-size-adjust:100%] [text-size-adjust:100%]">
      <section className="bg-[linear-gradient(145deg,#08733f_0%,#005b34_45%,#003e29_100%)] px-5 pb-44 pt-16 sm:px-8 sm:pb-48 sm:pt-20">
        <div className="mx-auto w-full max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.2em] text-[#f7f4e9] ring-1 ring-white/5">
            <span className="grid size-5 place-items-center"><Droplets size={17} strokeWidth={2.2}/></span>
            Calculadora de calda
          </div>
          <h1 className="mt-7 text-[54px] font-black leading-[0.95] tracking-[-0.055em] text-[#fffdf4] sm:text-[68px]">Calda fácil</h1>
          <p className="mt-7 max-w-xl text-[19px] font-medium leading-8 text-white/72 sm:text-[21px]">
            Informe a área, o tanque e a vazão. A gente calcula quantas cargas e quanto de cada produto vai em cada uma.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-28 grid w-full max-w-2xl gap-9 px-4 pb-12 sm:-mt-32 sm:px-6">
        <section className="rounded-[34px] border border-[#e5e4dc] bg-white p-5 shadow-[0_18px_42px_rgba(26,47,32,0.13)] sm:p-7">
          <div className="grid gap-6">
            <NumberInput step="1" label="Área total" value={area} onChange={setArea} suffix="ha" placeholder="49"/>
            <NumberInput step="2" label="Tanque" value={tank} onChange={setTank} suffix="L" placeholder="100"/>
            <NumberInput step="3" label="Vazão" value={flow} onChange={setFlow} suffix="L/ha" placeholder="10"/>
          </div>
        </section>

        <section className="rounded-[34px] border border-[#dedfd6] bg-white p-5 shadow-[0_12px_28px_rgba(26,47,32,0.08)] sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#edf5df] text-[#1f5c36]">
              <Beaker size={27} strokeWidth={2}/>
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="text-[27px] font-black leading-tight tracking-[-0.035em] text-[#17251b]">Produtos e doses</h2>
              <p className="mt-1.5 text-[16px] font-medium leading-6 text-[#6c746d]">Digite o nome e a dose de cada produto.</p>
            </div>
          </div>

          <div className="mt-7 grid gap-4">
            {products.map((product, index) => (
              <div key={product.id} className="rounded-[28px] border border-[#e4e1d5] bg-[#fbfaf4] p-5">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <strong className="text-[13px] font-black uppercase tracking-[0.16em] text-[#667169]">Produto {index + 1}</strong>
                  {products.length > 1 && (
                    <button type="button" onClick={() => removeProduct(product.id)} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-extrabold text-red-600 transition hover:bg-red-50">
                      <Trash2 size={14}/> Remover
                    </button>
                  )}
                </div>

                <div className="grid gap-5">
                  <label className="grid gap-2 text-[15px] font-bold text-[#667169]">
                    Nome
                    <input
                      type="text"
                      className="min-h-16 w-full rounded-[22px] border border-[#ddded7] bg-white px-5 text-[17px] font-semibold text-[#1a271d] shadow-[0_3px_8px_rgba(33,49,36,0.08)] outline-none transition placeholder:font-medium placeholder:text-[#90978f] focus:border-[#3b7f57] focus:ring-2 focus:ring-[#3b7f57]/10"
                      value={product.name}
                      placeholder="Ex.: Picloram"
                      autoComplete="off"
                      onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                    />
                  </label>

                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(132px,0.88fr)] gap-3">
                    <DoseInput value={product.dose} onChange={(dose) => updateProduct(product.id, { dose })}/>
                    <label className="grid gap-2 text-[15px] font-bold text-[#667169]">
                      Unidade
                      <select
                        className="min-h-16 w-full rounded-[22px] border border-[#ddded7] bg-white px-4 text-[16px] font-semibold text-[#263229] shadow-[0_3px_8px_rgba(33,49,36,0.08)] outline-none transition focus:border-[#3b7f57] focus:ring-2 focus:ring-[#3b7f57]/10"
                        value={product.unit}
                        onChange={(event) => updateProduct(product.id, { unit: event.target.value as DoseUnit })}
                      >
                        {(["mL/ha", "L/ha", "g/ha", "kg/ha", "mL/100L", "g/100L"] as DoseUnit[]).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addProduct} className="mt-5 flex min-h-16 w-full items-center justify-center gap-3 rounded-[24px] border border-dashed border-[#d8dbd0] bg-[#fbfaf4] px-4 text-[17px] font-bold text-[#27352c] transition hover:border-[#9eb6a0] hover:bg-[#f5f8ec]">
            <Plus size={24} strokeWidth={1.9}/> Adicionar outro produto
          </button>
        </section>

        {!result.ready ? (
          <section className="grid min-h-[260px] place-items-center rounded-[34px] border border-dashed border-[#d8dbd0] bg-white/35 px-8 py-10 text-center">
            <div>
              <Droplets className="mx-auto text-[#65816b]" size={44} strokeWidth={1.7}/>
              <p className="mx-auto mt-7 max-w-md text-[18px] font-medium leading-7 text-[#6f7871]">Preencha área, tanque e vazão para ver o resultado.</p>
            </div>
          </section>
        ) : (
          <section className="rounded-[34px] border border-[#cddbc6] bg-[#f2f7e8] p-5 shadow-[0_8px_24px_rgba(43,72,47,0.05)] sm:p-7">
            <div className="flex items-center gap-3 text-[#146c3a]">
              <Droplets size={30} strokeWidth={2}/>
              <h2 className="text-[27px] font-black tracking-[-0.03em]">Resultado</h2>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4">
              <Metric label="Calda total" value={`${format(result.totalSprayL, 1)} L`}/>
              <Metric label="Total de cargas" value={String(result.loads)}/>
              <Metric label="Cargas cheias" value={String(result.fullLoads)}/>
              <Metric label="Área/carga" value={`${format(result.areaPerTank, 2)} ha`}/>
            </div>

            {result.fullLoads > 0 && (
              <LoadCard
                title="Carga cheia"
                subtitle={`${format(result.tankL, 1)} L de calda · ${format(result.areaPerTank, 2)} ha`}
                repeat={result.fullLoads}
                products={result.productResults}
                mode="full"
              />
            )}

            {result.hasPartial && (
              <LoadCard
                title="Última carga"
                subtitle={`${format(result.lastTankL, 1)} L de calda · ${format(result.lastAreaHa, 2)} ha`}
                products={result.productResults}
                mode="last"
              />
            )}

            {result.activeProducts.length > 0 && (
              <div className="mt-5 rounded-[28px] bg-[#067138] px-5 py-6 text-white shadow-[0_8px_20px_rgba(0,91,47,0.16)]">
                <span className="block text-[13px] font-black uppercase tracking-[0.18em] text-white/70">Total para {format(result.areaHa, 2)} ha</span>
                <div className="mt-4 grid gap-3">
                  {result.activeProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between gap-4 text-[16px]">
                      <span className="min-w-0 truncate font-medium text-white/85">{product.label}</span>
                      <strong className="shrink-0 text-[18px] font-black">{format(product.total.value, 3)} {product.total.unit}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {result.ready && result.activeProducts.length > 0 && (
          <section className="rounded-[34px] border border-[#dedfd6] bg-white p-5 shadow-[0_10px_26px_rgba(26,47,32,0.08)] sm:p-7">
            <div className="flex items-center gap-3 text-[#14713d]">
              <ListChecks size={30} strokeWidth={2}/>
              <h2 className="text-[27px] font-black tracking-[-0.03em] text-[#18261c]">Receita do preparo</h2>
            </div>

            <ol className="mt-8 grid gap-7">
              <RecipeStep n="1">Separe e confira os produtos e as quantidades da carga.</RecipeStep>
              <RecipeStep n="2">Coloque água suficiente para iniciar a agitação, sem completar o volume.</RecipeStep>
              <RecipeStep n="3">Adicione os produtos na sequência indicada na bula ou receita agronômica.</RecipeStep>
              <RecipeStep n="4">Complete com água até o volume final da carga.</RecipeStep>
              <RecipeStep n="5">Mantenha a agitação e confira a homogeneidade antes do uso.</RecipeStep>
            </ol>
          </section>
        )}

        <div className="rounded-[30px] border border-[#e6ca83] bg-[#fff6dc] px-5 py-6 text-[16px] leading-7 text-[#3e2b1d] sm:px-6">
          <div className="flex items-start gap-4">
            <ShieldAlert className="mt-0.5 shrink-0" size={25} strokeWidth={2}/>
            <div><strong className="font-black">Atenção:</strong> use a dose da receita/bula e confirme a compatibilidade da mistura. A calculadora apenas calcula as quantidades informadas.</div>
          </div>
        </div>

        <button onClick={clear} className="mx-auto mb-3 flex min-h-12 items-center justify-center gap-2 px-4 text-[17px] font-bold text-[#687469] transition hover:text-[#1d5e35]">
          <RotateCcw size={22} strokeWidth={1.9}/> Limpar calculadora
        </button>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-[128px] rounded-[30px] border border-[#dce1d4] bg-white px-5 py-6">
      <span className="block text-[12px] font-black uppercase leading-5 tracking-[0.17em] text-[#69736c]">{label}</span>
      <strong className="mt-5 block text-[34px] font-black leading-none tracking-[-0.035em] text-[#102317]">{value}</strong>
    </div>
  );
}

function LoadCard({ title, subtitle, repeat, products, mode }: { title: string; subtitle: string; repeat?: number; products: CalculatedProduct[]; mode: "full" | "last" }) {
  const validProducts = products.filter((product) => product.valid);

  return (
    <div className="mt-5 rounded-[28px] border border-[#dde1d8] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-[21px] font-black tracking-[-0.025em] text-[#18261c]">{title}</strong>
          <span className="mt-1.5 block text-[16px] font-medium text-[#6f7871]">{subtitle}</span>
        </div>
        {repeat && repeat > 1 ? (
          <span className="shrink-0 rounded-full bg-[#fff0c8] px-3.5 py-2 text-[13px] font-black text-[#68451d]">repetir {repeat}×</span>
        ) : null}
      </div>

      {validProducts.length ? (
        <div className="mt-5 grid gap-3">
          {validProducts.map((product) => {
            const amount = mode === "full" ? product.full : product.last;
            return (
              <div key={product.id} className="flex items-center justify-between gap-3 rounded-[22px] border border-[#e5e3da] bg-[#fbfaf5] px-4 py-4">
                <span className="min-w-0 truncate text-[16px] font-medium text-[#334139]">{product.label}</span>
                <strong className="shrink-0 text-[17px] font-black text-[#18261c]">{format(amount.value, 3)} {amount.unit}</strong>
              </div>
            );
          })}
        </div>
      ) : (
        <span className="mt-4 block text-sm font-medium text-[#737c75]">Informe as doses para ver a quantidade de cada produto.</span>
      )}
    </div>
  );
}

function RecipeStep({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#edf5df] text-[16px] font-black text-[#25583a]">{n}</span>
      <span className="pt-1 text-[17px] font-medium leading-8 text-[#6c746e]">{children}</span>
    </li>
  );
}

function NumberInput({ step, label, value, onChange, suffix, placeholder }: { step: string; label: string; value: string; onChange: (value: string) => void; suffix: string; placeholder?: string }) {
  return (
    <label className="grid gap-3">
      <span className="flex items-center gap-3 text-[18px] font-black text-[#1d2b21]">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#edf5df] text-[15px] font-black text-[#25583a]">{step}</span>
        {label}
      </span>
      <div className="flex min-h-20 items-center overflow-hidden rounded-[28px] border border-[#ddded6] bg-[#fbfaf5] transition focus-within:border-[#87aa90] focus-within:ring-2 focus-within:ring-[#87aa90]/10">
        <input
          inputMode="decimal"
          type="text"
          className="min-w-0 flex-1 bg-transparent px-5 text-[27px] font-black text-[#687268] outline-none placeholder:text-[#6e776f]"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value.replace(/[^0-9,.]/g, ""))}
        />
        <span className="grid shrink-0 place-items-center px-5 text-[18px] font-black text-[#6b756d]">{suffix}</span>
      </div>
    </label>
  );
}

function DoseInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-[15px] font-bold text-[#667169]">
      Dose
      <input
        inputMode="decimal"
        type="text"
        className="min-h-16 min-w-0 rounded-[22px] border border-[#ddded7] bg-white px-5 text-[20px] font-medium text-[#4f5b53] shadow-[0_3px_8px_rgba(33,49,36,0.08)] outline-none transition placeholder:text-[#90978f] focus:border-[#3b7f57] focus:ring-2 focus:ring-[#3b7f57]/10"
        value={value}
        placeholder="200"
        onChange={(event) => onChange(event.target.value.replace(/[^0-9,.]/g, ""))}
      />
    </label>
  );
}
