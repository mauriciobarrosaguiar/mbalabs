"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { FlexibleProductImporter } from "@/modules/cotacoes/components/products/flexible-product-importer";

type Product = {id:string;ean:string;produto:string;laboratorio:string;tipo_produto:string|null;ativo:boolean};

export function CatalogAdminPanel(){
  const [rows,setRows]=useState<Product[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(0);
  const [query,setQuery]=useState("");
  const [search,setSearch]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [loading,setLoading]=useState(false);
  const [deleting,setDeleting]=useState(false);

  async function refresh(nextPage=page,nextSearch=search){
    setLoading(true);
    try {
      const params=new URLSearchParams({mode:"catalog",page:String(nextPage),q:nextSearch});
      const response=await fetch(`/api/cotacoes/produtos-importar?${params}`,{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Não foi possível consultar o catálogo.");
      setRows(data.rows??[]);
      setTotal(data.count??0);
      setPage(nextPage);
      setSearch(nextSearch);
      setSelected([]);
    } catch(error){toast.error(error instanceof Error?error.message:"Erro ao consultar catálogo.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void refresh(0,"");},[]);

  async function removeSelected(){
    if(!selected.length||deleting)return;
    if(!window.confirm(`Excluir ${selected.length} medicamento(s) do catálogo central? Os catálogos privados das farmácias não serão alterados.`))return;
    setDeleting(true);
    try{
      const response=await fetch("/api/cotacoes/produtos-importar",{method:"DELETE",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({ids:selected})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Falha ao excluir.");
      toast.success(`${data.deletedIds?.length??0} produtos removidos do catálogo central.`);
      await refresh(page,search);
    }catch(error){toast.error(error instanceof Error?error.message:"Falha ao excluir.");}
    finally{setDeleting(false);}
  }

  async function removeAll(){
    if(!total||deleting)return;
    const confirmation=window.prompt(
      `Esta ação apagará TODOS os ${total.toLocaleString("pt-BR")} itens do catálogo CENTRAL. Não apaga os produtos de nenhuma farmácia. Para confirmar, digite exatamente: EXCLUIR CATÁLOGO CENTRAL`
    );
    if(confirmation!=="EXCLUIR CATÁLOGO CENTRAL")return;
    setDeleting(true);
    try{
      const response=await fetch("/api/cotacoes/produtos-importar",{method:"DELETE",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({all:true,confirmation})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Falha ao excluir catálogo.");
      toast.success("Catálogo central excluído. Os dados das farmácias foram preservados.");
      setQuery("");
      await refresh(0,"");
    }catch(error){toast.error(error instanceof Error?error.message:"Falha ao excluir catálogo.");}
    finally{setDeleting(false);}
  }

  const allOnPage=rows.length>0&&rows.every(item=>selected.includes(item.id));
  return <div className="min-w-0 space-y-5">
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Catálogo administrativo de medicamentos</h2>
      <p className="text-sm text-slate-600">Esta é somente a base mestre do administrador. Exclusões aqui não apagam produtos, cotações ou históricos das farmácias.</p>
    </div>
    <FlexibleProductImporter mode="catalog"/>
    <section className="min-w-0 rounded-xl border bg-white p-3 text-slate-900 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">Catálogo central ({total.toLocaleString("pt-BR")})</h3>
        <Button type="button" variant="outline" disabled={loading||deleting} onClick={()=>void refresh()}>{loading?"Atualizando...":"Atualizar lista"}</Button>
      </div>
      <form className="mb-3 flex flex-wrap gap-2" onSubmit={event=>{event.preventDefault();void refresh(0,query);}}>
        <input aria-label="Buscar medicamento por nome ou EAN" value={query} onChange={event=>setQuery(event.target.value)}
          placeholder="Buscar produto ou EAN" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-slate-900 sm:min-w-[240px]"/>
        <Button type="submit" disabled={loading||deleting}>Buscar</Button>
      </form>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={!selected.length||deleting} onClick={()=>void removeSelected()}
          className="disabled:text-slate-500">Excluir selecionados ({selected.length})</Button>
        <Button type="button" variant="destructive" disabled={!total||deleting} onClick={()=>void removeAll()}
          className="border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:text-red-500">Excluir catálogo central inteiro</Button>
      </div>
      <p className="mb-3 text-xs text-slate-600">Exibindo até 200 itens por página. Selecione para excluir apenas alguns, ou use a opção de excluir todo o catálogo central.</p>
      <div className="max-h-[480px] w-full overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[670px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-100 text-slate-800"><tr>
            <th className="w-10 p-3"><input type="checkbox" aria-label="Selecionar todos nesta página" checked={allOnPage} onChange={event=>
              setSelected(event.target.checked?rows.map(row=>row.id):[])} /></th>
            <th className="p-3">EAN</th><th className="p-3">Produto</th><th className="p-3">Laboratório</th><th className="p-3">Tipo</th>
          </tr></thead>
          <tbody>{rows.map(p=><tr key={p.id} className="border-t border-slate-200">
            <td className="p-3"><input aria-label={`Selecionar ${p.produto}`} type="checkbox" checked={selected.includes(p.id)}
              onChange={event=>setSelected(current=>event.target.checked?[...current,p.id]:current.filter(id=>id!==p.id))}/></td>
            <td className="p-3">{p.ean}</td><td className="p-3">{p.produto}</td>
            <td className="p-3">{p.laboratorio||"—"}</td><td className="p-3">{p.tipo_produto||"—"}</td>
          </tr>)}</tbody>
        </table>
        {!rows.length?<p className="p-6 text-center text-slate-600">Nenhum produto encontrado.</p>:null}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span>Página {page+1} de {Math.max(1,Math.ceil(total/200))}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={page===0||loading||deleting} onClick={()=>void refresh(page-1)}>Anterior</Button>
          <Button type="button" variant="outline" disabled={(page+1)*200>=total||loading||deleting} onClick={()=>void refresh(page+1)}>Próxima</Button>
        </div>
      </div>
    </section>
  </div>;
}
