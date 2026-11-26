"use client";
import { useEffect,useRef,useState,type FormEvent } from "react";
import Link from "next/link";
import { ArrowDownLeft,ArrowUpRight,Plus,RefreshCw,Wallet,Clock,ArrowLeft,ArrowRight } from "lucide-react";
import { financeToday,formatFinanceDate,parseAmountCents,validateFinanceInput,summarizeFinance,nextFinanceState,type FinanceEntry } from "@/lib/agrovoo-finance";
import { AgroVooFinanceReports } from "./AgroVooFinanceReports";
import { paginateAgroVooOrders } from "@/lib/agrovoo-board-view";
const API="/api/dronegestor/financeiro";
const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v/100);
const control="w-full min-w-0 min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";
const primary="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#185a47] px-4 text-sm font-semibold text-white disabled:opacity-40";
const secondary="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 disabled:opacity-40";
const demoOrders=[{id:"00000000-0000-4000-8000-000000000001",label:"OS fictícia 001"}];
const seed=():FinanceEntry[]=>{const today=financeToday();return [
  {id:"demo-1",kind:"receita",description:"Exemplo: aplicação agrícola",category:"Serviços",os_id:demoOrders[0].id,os_label:demoOrders[0].label,cost_center:"Pulverização",counterparty:"Cliente fictício",competence_date:today,amount_cents:450000,due_date:today,status:"pendente",settled_date:null},
  {id:"demo-2",kind:"despesa",description:"Exemplo: combustível",category:"Operação",os_id:demoOrders[0].id,os_label:demoOrders[0].label,cost_center:"Pulverização",counterparty:"Fornecedor fictício",competence_date:today,amount_cents:65000,due_date:today,status:"pendente",settled_date:null},
  {id:"demo-3",kind:"receita",description:"Exemplo: serviço recebido",category:"Serviços",amount_cents:280000,due_date:today,status:"liquidado",settled_date:today},
  {id:"demo-4",kind:"despesa",description:"Exemplo: manutenção paga",category:"Manutenção",amount_cents:90000,due_date:today,status:"liquidado",settled_date:today}
];};
export function AgroVooFinanceClient(){
  const [items,setItems]=useState<FinanceEntry[]>([]),[demo,setDemo]=useState(false),[ready,setReady]=useState(false),[disabled,setDisabled]=useState(false);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [kind,setKind]=useState<"todas"|"receita"|"despesa">("todas"),[status,setStatus]=useState("todos"),[query,setQuery]=useState("");
  const [month,setMonth]=useState(()=>financeToday().slice(0,7)),[page,setPage]=useState(0),[size,setSize]=useState(10);
  const [orders,setOrders]=useState<{id:string;label:string}[]>([]);
  const [tab,setTab]=useState<"resumo"|"lancamentos"|"relatorios">("resumo");
  const [form,setForm]=useState<null|{id?:string;kind:"receita"|"despesa";description:string;category:string;amount:string;due_date:string;competence_date:string;os_id:string;cost_center:string;counterparty:string}>(null);
  const [settle,setSettle]=useState<FinanceEntry|null>(null),[settleDate,setSettleDate]=useState(financeToday),[settleAction,setSettleAction]=useState<"liquidar"|"cancelar">("liquidar");
  const dialogRef=useRef<HTMLDialogElement>(null);
  const dialogOpen=Boolean(form||settle);
  useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;if(dialogOpen&&!dialog.open)dialog.showModal();else if(!dialogOpen&&dialog.open)dialog.close();},[dialogOpen]);
  function closeAction(){if(saving)return;setForm(null);setSettle(null);setError("");}
  function showAccounts(k:"receita"|"despesa"){if(saving)return;setForm(null);setSettle(null);setQuery("");setKind(k);setStatus("pendente");setPage(0);setTab("lancamentos");setError("");}
  const today=financeToday();
  const enabled=demo||ready;
  const total=summarizeFinance(items,today,month);
  const filtered=items.filter(x=>(kind==="todas"||x.kind===kind)&&(status==="todos"||(status==="vencido"?x.status==="pendente"&&x.due_date<today:x.status===status))&&[x.description,x.category,x.cost_center,x.counterparty,x.os_label].join(" ").toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));
  const {currentPage,totalPages,visibleOrders}=paginateAgroVooOrders(filtered,page,size);
  async function load(){
    setLoading(true);setReady(false);setDisabled(false);setError("");setItems([]);
    try{
      const r=await fetch(API,{cache:"no-store"}),p=await r.json();
      if(!r.ok||p?.ok!==true){setDisabled(p?.disabled===true);throw new Error(p?.error||"Financeiro indisponível.");}
      setItems(p.items??[]);setReady(true);
      try{const response=await fetch("/api/dronegestor/cadastros?type=os",{cache:"no-store"});const payload=await response.json();if(response.ok)setOrders((payload.items??[]).map((o:{entityId:string;data:{numero?:string}})=>({id:o.entityId,label:o.data.numero||o.entityId})));else setOrders([]);}catch{setOrders([]);}
    }catch(e){setError(e instanceof Error?e.message:"Falha na consulta.");}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[]);
  function startDemo(){if(!disabled||loading)return;setDemo(true);setTab("resumo");setKind("todas");setStatus("todos");setQuery("");setOrders(demoOrders);setItems(seed());setError("");setPage(0);setForm(null);setSettle(null);}
  function leaveDemo(){setDemo(false);setMessage("");setTab("resumo");setOrders([]);setItems([]);setForm(null);setSettle(null);setPage(0);void load();}
  async function mutate(method:"POST"|"PATCH",body:object){
    const r=await fetch(API,{method,cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),p=await r.json();
    if(!r.ok||p?.ok!==true)throw new Error(p?.error||"Falha ao gravar.");
    return p.item as FinanceEntry;
  }
  function openForm(k:"receita"|"despesa"){if(!enabled||saving)return;setMessage("");setForm({kind:k,description:"",category:"",amount:"",due_date:today,competence_date:today,os_id:"",cost_center:"",counterparty:""});setSettle(null);setError("");}
  async function submit(e:FormEvent){e.preventDefault();if(!form||!enabled||saving)return;setSaving(true);setError("");
    try{
      const input=validateFinanceInput({...form,amount_cents:parseAmountCents(form.amount)});
      const demoLabel=orders.find(o=>o.id===input.os_id)?.label||"";
      const item:FinanceEntry=form.id?(demo?{...items.find(x=>x.id===form.id)!,...input,os_label:demoLabel}:await mutate("PATCH",{id:form.id,action:"editar",data:input})):(demo?{...input,id:crypto.randomUUID(),status:"pendente",settled_date:null,os_label:demoLabel}:await mutate("POST",input));
      setItems(old=>form.id?old.map(x=>x.id===item.id?item:x):[item,...old]);setKind(item.kind);setStatus("pendente");setQuery("");setPage(0);setForm(null);setTab("lancamentos");setMessage(form.id?"Lançamento atualizado.":"Lançamento cadastrado.");
    }catch(e){setError(e instanceof Error?e.message:"Falha ao salvar.");}finally{setSaving(false);}
  }
  async function change(item:FinanceEntry,action:"liquidar"|"cancelar",date:string){
    if(!enabled||saving)return;setSaving(true);setError("");
    try{
      const next=nextFinanceState(item,action,date,today);
      const updated=demo?{...item,...next}:await mutate("PATCH",{id:item.id,action,date});
      setItems(old=>old.map(x=>x.id===updated.id?updated:x));setSettle(null);setMessage(action==="cancelar"?"Lançamento cancelado.":item.kind==="receita"?"Recebimento registrado.":"Pagamento registrado.");
    }catch(e){setError(e instanceof Error?e.message:"Falha ao atualizar.");}finally{setSaving(false);}
  }
  const metrics=[
    {title:"Contas a receber",value:enabled?money(total.receivable):"—",icon:ArrowDownLeft,color:"text-emerald-800",note:"Receitas pendentes"},
    {title:"Contas a pagar",value:enabled?money(total.payable):"—",icon:ArrowUpRight,color:"text-red-700",note:"Despesas pendentes"},
    {title:"Vencidas",value:enabled?String(total.overdue):"—",icon:Clock,color:"text-amber-700",note:"Lançamentos pendentes"},
    {title:"Vencem hoje",value:enabled?String(total.dueToday):"—",icon:Clock,color:"text-slate-700",note:formatFinanceDate(today)},
    {title:"Recebido no mês",value:enabled?money(total.received):"—",icon:ArrowDownLeft,color:"text-emerald-800",note:"Regime de caixa"},
    {title:"Pago no mês",value:enabled?money(total.paid):"—",icon:ArrowUpRight,color:"text-red-700",note:"Regime de caixa"},
    {title:"Resultado de caixa do mês",value:enabled?money(total.net):"—",icon:Wallet,color:total.net<0?"text-red-700":"text-emerald-800",note:"Recebido menos pago. Não é saldo bancário nem lucro contábil."}
  ];
  return <main className="grid min-w-0 gap-3 pb-8 sm:gap-4">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3"><div><Link href="/apps/agrovoo/painel" className="mb-1 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-emerald-800"><ArrowLeft size={15}/> Dashboard</Link><h1 className="text-2xl font-bold text-slate-900">Gestão financeira</h1><p className="mt-1 text-sm text-slate-600">Controle de receitas, despesas, vencimentos e liquidações.</p></div><button type="button" disabled={loading||saving} onClick={()=>demo?leaveDemo():void load()} className={secondary}><RefreshCw size={16}/>{demo?"Sair da simulação":"Atualizar"}</button></header>
    {message&&<p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{message}</p>}
    {error&&!dialogOpen&&<p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
    {!demo&&disabled&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"><div><strong>Simulação de homologação</strong><p className="mt-1 text-sm text-slate-600">Teste com dados fictícios, sem gravar no servidor. Os dados são descartados ao sair ou recarregar.</p></div><button type="button" className={primary} onClick={startDemo}>Abrir simulação</button></div>}
    {demo&&<p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">SIMULAÇÃO — somente dados fictícios em memória. Nenhum lançamento real é gravado.</p>}
    <nav aria-label="Seções financeiras" className="flex flex-wrap gap-2"><button type="button" disabled={saving} onClick={()=>setTab("resumo")} className={tab==="resumo"?primary:secondary}>Resumo</button><button type="button" disabled={saving} onClick={()=>{setKind("todas");setStatus("todos");setQuery("");setPage(0);setTab("lancamentos");}} className={tab==="lancamentos"?primary:secondary}>Lançamentos</button><button type="button" disabled={saving||!enabled} onClick={()=>setTab("relatorios")} className={tab==="relatorios"?primary:secondary}>Fluxo de caixa e relatórios</button></nav>
    {tab==="resumo"&&<section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2 bg-[#123e38] px-4 py-3 text-white"><h2 className="font-bold">Resumo financeiro</h2><label className="flex items-center gap-2 text-sm">Mês de caixa<input type="month" className={control+" !w-auto text-slate-900"} value={month} onChange={e=>setMonth(e.target.value||today.slice(0,7))}/></label></div>
      <div className="agro-compact-grid grid grid-cols-2 gap-2 p-3 lg:grid-cols-4">
        <button type="button" disabled={!enabled||saving} onClick={()=>showAccounts("receita")} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#16734e] px-3 text-sm font-bold text-white"><ArrowDownLeft size={19}/> A receber</button>
        <button type="button" disabled={!enabled||saving} onClick={()=>showAccounts("despesa")} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#9b3434] px-3 text-sm font-bold text-white"><ArrowUpRight size={19}/> A pagar</button>
        <button type="button" disabled={!enabled||saving} onClick={()=>openForm("receita")} className={primary}><Plus size={18}/> Nova receita</button>
        <button type="button" disabled={!enabled||saving} onClick={()=>openForm("despesa")} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#9b3434] px-3 text-sm font-semibold text-white disabled:opacity-40"><Plus size={18}/> Nova despesa</button>
      </div>
      <div className="agro-compact-grid grid grid-cols-2 gap-2 p-3 pt-0 lg:grid-cols-4">{metrics.map(({title,value,icon:Icon,color,note},index)=><article key={title} className={"min-w-0 rounded-lg border border-slate-200 p-2.5 sm:p-3 "+(index===metrics.length-1?"col-span-2 bg-slate-50 lg:col-span-2":"")}><div className="flex items-start gap-1.5 text-xs font-semibold text-slate-600"><Icon size={16} className={color+" mt-0.5 shrink-0"}/><span>{title}</span></div><strong className={"mt-1.5 block break-words text-lg font-bold tabular-nums sm:text-xl "+color}>{value}</strong><p className="mt-0.5 text-[11px] leading-4 text-slate-500 sm:text-xs">{note}</p></article>)}</div>
    </section>}
    {tab==="relatorios"&&enabled&&<AgroVooFinanceReports entries={items} today={today} demo={demo}/>}
    <dialog ref={dialogRef} aria-label={form?(form.id?"Editar lançamento":form.kind==="receita"?"Nova receita":"Nova despesa"):settleAction==="cancelar"?"Cancelar lançamento":"Confirmar liquidação"} onCancel={e=>{e.preventDefault();closeAction();}} className="agrovoo-confirm-dialog" style={{width:"min(680px, calc(100vw - 24px))",maxHeight:"calc(100dvh - 24px)"}}>
    {dialogOpen&&demo&&<p className="mb-2 text-xs font-semibold text-amber-800">SIMULAÇÃO — dados fictícios</p>}{dialogOpen&&error&&<p role="alert" className="mb-2 rounded-md bg-amber-50 p-2 text-sm text-amber-950">{error}</p>}
    {form&&<form onSubmit={submit} className="grid min-w-0 gap-3"><h2 className="font-bold">{form.id?"Editar lançamento":form.kind==="receita"?"Nova receita":"Nova despesa"}</h2><div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Descrição *<input required maxLength={180} className={control} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="grid gap-1 text-sm font-semibold">Categoria *<input required maxLength={80} className={control} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></label><label className="grid gap-1 text-sm font-semibold">Valor (R$) *<input required inputMode="decimal" placeholder="0,00" className={control} value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label className="grid gap-1 text-sm font-semibold">Vencimento *<input required type="date" className={control} value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/></label>
      <label className="grid gap-1 text-sm font-semibold">Competência *<input required type="date" className={control} value={form.competence_date} onChange={e=>setForm({...form,competence_date:e.target.value})}/></label>
      <label className="grid gap-1 text-sm font-semibold">Ordem de serviço (opcional)<select className={control} value={form.os_id} onChange={e=>setForm({...form,os_id:e.target.value})}><option value="">Sem OS vinculada</option>{form.os_id&&!orders.some(o=>o.id===form.os_id)&&<option value={form.os_id}>Vínculo anterior</option>}{orders.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
      <label className="grid gap-1 text-sm font-semibold">Centro de custo<input maxLength={120} className={control} placeholder="Ex.: operação, manutenção, administrativo" value={form.cost_center} onChange={e=>setForm({...form,cost_center:e.target.value})}/></label>
      <label className="grid gap-1 text-sm font-semibold">Cliente / fornecedor<input maxLength={120} className={control} value={form.counterparty} onChange={e=>setForm({...form,counterparty:e.target.value})}/></label>
      </div><div className="flex justify-end gap-2"><button type="button" disabled={saving} className={secondary} onClick={closeAction}>Cancelar</button><button disabled={saving} className={primary}>{saving?"Salvando...":"Salvar lançamento"}</button></div></form>}
    {settle&&<form onSubmit={e=>{e.preventDefault();void change(settle,settleAction,settleDate);}} className="grid min-w-0 gap-3"><h2 className="font-bold">{settleAction==="cancelar"?"Cancelar lançamento":settle.kind==="receita"?"Confirmar recebimento":"Confirmar pagamento"}</h2><p className="text-sm">{settle.description} · {money(settle.amount_cents)}</p>{settleAction==="liquidar"?<label className="grid gap-1 text-sm font-semibold">Data da liquidação<input type="date" required max={today} value={settleDate} onChange={e=>setSettleDate(e.target.value)} className={control}/></label>:<p className="text-sm text-red-800">O lançamento cancelado continuará no histórico e não entrará nos totais.</p>}<div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={closeAction} className={secondary}>Voltar</button><button disabled={saving} className={primary}>Confirmar</button></div></form>}
    </dialog>
    {tab==="lancamentos"&&<section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-1 bg-[#123e38] px-4 py-3 text-white"><h2 className="font-bold">{status==="pendente"&&kind==="receita"?"Contas a receber":status==="pendente"&&kind==="despesa"?"Contas a pagar":"Lançamentos"}</h2><span className="text-xs">Todos os vencimentos</span></div>
      <div className="grid grid-cols-2 gap-2 p-3 pb-0"><button type="button" disabled={!enabled||saving} className={primary} onClick={()=>openForm("receita")}><Plus size={16}/> Nova receita</button><button type="button" disabled={!enabled||saving} className={secondary+" !text-red-700"} onClick={()=>openForm("despesa")}><Plus size={16}/> Nova despesa</button></div>
      <div className="grid gap-2 p-3 md:grid-cols-3"><input className={control} aria-label="Pesquisar lançamento" placeholder="Descrição ou categoria" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select className={control} aria-label="Tipo" value={kind} onChange={e=>{setKind(e.target.value as typeof kind);setPage(0);}}><option value="todas">Todos os tipos</option><option value="receita">Receitas</option><option value="despesa">Despesas</option></select><select className={control} aria-label="Situação" value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="todos">Todas as situações</option><option value="pendente">Pendente</option><option value="vencido">Vencido</option><option value="liquidado">Liquidado</option><option value="cancelado">Cancelado</option></select></div>
      {!enabled?<p className="p-4 text-sm text-slate-600">{loading?"Consultando autorização e disponibilidade...":"Nenhum dado financeiro real disponível."}</p>:visibleOrders.length===0?<p className="p-4 text-sm text-slate-600">Nenhum lançamento encontrado.</p>:<><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs text-slate-600"><tr>{["Descrição","Tipo","Vencimento","Valor","Situação","Ações"].map(t=><th scope="col" key={t} className="p-3">{t}</th>)}</tr></thead><tbody>{visibleOrders.map(x=><tr key={x.id} className="border-b border-slate-100 even:bg-slate-50"><td className="p-3"><strong>{x.description}</strong><p className="text-xs text-slate-500">{x.category}{x.os_label?" · "+x.os_label:""}{x.cost_center?" · "+x.cost_center:""}</p></td><td className="p-3 capitalize">{x.kind}</td><td className="p-3">{formatFinanceDate(x.due_date)}</td><td className="p-3 font-semibold">{money(x.amount_cents)}</td><td className="p-3 capitalize">{x.status==="pendente"&&x.due_date<today?"Vencido":x.status}{x.settled_date&&<p className="text-xs">{formatFinanceDate(x.settled_date)}</p>}</td><td className="p-3">{actions(x)}</td></tr>)}</tbody></table></div><div className="grid gap-2 p-2.5 md:hidden">{visibleOrders.map(x=><article key={x.id} className="grid min-w-0 gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-sm"><div className="flex flex-wrap items-start justify-between gap-1"><strong className="min-w-0 break-words text-slate-900">{x.description}</strong><span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold "+(x.status==="liquidado"?"bg-emerald-50 text-emerald-800":x.status==="cancelado"?"bg-slate-100 text-slate-600":"bg-amber-50 text-amber-900")}>{x.status==="pendente"&&x.due_date<today?"Vencido":x.status==="liquidado"?"Liquidado":x.status==="cancelado"?"Cancelado":"Pendente"}</span></div><div className="flex flex-wrap items-center justify-between gap-1"><span className="min-w-0 break-words text-xs text-slate-600">{x.category} · {x.kind==="receita"?"Receita":"Despesa"}</span><strong className={"text-base tabular-nums "+(x.kind==="receita"?"text-emerald-800":"text-red-700")}>{money(x.amount_cents)}</strong></div><span className="text-xs text-slate-600">Vencimento: {formatFinanceDate(x.due_date)}{x.settled_date?" · Liquidado: "+formatFinanceDate(x.settled_date):""}</span>{x.os_label&&<span className="break-words text-xs text-slate-500">{x.os_label}</span>}{actions(x)}</article>)}</div></>}
      {enabled&&<footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-2.5 text-xs"><span>{filtered.length} {filtered.length===1?"lançamento":"lançamentos"}</span><div className="flex items-center gap-2"><select aria-label="Registros por página" className={control+" !w-auto"} value={size} onChange={e=>{setSize(Number(e.target.value));setPage(0);}}>{[10,25,50].map(n=><option key={n}>{n}</option>)}</select><button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)} className={secondary} aria-label="Página anterior"><ArrowLeft size={15}/></button>{currentPage+1}/{totalPages}<button type="button" disabled={currentPage>=totalPages-1} onClick={()=>setPage(currentPage+1)} className={secondary} aria-label="Próxima página"><ArrowRight size={15}/></button></div></footer>}
    </section>}
    <p className="text-xs text-slate-500">Controle gerencial. Não movimenta dinheiro, não emite nota fiscal e não substitui contabilidade.</p>
  </main>;
  function actions(x:FinanceEntry){return x.status==="pendente"?<div className="flex flex-wrap gap-1"><button type="button" disabled={saving} className={secondary} onClick={()=>{setSettle(null);setError("");setMessage("");setForm({id:x.id,kind:x.kind,description:x.description,category:x.category,amount:(x.amount_cents/100).toFixed(2).replace(".",","),due_date:x.due_date,competence_date:x.competence_date||x.due_date,os_id:x.os_id||"",cost_center:x.cost_center||"",counterparty:x.counterparty||""});}}>Editar</button><button type="button" disabled={saving} className={secondary} onClick={()=>{setForm(null);setSettleAction("liquidar");setSettle(x);setSettleDate(today);setError("");setMessage("");}}>{x.kind==="receita"?"Receber":"Pagar"}</button><button type="button" disabled={saving} className={secondary+" !text-red-700"} onClick={()=>{setForm(null);setSettleAction("cancelar");setSettle(x);setSettleDate(today);setError("");setMessage("");}}>Cancelar</button></div>:<span className="text-xs text-slate-500">Somente consulta</span>;}
}
