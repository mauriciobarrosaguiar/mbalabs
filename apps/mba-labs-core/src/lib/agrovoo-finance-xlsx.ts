import ExcelJS from "exceljs";
import type {FinanceEntry,financialGroups,financialTotals} from "./agrovoo-finance";

type Options={start:string;end:string;basis:"caixa"|"competencia"|"previsao";group:"category"|"cost_center"|"os_id"|"counterparty";demo:boolean};
const brl='"R$" #,##0.00;[Red]"-R$" #,##0.00';
const date=(value:unknown)=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)?new Date(value+"T00:00:00Z"):null;
function header(sheet:ExcelJS.Worksheet,row:number){
 const r=sheet.getRow(row);r.height=24;
 r.eachCell(cell=>{cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF123E38"}};cell.font={bold:true,color:{argb:"FFFFFFFF"}};cell.alignment={vertical:"middle",wrapText:true};});
}
function title(sheet:ExcelJS.Worksheet,label:string,cols:number,options:Options){
 sheet.mergeCells(1,1,1,cols);const c=sheet.getCell("A1");
 c.value=(options.demo?"SIMULAÇÃO — ":"")+"AgroVoo | "+label;c.font={bold:true,size:16,color:{argb:"FF123E38"}};sheet.getRow(1).height=30;
 sheet.mergeCells(2,1,2,cols);sheet.getCell("A2").value="Período: "+options.start.split("-").reverse().join("/")+" a "+options.end.split("-").reverse().join("/")+" | Regime: "+({caixa:"Caixa realizado",competencia:"Competência",previsao:"Previsão"}[options.basis]);
 sheet.getRow(2).height=20;
}
function stripe(sheet:ExcelJS.Worksheet,row:number,cols:number){
 if(row%2===0)for(let i=1;i<=cols;i++)sheet.getCell(row,i).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFF0F6F3"}};
}
export async function financeWorkbook(entries:FinanceEntry[],options:Options,groups:ReturnType<typeof financialGroups>,totals:ReturnType<typeof financialTotals>){
 const workbook=new ExcelJS.Workbook();workbook.creator="AgroVoo";
 const details=workbook.addWorksheet("Lançamentos",{views:[{state:"frozen",ySplit:4}]});
 const columns=[["Tipo",14],["Descrição",46],["Categoria",25],["Centro de custo",25],["Cliente / fornecedor",32],["OS",25],["Competência",16],["Vencimento",16],["Liquidação",16],["Situação",16],["Valor (R$)",22]] as const;
 columns.forEach(([_,width],i)=>{details.getColumn(i+1).width=width;});
 title(details,"Lançamentos",columns.length,options);
 details.getRow(4).values=columns.map(([label])=>label);header(details,4);
 entries.forEach((e,index)=>{
  const r=details.getRow(index+5);
  // Strings are Excel text cells, never formula objects, even if supplied text starts with "=".
  r.values=[e.kind==="receita"?"Receita":"Despesa",e.description,e.category,e.cost_center||"",e.counterparty||"",e.os_label||e.os_id||"",date(e.competence_date||e.due_date),date(e.due_date),date(e.settled_date),e.status,e.amount_cents/100];
  stripe(details,r.number,columns.length);
  for(const i of [7,8,9])r.getCell(i).numFmt="dd/mm/yyyy";
  r.getCell(11).numFmt=brl;r.getCell(11).font={color:{argb:e.kind==="receita"?"FF166534":"FF991B1B"}};
 });
 details.autoFilter={from:{row:4,column:1},to:{row:Math.max(4,entries.length+4),column:columns.length}};
 const summary=workbook.addWorksheet("Resumo",{views:[{state:"frozen",ySplit:4}]});
 [42,22,22,22,18].forEach((w,i)=>{summary.getColumn(i+1).width=w;});
 title(summary,"Resumo financeiro",5,options);
 summary.getRow(4).values=["Grupo","Receitas (R$)","Despesas (R$)","Resultado (R$)","Margem"];header(summary,4);

 groups.forEach((g,i)=>{const r=summary.getRow(i+5);r.values=[g.label,g.revenue/100,g.expense/100,g.net/100,g.revenue?g.net/g.revenue:null];stripe(summary,r.number,5);for(const n of [2,3,4])r.getCell(n).numFmt=brl;r.getCell(5).numFmt="0.0%";});
 const total=summary.getRow(groups.length+5);total.values=["TOTAL",totals.revenue/100,totals.expense/100,totals.net/100,totals.revenue?totals.net/totals.revenue:null];header(summary,total.number);for(const n of [2,3,4])total.getCell(n).numFmt=brl;total.getCell(5).numFmt="0.0%";
 return workbook;
}
