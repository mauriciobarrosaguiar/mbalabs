import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/modules/cotacoes/lib/auth/session";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;
const MAX_ROWS = 15000;

async function allRows(table:string,fields:string): Promise<Row[]> {
  const client=createSupabaseAdminClient();
  const found:Row[]=[];
  for(let offset=0;offset<=MAX_ROWS;offset+=500) {
    const {data,error}=await client.from(table).select(fields).order("id",{ascending:true}).range(offset,offset+499);
    if(error)throw error;
    found.push(...(data??[]));
    if((data??[]).length<500)return found;
  }
  throw new Error(`Relatório grande demais para exportação segura em uma única operação (${table}). Solicite exportação paginada.`);
}
const clean=(v:unknown)=>String(v??"").trim();
const safeCell=(v:unknown)=>{
  let value=clean(v);
  if (/^[\s]*[=+@\-\t\r]/.test(value)) value="'"+value;
  return '"'+value.replace(/"/g,'""')+'"';
};
const key=(v:unknown)=>clean(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");

export async function GET(request:NextRequest) {
  try {
    const auth=await getCurrentAuthContext();
    if(!auth.isAuthenticated||!auth.isActive||!auth.isSuperAdmin)
      return NextResponse.json({error:"Acesso reservado ao administrador central."},{status:403});
    const p=request.nextUrl.searchParams;
    const tenantFilter=clean(p.get("empresa"));
    const distributorFilter=clean(p.get("distribuidora"));
    const repFilter=clean(p.get("representante"));
    const start=clean(p.get("inicio")), end=clean(p.get("fim"));
    const exportCsv=p.get("formato")==="csv";
    const page=Math.max(0,Math.min(100000,Number(p.get("page"))||0));

    const [tenants,quotations,sessions,responses,items,quoteItems,distributors]=await Promise.all([
      allRows("tenants","id,nome_fantasia,razao_social,cnpj"),
      allRows("quotations","id,tenant_id,name,module_type,status,created_at,deadline_at,deleted_at"),
      allRows("supplier_quote_sessions","id,tenant_id,quotation_id,supplier_id,seller_name,seller_company,status,submitted_at"),
      allRows("supplier_quote_responses","id,tenant_id,quotation_id,session_id,supplier_id,seller_name,seller_company,billing_company,status,submitted_at"),
      allRows("supplier_quote_response_items","id,quotation_id,quotation_item_id,response_id,supplier_id,distributor_id,offered_product_name,available_quantity,unit_price,net_price"),
      allRows("quotation_items","id,product_name,requested_quantity"),
      allRows("distributors","id,tenant_id,nome")
    ]);

    const tenantsById=new Map(tenants.map(x=>[x.id,x]));
    const quoteItemsById=new Map(quoteItems.map(x=>[x.id,x]));
    const distributorsById=new Map(distributors.map(x=>[x.id,x]));
    const sessionsByQuotation=new Map<string,Row[]>();
    const responsesBySession=new Map<string,Row>();
    const responsesByQuotation=new Map<string,Row[]>();
    const itemsByResponse=new Map<string,Row[]>();
    for(const s of sessions){
      const list=sessionsByQuotation.get(s.quotation_id)??[];list.push(s);sessionsByQuotation.set(s.quotation_id,list);
    }
    for(const r of responses){
      if(r.session_id)responsesBySession.set(r.session_id,r);
      const list=responsesByQuotation.get(r.quotation_id)??[];list.push(r);responsesByQuotation.set(r.quotation_id,list);
    }
    for(const item of items){
      const list=itemsByResponse.get(item.response_id)??[];list.push(item);itemsByResponse.set(item.response_id,list);
    }
    const all:Row[]=[];
    for(const quote of quotations){
      const tenant=tenantsById.get(quote.tenant_id);
      if(tenantFilter&&tenantFilter!==quote.tenant_id)continue;
      const date=String(quote.created_at??"").slice(0,10);
      if(start&&date<start||end&&date>end)continue;
      const invitees=sessionsByQuotation.get(quote.id)??[];
      const seenResponses=new Set<string>();
      const makeRecord=(session?:Row,response?:Row,item?:Row)=>{
        const associatedDistributor=item?.distributor_id?distributorsById.get(item.distributor_id):undefined;
        const distributor=associatedDistributor?.nome??response?.billing_company??"";
        const supplierId=response?.supplier_id??session?.supplier_id??item?.supplier_id??"";
        const representative=response?.seller_name??session?.seller_name??"";
        const company=response?.seller_company??session?.seller_company??"";
        const quoteItem=item?quoteItemsById.get(item.quotation_item_id):undefined;
        return {
          empresa:tenant?.nome_fantasia??"Empresa não identificada",
          empresaId:quote.tenant_id,cnpj:tenant?.cnpj??"",
          cotacao:quote.name,cotacaoId:quote.id,modulo:quote.module_type,
          data:date,prazo:quote.deadline_at??"",situacaoCotacao:quote.deleted_at?"excluida":quote.status,
          representante:representative,representanteId:supplierId,
          empresaRepresentante:company,distribuidora:distributor,
          distribuidoraId:item?.distributor_id??"",
          situacaoResposta:response?.status??session?.status??"sem convite",
          dataResposta:response?.submitted_at??session?.submitted_at??"",
          produto:item?.offered_product_name??quoteItem?.product_name??"",
          quantidadeSolicitada:quoteItem?.requested_quantity??"",
          quantidadeDisponivel:item?.available_quantity??"",
          precoUnitario:item?.net_price??item?.unit_price??"",
        };
      };
      if(!invitees.length && !(responsesByQuotation.get(quote.id)??[]).length)all.push(makeRecord());
      for(const s of invitees){
        const response=responsesBySession.get(s.id)??(responsesByQuotation.get(quote.id)??[]).find(r=>r.supplier_id&&r.supplier_id===s.supplier_id);
        if(response)seenResponses.add(response.id);
        const offers=response?(itemsByResponse.get(response.id)??[]):[];
        if(offers.length)for(const item of offers)all.push(makeRecord(s,response,item));
        else all.push(makeRecord(s,response));
      }
      for(const r of responsesByQuotation.get(quote.id)??[]){
        if(seenResponses.has(r.id))continue;
        const offers=itemsByResponse.get(r.id)??[];
        if(offers.length)for(const item of offers)all.push(makeRecord(undefined,r,item));
        else all.push(makeRecord(undefined,r));
      }
    }
    const companies=tenants.filter(t=>!String(t.cnpj??"").startsWith("CORE-"))
      .map(t=>({value:t.id,label:t.nome_fantasia??t.razao_social})).sort((a,b)=>a.label.localeCompare(b.label,"pt-BR"));
    const representatives=[...new Map(all.filter(r=>r.representanteId).map(r=>[r.representanteId,{value:r.representanteId,label:r.representante||r.empresaRepresentante||"Representante"}])).values()]
      .sort((a,b)=>a.label.localeCompare(b.label,"pt-BR"));
    const distributorsList=distributors.map(d=>({value:d.id,label:d.nome,tenantId:d.tenant_id}))
      .sort((a,b)=>a.label.localeCompare(b.label,"pt-BR"));

    const results=all.filter(r=>
      (!repFilter||r.representanteId===repFilter)&&
      (!distributorFilter||r.distribuidoraId===distributorFilter||
        key(r.distribuidora)===key(distributorsById.get(distributorFilter)?.nome))
    ).sort((a,b)=>b.data.localeCompare(a.data)||a.empresa.localeCompare(b.empresa));
    if(exportCsv){
      const columns:[string,string][]=[
        ["Empresa","empresa"],["CNPJ","cnpj"],["Cotação","cotacao"],
        ["ID Cotação","cotacaoId"],["Módulo","modulo"],["Data","data"],
        ["Prazo","prazo"],["Situação da cotação","situacaoCotacao"],
        ["Representante","representante"],["Empresa do representante","empresaRepresentante"],
        ["Distribuidora","distribuidora"],["Situação da resposta","situacaoResposta"],
        ["Data da resposta","dataResposta"],["Produto ofertado","produto"],
        ["Quantidade solicitada","quantidadeSolicitada"],["Quantidade disponível","quantidadeDisponivel"],
        ["Preço unitário","precoUnitario"]
      ];
      const csv="\uFEFF"+columns.map(x=>safeCell(x[0])).join(";")+"\r\n"+
        results.map(row=>columns.map(c=>safeCell(row[c[1]])).join(";")).join("\r\n");
      return new NextResponse(csv,{headers:{"Content-Type":"text/csv; charset=utf-8",
        "Content-Disposition":'attachment; filename="mba-cotacoes-relatorio-administrativo.csv"',
        "Cache-Control":"no-store"}});
    }
    return NextResponse.json({
      rows:results.slice(page*50,(page+1)*50),total:results.length,
      quotations:new Set(results.map(x=>x.cotacaoId)).size,
      companies,representatives,distributors:distributorsList,page
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("[Cotações admin] Relatório falhou",error);
    return NextResponse.json({error:"Não foi possível carregar o relatório administrativo."},{status:500});
  }
}
