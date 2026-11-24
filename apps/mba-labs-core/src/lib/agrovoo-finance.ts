export type FinanceEntry = {
  id: string;
  kind: "receita" | "despesa";
  description: string;
  category: string;
  amount_cents: number;
  due_date: string;
  status: "pendente" | "liquidado" | "cancelado";
  settled_date: string | null;
  competence_date?: string;
  os_id?: string | null;
  cost_center?: string;
  counterparty?: string;
  os_label?: string;
};
export type FinanceInput = Pick<FinanceEntry,"kind"|"description"|"category"|"amount_cents"|"due_date"|"competence_date"|"os_id"|"cost_center"|"counterparty">;

export function validDate(value: unknown): value is string {
  if(typeof value!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))return false;
  const date=new Date(value+"T00:00:00Z");
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function financeToday(now=new Date()){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Araguaina",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  return ["year","month","day"].map(type=>parts.find(part=>part.type===type)?.value).join("-");
}
export function parseAmountCents(raw: string): number {
  const text=raw.trim().replace(",",".");
  if(!/^\d{1,9}(?:\.\d{1,2})?$/.test(text))throw new Error("Informe um valor positivo com até duas casas decimais.");
  const [whole,fraction=""]=text.split(".");
  const cents=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  if(!Number.isSafeInteger(cents)||cents<=0)throw new Error("Informe um valor maior que zero.");
  return cents;
}
export function validateFinanceInput(raw:unknown): FinanceInput {
  const data=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  const kind=data.kind;
  const description=typeof data.description==="string"?data.description.trim():"";
  const category=typeof data.category==="string"?data.category.trim():"";
  const amount=data.amount_cents;
  if(kind!=="receita"&&kind!=="despesa")throw new Error("Tipo de lançamento inválido.");
  if(!description||description.length>180||!category||category.length>80)throw new Error("Informe descrição e categoria válidas.");
  if(typeof amount!=="number"||!Number.isSafeInteger(amount)||amount<=0||amount>99999999999)throw new Error("Valor inválido.");
  if(!validDate(data.due_date))throw new Error("Informe uma data de vencimento válida.");
  const result:FinanceInput={kind,description,category,amount_cents:amount,due_date:data.due_date};
  if("competence_date" in data){if(!validDate(data.competence_date))throw new Error("Informe uma data de competência válida.");result.competence_date=data.competence_date;}
  if("os_id" in data){const id=data.os_id;if(id!==null&&id!==""&&(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))throw new Error("Ordem de serviço inválida.");result.os_id=id?String(id):null;}
  for(const key of ["cost_center","counterparty"] as const){if(key in data){const value=data[key];if(typeof value!=="string"||value.trim().length>120)throw new Error("Centro de custo ou contraparte inválidos.");result[key]=value.trim();}}
  return result;
}
export function summarizeFinance(entries:FinanceEntry[], today:string, month:string){
  const result={receivable:0,payable:0,overdue:0,dueToday:0,received:0,paid:0,net:0};
  for(const entry of entries){
    if(entry.status==="cancelado")continue;
    if(entry.status==="pendente"){
      if(entry.kind==="receita")result.receivable+=entry.amount_cents;
      else result.payable+=entry.amount_cents;
      if(entry.due_date<today)result.overdue++;
      if(entry.due_date===today)result.dueToday++;
    }
    if(entry.status==="liquidado"&&entry.settled_date?.slice(0,7)===month){
      if(entry.kind==="receita")result.received+=entry.amount_cents;
      else result.paid+=entry.amount_cents;
    }
  }
  result.net=result.received-result.paid;
  return result;
}
export function nextFinanceState(entry:FinanceEntry, action:unknown, date:unknown,today:string): Pick<FinanceEntry,"status"|"settled_date">{
  if(entry.status!=="pendente")throw new Error("Somente lançamentos pendentes podem ser alterados.");
  if(action==="cancelar")return {status:"cancelado",settled_date:null};
  if(action!=="liquidar"||!validDate(date)||date>today)throw new Error("Informe uma data de liquidação válida, não futura.");
  return {status:"liquidado",settled_date:date};
}

export function financialPeriod(entries:FinanceEntry[],start:string,end:string,basis:"caixa"|"competencia"|"previsao"){
  if(!validDate(start)||!validDate(end)||start>end)throw new Error("Período inválido.");
  return entries.filter(e=>{
    if(e.status==="cancelado")return false;
    if(basis==="caixa"&&e.status!=="liquidado")return false;
    if(basis==="previsao"&&e.status!=="pendente")return false;
    const date=basis==="caixa"?e.settled_date:basis==="previsao"?e.due_date:e.competence_date||e.due_date;
    return Boolean(date&&date>=start&&date<=end);
  });
}
export function financialGroups(entries:FinanceEntry[],field:"category"|"cost_center"|"os_id"|"counterparty"){
  const groups=new Map<string,{key:string;label:string;revenue:number;expense:number;net:number;count:number}>();
  for(const e of entries){
    if(e.status==="cancelado")continue;
    const key=e[field]||"";
    const g=groups.get(key)||{key,label:field==="os_id"?(e.os_label||key||"Sem OS vinculada"):(key||"Não informado"),revenue:0,expense:0,net:0,count:0};
    if(e.kind==="receita")g.revenue+=e.amount_cents;else g.expense+=e.amount_cents;
    g.net=g.revenue-g.expense;g.count++;groups.set(key,g);
  }
  return [...groups.values()].sort((a,b)=>b.revenue-a.revenue||b.expense-a.expense||a.label.localeCompare(b.label,"pt-BR"));
}
export function financialTotals(entries:FinanceEntry[]){
  const total={revenue:0,expense:0,net:0};
  for(const e of entries){if(e.status==="cancelado")continue;if(e.kind==="receita")total.revenue+=e.amount_cents;else total.expense+=e.amount_cents;}
  total.net=total.revenue-total.expense;return total;
}
export function financeCsv(entries:FinanceEntry[]){
  const cell=(raw:unknown)=>{let s=String(raw??"");if(/^[\s\uFEFF]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const rows=[["Tipo","Descrição","Categoria","Centro de custo","Contraparte","OS","Competência","Vencimento","Liquidação","Situação","Valor (R$)"],...entries.map(e=>[e.kind,e.description,e.category,e.cost_center,e.counterparty,e.os_label||e.os_id,e.competence_date||e.due_date,e.due_date,e.settled_date,e.status,(e.amount_cents/100).toFixed(2).replace(".",",")])];
  return "\uFEFF"+rows.map(row=>row.map(cell).join(";")).join("\r\n");
}
