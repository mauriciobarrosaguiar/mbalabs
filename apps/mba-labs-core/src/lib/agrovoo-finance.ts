export type FinanceEntry = {
  id: string;
  kind: "receita" | "despesa";
  description: string;
  category: string;
  amount_cents: number;
  due_date: string;
  status: "pendente" | "liquidado" | "cancelado";
  settled_date: string | null;
};
export type FinanceInput = Pick<FinanceEntry,"kind"|"description"|"category"|"amount_cents"|"due_date">;

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
  return {kind,description,category,amount_cents:amount,due_date:data.due_date};
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
