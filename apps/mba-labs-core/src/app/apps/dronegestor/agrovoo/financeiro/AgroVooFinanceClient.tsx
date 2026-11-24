"use client";
import { useEffect,useState,type FormEvent } from "react";
import Link from "next/link";
import { ArrowDownLeft,ArrowUpRight,Plus,RefreshCw,Wallet,Clock,ArrowLeft,ArrowRight } from "lucide-react";
import { financeToday,parseAmountCents,validateFinanceInput,summarizeFinance,nextFinanceState,type FinanceEntry } from "@/lib/agrovoo-finance";
import { paginateAgroVooOrders } from "@/lib/agrovoo-board-view";
const API="/api/dronegestor/financeiro";
const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v/100);
const control="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const primary="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#185a47] px-4 text-sm font-semibold text-white disabled:opacity-40";
const secondary="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-40";
const seed=():FinanceEntry[]=>{const today=financeToday();return [
  {id:"demo-1",kind:"receita",description:"Exemplo: aplicação agrícola",category:"Serviços",amount_cents:450000,due_date:today,status:"pendente",settled_date:null},
  {id:"demo-2",kind:"despesa",description:"Exemplo: combustível",category:"Operação",amount_cents:65000,due_date:today,status:"pendente",settled_date:null},
  {id:"demo-3",kind:"receita",description:"Exemplo: serviço recebido",category:"Serviços",amount_cents:280000,due_date:today,status:"liquidado",settled_date:today},
  {id:"demo-4",kind:"despesa",description:"Exemplo: manutenção paga",category:"Manutenção",amount_cents:90000,due_date:today,status:"liquidado",settled_date:today}
];};
export function AgroVooFinanceClient(){
  const [items,setItems]=useState<FinanceEntry[]>([]),[demo,setDemo]=useState(false),[ready,setReady]=useState(false),[disabled,setDisabled]=useState(false);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState("");
  const [kind,setKind]=useState<"todas"|"receita"|"despesa">("todas"),[status,setStatus]=useState("todos"),[query,setQuery]=useState("");
  const [month,setMonth]=useState(()=>financeToday().slice(0,7)),[page,setPage]=useState(0),[size,setSize]=useState(10);
  const [form,setForm]=useState<null|{kind:"receita"|"despesa";description:string;category:string;amount:string;due_date:string}>(null);
  const [settle,setSettle]=useState<FinanceEntry|null>(null),[settleDate,setSettleDate]=useState(financeToday);
  const today=financeToday();
  const enabled=demo||ready;
  const total=summarizeFinance(items,today,month);
  const filtered=items.filter(x=>(kind==="todas"||x.kind===kind)&&(status==="todos"||(status==="vencido"?x.status==="pendente"&&x.due_date<today:x.status===status))&&[x.description,x.category].join(" ").toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const {currentPage,totalPages,visibleOrders}=paginateAgroVooOrders(filtered,page,size);
  async function load(){
    setLoading(true);setReady(false);setDisabled(false);setError("");setItems([]);
    try{
      const r=await fetch(API,{cache:"no-store"}),p=await r.json();
      if(!r.ok||p?.ok!==true){setDisabled(p?.disabled===true);throw new Error(p?.error||"Financeiro indisponível.");}
      setItems(p.items??[]);setReady(true);
    }catch(e){setError(e instanceof Error?e.message:"Falha na consulta.");}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  function startDemo(){if(!disabled||loading)return;setDemo(true);setItems(seed());setError("");setPage(0);setForm(null);setSettle(null);}
  function leaveDemo(){setDemo(false);setItems([]);setForm(null);setSettle(null);setPage(0);void load();}
  async function mutate(method:"POST"|"PATCH",body:object){
    const r=await fetch(API,{method,cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),p=await r.json();
    if(!r.ok||p?.ok!==true)throw new Error(p?.error||"Falha ao gravar.");
    return p.item as FinanceEntry;
  }
  function openForm(k:"receita"|"despesa"){if(!enabled||saving)return;setForm({kind:k,description:"",category:"",amount:"",due_date:today});setSettle(null);setError("");}
  async function submit(e:FormEvent){e.preventDefault();if(!form||!enabled||saving)return;setSaving(true);setError("");
    try{
      const input=validateFinanceInput({...form,amount_cents:parseAmountCents(form.amount)});
      const item:FinanceEntry=demo?{...input,id:crypto.randomUUID(),status:"pendente",settled_date:null}:await mutate("POST",input);
      setItems(old=>[item,...old]);setPage(0);setForm(null);
    }catch(e){setError(e instanceof Error?e.message:"Falha ao salvar.");}finally{setSaving(false);}
  }
  async function change(item:FinanceEntry,action:"liquidar"|"cancelar",date:string){
    if(!enabled||saving)return;setSaving(true);setError("");
    try{
      const next=nextFinanceState(item,action,date,today);
      const updated=demo?{...item,...next}:await mutate("PATCH",{id:item.id,action,date});
      setItems(old=>old.map(x=>x.id===updated.id?updated:x));setSettle(null);
    }catch(e){setError(e instanceof Error?e.message:"Falha ao atualizar.");}finally{setSaving(false);}
  }
  const metrics=[
    {title:"Contas a receber",value:enabled?money(total.receivable):"—",icon:ArrowDownLeft,color:"text-emerald-800",note:"Receitas pendentes"},
    {title:"Contas a pagar",value:enabled?money(total.payable):"—",icon:ArrowUpRight,color:"text-red-700",note:"Despesas pendentes"},
    {title:"Vencidas",value:enabled?String(total.overdue):"—",icon:Clock,color:"text-amber-700",note:"Lançamentos pendentes"},
    {title:"Vencem hoje",value:enabled?String(total.dueToday):"—",icon:Clock,color:"text-slate-700",note:today},
    {title:"Recebido no mês",value:enabled?money(total.received):"—",icon:ArrowDownLeft,color:"text-emerald-800",note:"Regime de caixa"},
    {title:"Pago no mês",value:enabled?money(total.paid):"—",icon:ArrowUpRight,color:"text-red-700",note:"Regime de caixa"},
    {title:"Resultado de caixa do mês",value:enabled?money(total.net):"—",icon:Wallet,color:total.net<0?"text-red-700":"text-emerald-800",note:"Recebido menos pago; não é saldo bancário nem lucro contábil"}
  ];
  return <main className="grid gap-4 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3"><div><Link href="/apps/dronegestor/agrovoo" className="mb-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-emerald-800"><ArrowLeft size={15}/> Dashboard</Link><h1 className="text-2xl font-bold text-slate-900">Gestão financeira</h1><p className="mt-1 text-sm text-slate-600">Controle de receitas, despesas, vencimentos e liquidações.</p></div><button type="button" disabled={loading||saving} onClick={()=>demo?leaveDemo():void load()} className={secondary}><RefreshCw size={16}/>{demo?"Sair da simulação":"Atualizar"}</button></header>
    {error&&<p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
    {!demo&&disabled&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"><div><strong>Simulação de homologação</strong><p className="mt-1 text-sm text-slate-600">Teste com dados fictícios, sem gravar no servidor. Os dados são descartados ao sair ou recarregar.</p></div><button type="button" className={primary} onClick={startDemo}>Abrir simulação</button></div>}
    {demo&&<p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">SIMULAÇÃO — somente dados fictícios em memória. Nenhum lançamento real é gravado.</p>}
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 bg-[#123e38] px-4 py-3 text-white"><h2 className="font-bold">Resumo financeiro</h2><label className="flex items-center gap-2 text-sm">Mês de caixa<input type="month" className={control+" !w-auto text-slate-900"} value={month} onChange={e=>setMonth(e.target.value||today.slice(0,7))}/></label></div>
      <div className="agro-compact-grid grid grid-cols-2 gap-2 p-3 lg:grid-cols-4">
        <button type="button" onClick={()=>{setKind("receita");setStatus("pendente");setPage(0);}} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#16734e] px-3 text-sm font-bold text-white"><ArrowDownLeft size={19}/> A receber</button>
        <button type="button" onClick={()=>{setKind("despesa");setStatus("pendente");setPage(0);}} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#9b3434] px-3 text-sm font-bold text-white"><ArrowUpRight size={19}/> A pagar</button>
        <button type="button" disabled={!enabled||saving} onClick={()=>openForm("receita")} className={primary}><Plus size={18}/> Nova receita</button>
        <button type="button" disabled={!enabled||saving} onClick={()=>openForm("despesa")} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#9b3434] px-3 text-sm font-semibold text-white disabled:opacity-40"><Plus size={18}/> Nova despesa</button>
      </div>
      <div className="agro-compact-grid grid grid-cols-2 gap-3 p-3 pt-0 lg:grid-cols-4">{metrics.map(({title,value,icon:Icon,color,note})=><article key={title} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Icon size={18} className={color+" shrink-0"}/>{title}</div><strong className={"mt-2 block break-words text-xl font-bold tabular-nums "+color}>{value}</strong><p className="mt-1 text-xs text-slate-500">{note}</p></article>)}</div>
    </section>
    {form&&<form onSubmit={submit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4"><h2 className="font-bold">{form.kind==="receita"?"Nova receita":"Nova despesa"}</h2><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Descrição *<input required maxLength={180} className={control} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="grid gap-1 text-sm font-semibold">Categoria *<input required maxLength={80} className={control} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label className="grid gap-1 text-sm font-semibold">Valor (R$) *<input required inputMode="decimal" placeholder="0,00" className={control} value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label className="grid gap-1 text-sm font-semibold">Vencimento *<input required type="date" className={control} value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/></label></div><div className="flex justify-end gap-2"><button type="button" disabled={saving} className={secondary} onClick={()=>setForm(null)}>Cancelar</button><button disabled={saving} className={primary}>{saving?"Salvando...":"Salvar lançamento"}</button></div></form>}
    {settle&&<form onSubmit={e=>{e.preventDefault();void change(settle,"liquidar",settleDate);}} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4"><h2 className="font-bold">{settle.kind==="receita"?"Confirmar recebimento":"Confirmar pagamento"}</h2><p className="text-sm">{settle.description} · {money(settle.amount_cents)}</p><label className="grid gap-1 text-sm font-semibold">Data da liquidação<input type="date" required max={today} value={settleDate} onChange={e=>setSettleDate(e.target.value)} className={control}/></label><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={()=>setSettle(null)} className={secondary}>Voltar</button><button disabled={saving} className={primary}>Confirmar</button></div></form>}
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between bg-[#123e38] px-4 py-3 text-white"><h2 className="font-bold">Lançamentos</h2><span className="text-xs">Todos os vencimentos</span></div>
      <div className="grid gap-2 p-3 md:grid-cols-3"><input className={control} aria-label="Pesquisar lançamento" placeholder="Descrição ou categoria" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select className={control} aria-label="Tipo" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setPage(0);}}><option value="todas">Todos os tipos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select><select className={control} aria-label="Situação" value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="todos">Todas as situações</option><option value="pendente">Pendente</option><option value="vencido">Vencido</option><option value="liquidado">Liquidado</option><option value="cancelado">Cancelado</option></select></div>
      {!enabled?<p className="p-4 text-sm text-slate-600">{loading?"Consultando autorização e disponibilidade...":"Nenhum dado financeiro real disponível."}</p>:visibleOrders.length===0?<p className="p-4 text-sm text-slate-600">Nenhum lançamento encontrado.</p>:<><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr>{["Descrição","Tipo","Vencimento","Valor","Situação","Ações"].map(t=><th scope="col" key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{visibleOrders.map(x=><tr key={x.id} className="border-b border-slate-100 even:bg-slate-50"><td className="p-3"><strong>{x.description}</strong><p className="text-xs text-slate-500">{x.category}</p></td><td className="p-3 capitalize">{x.kind}</td><td className="p-3">{x.due_date}</td><td className="p-3 font-semibold">{money(x.amount_cents)}</td><td className="p-3 capitalize">{x.status==="pendente"&&x.due_date<today?"Vencido":x.status}{x.settled_date&&<p className="text-xs">{x.settled_date}</p>}</td><td className="p-3">{actions(x)}</td></tr>)}</tbody></table></div><div className="grid gap-2 p-3 md:hidden">{visibleOrders.map(x=><article key={x.id} className="grid gap-2 rounded-md border p-3 text-sm"><strong>{x.description}</strong><span>{x.category} · {x.kind} · {money(x.amount_cents)}</span><span>Vencimento: {x.due_date} · {x.status}</span>{actions(x)}</article>)}</div></>}
      {enabled&&<footer className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs"><span>{filtered.length} lançamentos</span><div className="flex items-center gap-2"><select aria-label="Registros por página" className={control+" !w-auto"} value={size} onChange={e=>{setSize(Number(e.target.value));setPage(0);}}>{[10,25,50].map(n=><option key={n}>{n}</option>)}</select><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)} className={secondary} aria-label="Página anterior"><ArrowLeft size={15}/></button>{currentPage+1}/{totalPages}<button type="button" disabled={currentPage>=totalPages-1} onClick={()=>setPage(currentPage+1)} className={secondary} aria-label="Próxima página"><ArrowRight size={15}/></button></div></footer>}
    </section>
    <p className="text-xs text-slate-500">Controle gerencial inicial. Não movimenta dinheiro, não emite nota fiscal e não substitui contabilidade.</p>
  </main>;
  function actions(x:FinanceEntry){return x.status==="pendente"?<div className="flex flex-wrap gap-1"><button type="button" disabled={saving} className={secondary} onClick={()=>{setForm(null);setSettle(x);setSettleDate(today);}}>{x.kind==="receita"?"Receber":"Pagar"}</button><button type="button" disabled={saving} className={secondary+" !text-red-700"} onClick={()=>{if(window.confirm("Cancelar este lançamento pendente?"))void change(x,"cancelar",today);}}>Cancelar</button></div>:<span className="text-xs text-slate-500">Somente consulta</span>;}
}
