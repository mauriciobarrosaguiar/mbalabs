"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { FlexibleProductImporter } from "@/modules/cotacoes/components/products/flexible-product-importer";

type Product = {id:string;ean:string;produto:string;laboratorio:string;tipo_produto:string|null;ativo:boolean};
export function CatalogAdminPanel(){
 const [rows,setRows]=useState<Product[]>([]);
 const [total,setTotal]=useState(0);
 const [loading,setLoading]=useState(false);
 async function refresh(){
   setLoading(true);
   try{
    const response=await fetch("/api/cotacoes/produtos-importar?mode=catalog",{cache:"no-store"});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error??"Não foi possível consultar o catálogo.");
    setRows(data.rows??[]);setTotal(data.count??0);
   }catch(error){toast.error(error instanceof Error?error.message:"Erro ao consultar catálogo.");}
   finally{setLoading(false);}
 }
 useEffect(()=>{void refresh()},[]);
 return <div className="space-y-5">
  <div>
   <h2 className="text-xl font-semibold text-slate-900">Catálogo administrativo de medicamentos</h2>
   <p className="text-sm text-slate-600">Base mestre do MBA Cotações. Cada farmácia decide se aceita copiar esta base ou manter exclusivamente seus produtos. Nenhum cliente vê produtos de outra farmácia.</p>
  </div>
  <FlexibleProductImporter mode="catalog"/>
  <section className="rounded-xl border bg-white p-4 text-slate-900">
   <div className="mb-3 flex items-center justify-between gap-2">
    <h3 className="font-semibold">Produtos do catálogo central ({total.toLocaleString("pt-BR")})</h3>
    <Button variant="outline" disabled={loading} onClick={()=>void refresh()}>{loading?"Atualizando...":"Atualizar lista"}</Button>
   </div>
   <p className="mb-3 text-xs text-slate-600">Exibindo os 200 itens mais recentes. O arquivo importado continua sendo a fonte para atualizações.</p>
   <div className="max-h-[440px] overflow-auto">
    <table className="w-full min-w-[660px] text-left text-xs">
     <thead className="sticky top-0 bg-slate-100"><tr>
      <th className="p-2">EAN</th><th className="p-2">Produto</th><th className="p-2">Laboratório</th><th className="p-2">Tipo de produto</th>
     </tr></thead>
     <tbody>{rows.map(p=><tr key={p.id} className="border-t">
       <td className="p-2">{p.ean}</td><td className="p-2">{p.produto}</td><td className="p-2">{p.laboratorio||"—"}</td><td className="p-2">{p.tipo_produto||"—"}</td>
     </tr>)}</tbody>
    </table>
   </div>
  </section>
 </div>;
}
