"use client";
import type {ReactNode} from "react";
import {estimateFieldDeltaT} from "@/lib/agrovoo-field-reference";
const tones={basic:"bg-blue-700",gps:"bg-emerald-700",weather:"bg-cyan-700",technical:"bg-amber-700",team:"bg-slate-600",notes:"bg-slate-800",evidence:"bg-[#123e38]"} as const;
export function FieldReferenceSection({title,tone,children}:{title:string;tone:keyof typeof tones;children:ReactNode}){
 return <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><h2 className={tones[tone]+" px-3 py-2 text-sm font-semibold text-white"}>{title}</h2><div className="grid min-w-0 gap-3 p-3">{children}</div></section>;
}
export function ReferenceValues({items}:{items:{label:string;value:string}[]}){
 return <dl className="agro-compact-grid grid grid-cols-2 gap-2">{items.map(({label,value})=><div key={label} className="min-w-0 rounded-md border border-slate-100 bg-slate-50 p-2.5"><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value||"Não informado"}</dd></div>)}</dl>;
}
export function DeltaTDisplay({temperature,humidity}:{temperature:number|null;humidity:number|null}){
 const result=estimateFieldDeltaT(temperature,humidity);
 const fmt=(v:number)=>v.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+" °C";
 return <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-center text-xs font-semibold text-slate-600">DELTA T (ΔT) · estimativa auxiliar</p>{result?<><strong className="text-center text-2xl tabular-nums text-slate-900">{fmt(result.deltaC)}</strong><ReferenceValues items={[{label:"Temperatura do ar",value:fmt(temperature!)},{label:"Bulbo úmido estimado",value:fmt(result.wetBulbC)}]}/></>:<p className="text-sm text-slate-600">Preencha temperatura e umidade medidas dentro da faixa do cálculo (0–50 °C e 5–99% UR).</p>}<p className="text-xs text-slate-600">Estimativa de Stull (2011), para pressão ao nível do mar. Não é medição direta nem libera aplicação. Confira bula, receituário, condições locais e RT.</p></div>;
}
