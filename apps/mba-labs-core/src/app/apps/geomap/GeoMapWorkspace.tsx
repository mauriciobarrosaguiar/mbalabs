"use client";
import { useState } from "react";
import { buildReport, PRODUCTS, type ReportInput } from "./report";
import { generateReportPdf } from "./report-pdf";
const initial: ReportInput = {project:"",client:"",operator:"",location:"",flightDate:"",equipment:"",purpose:"",crs:"",photos:"",gsd:"",methodology:"",limitations:"",products:[]};
const fields: {key: Exclude<keyof ReportInput,"products">; label:string; long?:boolean; required?:boolean}[] = [
  {key:"project",label:"Nome do projeto",required:true},{key:"client",label:"Contratante"},
  {key:"operator",label:"Operador / autor",required:true},{key:"location",label:"Local do levantamento"},
  {key:"flightDate",label:"Data do voo"},{key:"equipment",label:"Equipamento"},
  {key:"crs",label:"Sistema de coordenadas"},{key:"photos",label:"Quantidade de fotografias"},
  {key:"gsd",label:"GSD e unidade"},{key:"purpose",label:"Finalidade",long:true,required:true},
  {key:"methodology",label:"Metodologia e parâmetros",long:true},{key:"limitations",label:"Limitações e observações",long:true}
];
export function GeoMapWorkspace() {
  const [data,setData]=useState(initial);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  function download() {
    try {
      const html=buildReport(data);
      const url=URL.createObjectURL(new Blob([html],{type:"text/html;charset=utf-8"}));
      const anchor=document.createElement("a");
      anchor.href=url; anchor.download="relatorio-geomap.html";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
      setMessage("Relatório HTML gerado. Abra o arquivo e use Imprimir > Salvar como PDF.");
    } catch (error) {setMessage(error instanceof Error?error.message:"Não foi possível gerar o relatório.");}
  }
  async function downloadPdf() {
    if(busy) return;
    setBusy(true);setMessage("");
    try {
      const bytes=await generateReportPdf(data);
      const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:"application/pdf"}));
      const anchor=document.createElement("a");
      anchor.href=url;anchor.download="relatorio-geomap.pdf";
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
      setMessage("PDF gerado. Confira o documento antes de entregar.");
    } catch(error){setMessage(error instanceof Error?error.message:"Não foi possível gerar o PDF.");}
    finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <header className="mb-8 border-b border-slate-700 pb-5"><p className="text-sm font-semibold text-cyan-300">MBA LABS / USO ADMINISTRATIVO</p><h1 className="mt-2 text-4xl font-bold">MBA GeoMap</h1><p className="mt-2 text-slate-300">Fotogrametria, análise e documentação geoespacial.</p></header>
      <section className="mb-6 rounded-xl border border-slate-700 bg-slate-900 p-5"><h2 className="text-xl font-semibold">Ambiente de desenvolvimento</h2><p className="mt-2 text-slate-300">O teste público 003 foi aprovado. O servidor definitivo, a fila privada, o armazenamento e as notificações ainda não estão disponíveis. Não envie imagens privadas nesta etapa.</p><a className="mt-3 inline-block rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white hover:bg-cyan-600" href="https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/46135088554">Consultar teste público 003</a><p className="mt-3 text-sm text-slate-300">Política do produto: arquivos disponíveis por 168 horas após conclusão, sem prorrogação. A exclusão automática de produção ainda será implementada.</p></section>
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-5 md:p-7"><h2 className="text-2xl font-semibold">Gerador de relatório — PDF e HTML</h2><p className="mt-2 text-slate-300">Preencha os dados reais do levantamento. A geração ocorre no navegador, sem upload ou salvamento automático. Campos não preenchidos serão indicados como não informados.</p>
        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={event=>{event.preventDefault();void downloadPdf();}}>
          {fields.map(field=><label key={field.key} className={field.long?"grid gap-2 md:col-span-2":"grid gap-2"}><span className="text-sm font-medium">{field.label}{field.required?" *":""}</span>{field.long?<textarea className="min-h-24 rounded-lg border border-slate-600 bg-slate-950 p-3 text-white" required={field.required} maxLength={3000} value={data[field.key]} onChange={e=>setData(old=>({...old,[field.key]:e.target.value}))}/>:<input className="rounded-lg border border-slate-600 bg-slate-950 p-3 text-white" required={field.required} type={field.key==="flightDate"?"date":"text"} maxLength={250} value={data[field.key]} onChange={e=>setData(old=>({...old,[field.key]:e.target.value}))}/>}</label>)}
          <fieldset className="grid gap-2 rounded-lg border border-slate-700 p-4 md:col-span-2"><legend className="px-2 font-medium">Produtos efetivamente gerados (declaração manual)</legend>{PRODUCTS.map(product=><label key={product} className="flex items-center gap-3"><input type="checkbox" checked={data.products.includes(product)} onChange={e=>setData(old=>({...old,products:e.target.checked?[...old.products,product]:old.products.filter(p=>p!==product)}))}/>{product}</label>)}</fieldset>
          <p className="text-sm text-slate-300 md:col-span-2">O documento é um rascunho descritivo, sem certificação de precisão. Revise e assine quando aplicável.</p>
          <button type="submit" disabled={busy} className="rounded-lg bg-cyan-700 px-5 py-3 font-semibold text-white hover:bg-cyan-600 disabled:opacity-60">{busy?"Gerando PDF…":"Baixar relatório PDF"}</button>
          <button type="button" disabled={busy} onClick={download} className="rounded-lg border border-slate-500 px-5 py-3 font-semibold text-slate-100">Baixar versão HTML</button>
          <button type="button" onClick={()=>{setData(initial);setMessage("");}} className="rounded-lg border border-slate-500 px-5 py-3 font-semibold text-slate-100">Limpar formulário</button>
          <p role="status" className="text-sm text-cyan-200 md:col-span-2">{message}</p>
        </form>
      </section>
    </div>
  </main>;
}
