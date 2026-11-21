'use client';
import { useState } from 'react';
import { MbaCalda } from './MbaCalda';
import { AgroDocHero } from '../AgroDocUi';
import { calculateFlow, calculateYield, calculateFinance } from '@/lib/dronegestor-calculations';
const initial = { area: '', rate: '', tank: '', mixer: '', dose: '', speed: '', width: '', refill: '0', battery: '0', travel: '0', efficiency: '100', price: '', variable: '', fixed: '0', investment: '0', monthly: '0' };
const labels: Record<keyof typeof initial,string> = { area:'Área (ha)',rate:'Taxa de aplicação (L/ha)',tank:'Tanque útil do drone (L)',mixer:'Misturador útil (L)',dose:'Dose prescrita por hectare',speed:'Velocidade (km/h)',width:'Faixa efetiva total (m)',refill:'Abastecimento por carga (min)',battery:'Troca de bateria por carga (min)',travel:'Deslocamento total (min)',efficiency:'Eficiência em voo (%)',price:'Preço de venda (R$/ha)',variable:'Custo variável (R$/ha)',fixed:'Custo fixo do período (R$)',investment:'Investimento (R$)',monthly:'Área mensal estimada (ha)' };
const fields = { misturador:['area','rate','tank','mixer','dose'], vazao:['rate','speed','width'], rendimento:['area','rate','tank','speed','width','refill','battery','travel','efficiency'], custos:['area','price','variable','fixed','investment','monthly'] } as const;
const fmt=(v:number|null)=>v===null?'Não calculável':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4}).format(v);
export function CalculationCenter(){
 const [tool,setTool]=useState<keyof typeof fields>('misturador');
 const [values,setValues]=useState(initial);
 const [result,setResult]=useState<Array<[string,string]>>([]);
 const [error,setError]=useState('');
 function calculate(){
  setResult([]);setError('');
  const n=(k:keyof typeof initial)=>{if(!values[k].trim())throw new Error(`Preencha: ${labels[k]}`);return Number(values[k].replace(',','.'));};
  try{
   if(tool==='misturador') return;
   if(tool==='vazao') setResult([['Vazão total',`${fmt(calculateFlow(n('rate'),n('speed'),n('width')))} L/min`]]);
   else if(tool==='rendimento'){
    const r=calculateYield({areaHa:n('area'),rateLHa:n('rate'),tankL:n('tank'),speedKmh:n('speed'),widthM:n('width'),refillMin:n('refill'),batteryMin:n('battery'),travelMin:n('travel'),efficiencyPercent:n('efficiency')});
    setResult([['Rendimento teórico',`${fmt(r.theoreticalHaH)} ha/h`],['Rendimento estimado com paradas',`${fmt(r.estimatedHaH)} ha/h`],['Tempo total estimado',`${fmt(r.totalHours)} h`],['Tempo em solo',`${fmt(r.groundHours)} h`],['Cargas previstas',String(r.loads)]]);
   }else{
    const r=calculateFinance({areaHa:n('area'),priceHa:n('price'),variableHa:n('variable'),fixed:n('fixed'),investment:n('investment'),monthlyHa:n('monthly')});
    setResult([['Receita',`R$ ${fmt(r.revenue)}`],['Custo total',`R$ ${fmt(r.cost)}`],['Resultado operacional',`R$ ${fmt(r.profit)}`],['Custo por hectare',`R$ ${fmt(r.costHa)}`],['Margem',`${fmt(r.marginPercent)}${r.marginPercent===null?'':' %'}`],['Ponto de equilíbrio',`${fmt(r.breakEvenHa)}${r.breakEvenHa===null?'':' ha'}`],['ROI do período',`${fmt(r.roiPercent)}${r.roiPercent===null?'':' %'}`],['Recuperação estimada',`${fmt(r.paybackMonths)}${r.paybackMonths===null?'':' meses'}`]]);
   }
  }catch(e){setError(e instanceof Error?e.message:'Verifique os valores.');}
 }
 const formulas={misturador:'Calda = área × taxa. Área por mistura = volume útil ÷ taxa. Produto = dose por hectare × área atendida. O volume é de calda final; não some o produto por cima da capacidade útil.',vazao:'Q (L/min) = taxa (L/ha) × velocidade (km/h) × faixa efetiva (m) ÷ 600.',rendimento:'Teórico (ha/h) = velocidade × faixa ÷ 10. Tempo em voo = área ÷ teórico ÷ eficiência. Tempo total soma voo, abastecimentos, trocas e deslocamento. Cargas não equivalem necessariamente ao número de voos. Rendimento real exige medições de campo.',custos:'Receita = área × preço. Custo = área × custo variável + custo fixo. Margem = lucro ÷ receita. Equilíbrio = custo fixo ÷ contribuição por ha. ROI = lucro ÷ investimento. Recuperação = investimento ÷ lucro mensal. Use o mesmo período para custos fixos e área mensal na projeção.'};
 return <main className="mx-auto grid max-w-5xl gap-5 p-4 sm:p-6"><AgroDocHero title={tool==="misturador"?"MBA Calda":tool==="vazao"?"Vazão":tool==="rendimento"?"Rendimento":"Custos"} description={tool==="misturador"?"Do misturador ao tanque do drone. Produtos, hectares e abastecimentos.":"Ferramentas de cálculo do MBA DroneGestor."}/><nav className="flex flex-wrap gap-2" aria-label="Calculadoras">{Object.keys(fields).map(k=><button key={k} aria-pressed={tool===k} className={`rounded-xl border p-3 capitalize ${tool===k?'bg-emerald-800 text-white':'bg-white'}`} onClick={()=>{setTool(k as keyof typeof fields);setResult([]);setError('');}}>{k==='misturador'?'MBA Calda':k==='vazao'?'Vazão':k}</button>)}</nav><div hidden={tool!=="misturador"}><MbaCalda/></div>{tool!=="misturador"&&<><form className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();calculate();}}>{fields[tool].map(k=><label className="grid gap-1 text-sm font-semibold" key={k}>{labels[k]}<input required type="text" inputMode="decimal" className="rounded-xl border p-3" value={values[k]} onChange={e=>{setValues({...values,[k]:e.target.value});setResult([]);}}/></label>)}<button type="submit" className="rounded-xl bg-emerald-800 p-3 font-bold text-white sm:col-span-2">Calcular</button></form>{error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}<section aria-live="polite" className="grid gap-3 sm:grid-cols-2">{result.map(([label,value])=><article key={label} className="rounded-2xl border border-emerald-200 bg-white p-5"><h2 className="text-sm font-bold text-emerald-800">{label}</h2><p className="mt-2 text-xl font-semibold">{value}</p></article>)}</section><aside className="rounded-2xl border bg-white p-5 text-sm leading-6"><h2 className="font-bold">Fórmulas e premissas</h2><p>{formulas[tool]}</p><p className="mt-2">Nenhuma dose ou mistura é recomendada pela calculadora. Estes cálculos funcionam sem chamadas ao servidor após carregar a página; instalação e reabertura offline ainda dependem da homologação PWA.</p></aside></>}</main>;
}
