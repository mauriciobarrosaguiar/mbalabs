"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { detectProductImportDelimiter } from "@/modules/cotacoes/lib/csv-delimiter";
import { readProductXlsxRows } from "@/modules/cotacoes/lib/product-xlsx-reader";
import { Check, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/modules/cotacoes/components/ui/button";

type Mode = "catalog" | "tenant";
type Mapping = {ean:number;nome:number;laboratorio:number;tipoProduto:number};
type Row = string[];
type ImportItem = {ean:string;nome:string;laboratorio:string;tipoProduto:string};

function normalized(s:string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function inferred(headers:string[]):Mapping {
  const n=headers.map(normalized);
  const find=(names:string[])=>n.findIndex(s=>names.some(x=>s===x||s.includes(x)));
  return {
    ean:find(["ean","gtin","codigo de barras","cod barras","barcode","cod ean"]),
    nome:find(["produto","descricao","denominacao","nome do medicamento","item","mercadoria"]),
    laboratorio:find(["laboratorio","fabricante","industria","marca"]),
    tipoProduto:find(["tipo de produto","status do produto","classificacao","categoria","tipo produto","tipo"])
  };
}
function csvRecords(s:string,delimiter:string):string[][] {
  const out:string[][]=[];let row:string[]=[],field="",quoted=false;
  for(let i=0;i<s.length;i++){
    const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&c===delimiter){row.push(field.trim());field="";}
    else if(!quoted&&(c==="\n"||c==="\r")){if(c==="\r"&&s[i+1]==="\n")i++;row.push(field.trim());field="";if(row.some(Boolean))out.push(row);row=[];}
    else field+=c;
  }
  row.push(field.trim());if(row.some(Boolean))out.push(row);return out;
}
async function loadRows(file:File) {
  if(file.size>15*1024*1024)throw new Error("Arquivo acima de 15 MB. Divida a planilha em partes menores.");
  const ext=file.name.toLowerCase().split(".").pop();
  if(ext==="xlsx") return readProductXlsxRows(file);
  if(!["csv","txt","tsv"].includes(ext??""))throw new Error("Use Excel .xlsx, CSV, TXT ou TSV. Arquivos .xls antigos devem ser salvos como .xlsx.");
  const text=await file.text();
  const delimiter=ext==="tsv"?"\t":detectProductImportDelimiter(text);
  return csvRecords(text.replace(/^\uFEFF/,""),delimiter);
}
function findHeader(lines:Row[]) {
  let best=0,bestScore=-1;
  for(let i=0;i<Math.min(lines.length,20);i++){
    const m=inferred(lines[i]); const score=Number(m.ean>=0)+Number(m.nome>=0)+Number(m.laboratorio>=0)+Number(m.tipoProduto>=0);
    if(score>bestScore){best=i;bestScore=score;}
    if(score>=3)break;
  }
  return best;
}

function actionProgressText(value:number,mode:Mode){return mode==="catalog"?value+"% processado":value+" (lotes ou % processado)";}

export function FlexibleProductImporter({mode}:{mode:Mode}) {
 const router=useRouter();
 const [headers,setHeaders]=useState<string[]>([]);
 const [rows,setRows]=useState<Row[]>([]);
 const [map,setMap]=useState<Mapping>({ean:-1,nome:-1,laboratorio:-1,tipoProduto:-1});
 const [filename,setFilename]=useState("");
 const [pending,setPending]=useState(false);
 const [fileReadError,setFileReadError]=useState<string|null>(null);
 const [fileSelectionStatus,setFileSelectionStatus]=useState<string|null>(null);
 const [progress,setProgress]=useState(0);
 const [accepted,setAccepted]=useState<boolean|null>(null);
 useEffect(()=>{
   if(mode!=="tenant")return;
   void fetch("/api/cotacoes/produtos-importar?mode=tenant",{cache:"no-store"})
     .then(r=>r.ok?r.json():null).then(v=>{if(v)setAccepted(Boolean(v.accepted));}).catch(()=>undefined);
 },[mode]);

 const mapped=useMemo(()=>{
   if(map.ean<0||map.nome<0)return [];
   const unique=new Map<string,ImportItem>();for(const row of rows){
     const ean=String(row[map.ean]??"").replace(/\D/g,"");
     const nome=String(row[map.nome]??"").trim();
     if(!ean&&!nome)continue;
     const laboratorio=map.laboratorio>=0?String(row[map.laboratorio]??"").trim():"";
     const tipoProduto=map.tipoProduto>=0?String(row[map.tipoProduto]??"").trim():"";
     unique.set(ean+"|"+normalized(laboratorio),{ean,nome,laboratorio,tipoProduto});
   }
   return [...unique.values()];
 },[rows,map]);
 const bad=mapped.filter(p=>!/^\d{8,14}$/.test(p.ean)||!p.nome);

 async function chooseFile(file?:File){
   if(!file){
     setFileSelectionStatus("Nenhum arquivo selecionado. Toque em Selecionar para tentar novamente.");
     return;
   }
   setFileSelectionStatus(`Arquivo recebido: ${file.name}. Lendo conteúdo...`);
   setPending(true);
   setFileReadError(null);
   try{
     const values=await loadRows(file);
     if(values.length<2)throw new Error("A base precisa ter cabeçalho e ao menos um produto.");
     if(values.length>50000)throw new Error("Esta base é muito grande. Importe até 50 mil linhas por arquivo.");
     const headerIndex=findHeader(values);
     const head=values[headerIndex].map((n,i)=>n.trim()||`Coluna ${i+1}`);
     setFilename(file.name);setHeaders(head);setRows(values.slice(headerIndex+1));
     setMap(inferred(head));setProgress(0);
     setFileSelectionStatus(`${file.name}: ${values.length-headerIndex-1} linhas reconhecidas. Confira a prévia.`);
     toast.success(`${values.length-headerIndex-1} linhas lidas. Confira a associação de colunas.`);
   }catch(error){
     const detail=error instanceof Error?error.message:"Formato de arquivo não reconhecido.";
     setFilename("");setHeaders([]);setRows([]);
     setFileReadError(`Não foi possível ler "${file.name}": ${detail}`);
     setFileSelectionStatus(`A leitura de ${file.name} falhou. Veja a mensagem abaixo.`);
     toast.error("Não foi possível ler o arquivo. Veja os detalhes abaixo.");
   }finally{setPending(false);}
 }

 async function send(action:"import"|"copy"="import"){
   if(pending)return;
   if(action==="import"&&(bad.length>0||mapped.length===0)){
     toast.error(bad.length?`${bad.length} registros inválidos; verifique EAN e produto.`:"Associe as colunas de EAN e produto.");return;
   }
   setPending(true);setProgress(0);
   try{
     let created=0,updated=0,processed=0;
     if(action==="copy"){
       let hasMore=true, page=0;
       while(hasMore && page<10000){
         const response=await fetch("/api/cotacoes/produtos-importar",{
           method:"POST",headers:{"Content-Type":"application/json"},
           body:JSON.stringify({mode:"tenant",action:"copy",page})
         });
         const result=await response.json();
         if(!response.ok)throw new Error(result.error??"Falha na cópia do catálogo.");
         created+=Number(result.created??0);updated+=Number(result.updated??0);
         hasMore=Boolean(result.hasMore); page++;
         setProgress(page);
       }
     }else{
       const total=Math.ceil(mapped.length/250);
       for(let i=0;i<total;i++){
         const response=await fetch("/api/cotacoes/produtos-importar",{
           method:"POST",headers:{"Content-Type":"application/json"},
           body:JSON.stringify({mode,action,items:mapped.slice(i*250,(i+1)*250)})
         });
         const result=await response.json();
         if(!response.ok)throw new Error(result.error??"Falha na importação");
         created+=Number(result.created??0);updated+=Number(result.updated??0);processed+=Number(result.processed??0);
         setProgress(Math.round((i+1)/total*100));
       }
     }
     toast.success(action==="copy"?`${created} produtos copiados para sua farmácia.`:
       `${processed||created+updated} produtos processados. ${created} novos, ${updated} atualizados.`);
     if(action==="import"){setRows([]);setHeaders([]);setFilename("");}
     router.refresh();
   }catch(error){toast.error(error instanceof Error?error.message:"Não foi possível importar. Os lotes anteriores podem ter sido salvos.");}
   finally{setPending(false);}
 }

 async function toggle(accept:boolean){
   setPending(true);
   try{
     const response=await fetch("/api/cotacoes/produtos-importar",{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({mode:"tenant",action:"accept",accepted:accept})
     });
     const d=await response.json();if(!response.ok)throw new Error(d.error??"Falha ao salvar opção.");
     setAccepted(accept);toast.success(accept?"Catálogo compartilhado autorizado.":"Catálogo desativado.");
   }catch(error){toast.error(error instanceof Error?error.message:"Falha ao salvar.");}
   finally{setPending(false);}
 }

 async function getPreference(){
   try{
     const response=await fetch("/api/cotacoes/produtos-importar?mode=tenant",{cache:"no-store"});
     const data=await response.json();if(response.ok)setAccepted(Boolean(data.accepted));
   }catch{}
 }
 // A consulta de preferência depende de ação do usuário para evitar chamadas repetidas no render.
 async function downloadModel() {
   try {
     const ExcelJS=await import("exceljs");
     const workbook=new ExcelJS.Workbook();
     const sheet=workbook.addWorksheet("Produtos");
     sheet.columns=[
       {header:"EAN",key:"ean",width:21,style:{numFmt:"@"}},
       {header:"Produto",key:"nome",width:65},
       {header:"Laboratório",key:"laboratorio",width:45},
       {header:"TIPO DE PRODUTO (STATUS DO PRODUTO)",key:"tipoProduto",width:40},
     ];
     sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
     sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF007F69"}};
     sheet.views=[{state:"frozen",ySplit:1}];
     const buffer=await workbook.xlsx.writeBuffer();
     const blob=new Blob([buffer as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
     const url=URL.createObjectURL(blob);
     const link=document.createElement("a");link.href=url;link.download="modelo_produtos_mba_cotacoes.xlsx";link.click();
     URL.revokeObjectURL(url);
   }catch{toast.error("Não foi possível gerar o modelo Excel.");}
 }

 return <div className="space-y-4 rounded-xl border border-teal-200 bg-white p-4 text-slate-900">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h3 className="font-semibold">{mode==="catalog"?"Catálogo compartilhável do administrador":"Importar produtos da farmácia"}</h3>
    <p className="text-xs text-slate-600">Aceita bases com colunas e ordem diferentes. Tipo de produto pode ficar em branco.</p>
   </div>
   <div className="flex flex-wrap gap-2">
    <Button variant="outline" onClick={()=>void downloadModel()}><FileSpreadsheet className="size-4"/>Modelo 4 colunas</Button>
    <label className="relative inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-teal-400 bg-teal-50 px-3 text-sm font-medium hover:bg-teal-100">
      <Upload className="size-4"/>{pending?"Lendo arquivo...":"Selecionar Excel, CSV ou TXT"}
      <input
        type="file"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="Selecionar arquivo de produtos Excel CSV ou TXT"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv,.tsv,text/tab-separated-values,.txt,text/plain"
        disabled={pending}
        onClick={event=>{
          event.currentTarget.value="";
          setFileReadError(null);
          setFileSelectionStatus("Seletor aberto. Aguarde a seleção de um arquivo no seu dispositivo.");
        }}
        onCancel={()=>setFileSelectionStatus("Seleção cancelada. Nenhum arquivo foi recebido.")}
        onChange={event=>void chooseFile(event.currentTarget.files?.[0])}
      />
    </label>
   </div>
  </div>
  {mode==="tenant"?<div className="flex flex-wrap items-center gap-3 border-t pt-4">
   <p className="text-sm">Catálogo do administrador: {accepted===null?"consultar opção":accepted?"aceito":"não aceito"}</p>
   <Button variant="outline" onClick={()=>void getPreference()}>Consultar</Button>
   <Button disabled={pending} variant="outline" onClick={()=>void toggle(true)}><Check className="size-4"/>Aceitar catálogo</Button>
   <Button disabled={pending} variant="outline" onClick={()=>void toggle(false)}>Não utilizar catálogo</Button>
   {accepted?<Button disabled={pending} onClick={()=>void send("copy")}>Copiar catálogo para meus produtos</Button>:null}
   <p className="w-full text-xs text-slate-500">O catálogo só é copiado mediante autorização. Produtos próprios não são removidos nem compartilhados.</p>
  </div>:null}
  {fileSelectionStatus?<p role="status" aria-live="polite" className="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">{fileSelectionStatus}</p>:null}
  {fileReadError?<p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{fileReadError}</p>:null}
  {headers.length>0?<>
    <p className="text-sm font-medium">{filename} — {rows.length.toLocaleString("pt-BR")} linhas</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {([["ean","EAN"],["nome","Produto"],["laboratorio","Laboratório"],["tipoProduto","Tipo de produto (opcional)"]] as const).map(([field,label])=>
        <label key={field} className="space-y-1 text-xs font-semibold">{label}
         <select className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-slate-900"
           value={map[field]} onChange={e=>setMap(m=>({...m,[field]:Number(e.target.value)}))}>
           <option value={-1}>Não identificado</option>
           {headers.map((header,i)=><option key={i} value={i}>{header}</option>)}
         </select>
        </label>)}
    </div>
    <p className="text-sm">{mapped.length.toLocaleString("pt-BR")} produtos únicos identificados. {bad.length? `${bad.length} inválidos (EAN/nome).`:"Prontos para importação."}</p>
    <div className="overflow-auto rounded border">
     <table className="min-w-full text-left text-xs"><thead className="bg-slate-100"><tr><th className="p-2">EAN</th><th className="p-2">Produto</th><th className="p-2">Laboratório</th><th className="p-2">Tipo</th></tr></thead>
      <tbody>{mapped.slice(0,7).map((x,i)=><tr key={i} className="border-t">
       <td className="p-2">{x.ean}</td><td className="p-2">{x.nome}</td><td className="p-2">{x.laboratorio||"—"}</td><td className="p-2">{x.tipoProduto||"—"}</td>
      </tr>)}</tbody>
     </table>
    </div>
    <div className="flex flex-wrap items-center gap-3">
     <Button disabled={pending||bad.length>0||mapped.length===0||map.ean===map.nome} onClick={()=>void send()}>
      {pending?<Loader2 className="size-4 animate-spin"/>:<Upload className="size-4"/>}
      {pending?"Importando...":"Confirmar importação"}
     </Button>
     {pending?<p className="text-sm text-teal-800" role="status">{actionProgressText(progress,mode)}</p>:null}
     <Button variant="outline" disabled={pending} onClick={()=>{setHeaders([]);setRows([]);setFilename("");}}>Cancelar</Button>
    </div>
   </>:null}
 </div>;
}
