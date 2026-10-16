import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, isTenantSuspended } from "@/modules/cotacoes/lib/auth/session";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

export const dynamic = "force-dynamic";
type ProductInput = { ean: string; nome: string; laboratorio?: string; tipoProduto?: string };
const normalize = (value: unknown) => String(value ?? "").trim();
const key = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

async function access(mode: string) {
  const auth = await getCurrentAuthContext();
  if (!auth.isAuthenticated || !auth.isActive) throw new Error("Acesso não autorizado.");
  if (mode === "catalog") {
    if (!auth.isSuperAdmin) throw new Error("Catálogo central exclusivo do administrador MBA Cotações.");
    return { mode, tenantId: null, actor: auth.user?.id };
  }
  if (auth.isSuperAdmin || !auth.tenantAccess || isTenantSuspended(auth.tenantAccess.tenantStatus)) {
    throw new Error("Selecione uma farmácia ativa; a conta administrativa não pode cadastrar produtos em nome de clientes.");
  }
  if (!["ADMIN_EMPRESA","COMPRADOR"].includes(auth.tenantAccess.role)) throw new Error("Sem permissão para importar produtos.");
  return { mode, tenantId: auth.tenantAccess.tenantId, actor: auth.user?.id };
}

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get("mode") === "catalog" ? "catalog" : "tenant";
    const authorized = await access(mode);
    const supabase = createSupabaseAdminClient();
    if (mode === "catalog") {
      const { data, error, count } = await supabase.from("cot_product_catalog")
        .select("id,ean,produto,laboratorio,tipo_produto,ativo",{count:"exact"})
        .order("updated_at",{ascending:false}).range(0,199);
      if(error)throw error;
      return NextResponse.json({rows:data??[],count:count??0});
    }
    const {data,error}=await supabase.from("cot_catalog_preferences").select("accepted")
      .eq("tenant_id",authorized.tenantId!).maybeSingle();
    if(error)throw error;
    return NextResponse.json({accepted:Boolean(data?.accepted)});
  } catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Falha na consulta."},{status:403});
  }
}

export async function POST(request: NextRequest) {
  try {
    const body=await request.json() as {mode?:string;action?:string;items?:ProductInput[];accepted?:boolean;page?:number};
    const mode=body.mode==="catalog"?"catalog":"tenant";
    const authorized=await access(mode);
    const supabase=createSupabaseAdminClient();

    if(body.action==="accept"){
      if(!authorized.tenantId) return NextResponse.json({error:"Selecione uma farmácia."},{status:403});
      // Aceite nunca modifica as bases privadas; permite optar por copiar o catálogo.
      const {error}=await supabase.from("cot_catalog_preferences").upsert({
        tenant_id:authorized.tenantId,accepted:body.accepted===true,
        accepted_at:body.accepted===true?new Date().toISOString():null,
        accepted_by:authorized.actor??null,updated_at:new Date().toISOString()
      },{onConflict:"tenant_id"});
      if(error)throw error;
      return NextResponse.json({ok:true,accepted:body.accepted===true});
    }
    if(body.action==="copy"){
      if(!authorized.tenantId) return NextResponse.json({error:"Conta administrativa não importa itens de clientes."},{status:403});
      const {data:pref}=await supabase.from("cot_catalog_preferences").select("accepted")
        .eq("tenant_id",authorized.tenantId).maybeSingle();
      if(!pref?.accepted) return NextResponse.json({error:"O administrador da farmácia precisa aceitar o catálogo antes de copiar."},{status:403});

      const page=Number.isInteger(body.page)&&body.page!>=0&&body.page!<=10000?body.page!:0;
      const {data:all,error}=await supabase.from("cot_product_catalog")
        .select("ean,produto,laboratorio,tipo_produto").eq("ativo",true)
        .order("ean").order("laboratorio").range(page*250,(page+1)*250-1);
      if(error)throw error;
      const result=await importProducts(supabase,authorized.tenantId,(all??[]).map(p=>({
        ean:p.ean,nome:p.produto,laboratorio:p.laboratorio,tipoProduto:p.tipo_produto??""
      })),false);
      return NextResponse.json({ok:true,...result,hasMore:(all??[]).length===250,
        message:"Catálogo copiado em lotes, mantendo os produtos da farmácia."});
    }
    if(!Array.isArray(body.items)||body.items.length<1||body.items.length>250){
      return NextResponse.json({error:"Envie entre 1 e 250 produtos por lote."},{status:400});
    }
    const cleaned:ProductInput[]=body.items.map(item=>({
      ean:normalize(item.ean).replace(/\D/g,""),
      nome:normalize(item.nome).slice(0,550),
      laboratorio:normalize(item.laboratorio).slice(0,240),
      tipoProduto:normalize(item.tipoProduto).slice(0,180)
    }));
    const invalid=cleaned.findIndex(x=> !/^\d{8,14}$/.test(x.ean)||!x.nome);
    if(invalid>=0)return NextResponse.json({error:`Linha ${invalid+1}: informe EAN de 8 a 14 dígitos e produto.`},{status:400});
    if(mode==="catalog"){
      const seen=new Map<string,ProductInput>();
      for(const item of cleaned)seen.set(item.ean+"|"+key(item.laboratorio??""),item);
      const records=[...seen.values()].map(x=>({
        ean:x.ean,produto:x.nome,laboratorio:x.laboratorio??"",tipo_produto:x.tipoProduto||null,
        ativo:true,updated_at:new Date().toISOString()
      }));
      const {error}=await supabase.from("cot_product_catalog").upsert(records,{onConflict:"ean,laboratorio"});
      if(error)throw error;
      return NextResponse.json({ok:true,processed:records.length});
    }
    if(!authorized.tenantId)throw new Error("Farmácia não identificada.");
    const result=await importProducts(supabase,authorized.tenantId,cleaned,true);
    return NextResponse.json({ok:true,...result});
  } catch(error) {
    console.error("[Cotações produtos] Importação falhou",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Erro ao importar."},{status:500});
  }
}

type Client=ReturnType<typeof createSupabaseAdminClient>;
async function importProducts(supabase:Client,tenantId:string,items:ProductInput[],updateExisting:boolean) {
  const labNames=[...new Set(items.map(x=>x.laboratorio??"").filter(Boolean))];
  const {data:oldLabs,error:labsError}=await supabase.from("laboratories").select("id,nome")
    .eq("tenant_id",tenantId);
  if(labsError)throw labsError;
  const byName=new Map((oldLabs??[]).map(l=>[key(l.nome),l.id]));
  const missing=labNames.filter(n=>!byName.has(key(n)));
  if(missing.length){
    const {data:inserted,error:insertErr}=await supabase.from("laboratories")
      .insert(missing.map(nome=>({tenant_id:tenantId,nome,tipo:"laboratorio",status:"ativo"})))
      .select("id,nome");
    if(insertErr)throw insertErr;
    for(const row of inserted??[])byName.set(key(row.nome),row.id);
  }
  const eans=[...new Set(items.map(x=>x.ean))];
  const {data:existing,error:existingError}=await supabase.from("products")
    .select("id,ean,laboratorio_id").eq("tenant_id",tenantId).in("ean",eans);
  if(existingError)throw existingError;
  const existingByKey=new Map((existing??[]).map(p=>[p.ean+"|"+(p.laboratorio_id??""),p.id]));
  const rows=new Map<string,{id?:string;tenant_id:string;nome:string;ean:string;laboratorio_id:string|null;tipo_produto:string|null;status:string}>();
  for(const item of items){
    const laboratory=byName.get(key(item.laboratorio??""))??null;
    const composite=item.ean+"|"+(laboratory??"");
    const id=existingByKey.get(composite);
    if(id&&!updateExisting)continue;
    rows.set(composite,{
      ...(id?{id}:{}),tenant_id:tenantId,nome:item.nome,ean:item.ean,
      laboratorio_id:laboratory,tipo_produto:item.tipoProduto||null,status:"ativo",
    });
  }
  const upserts=[...rows.values()].map(row=>({
    id:row.id??crypto.randomUUID(),
    tenant_id:row.tenant_id,nome:row.nome,ean:row.ean,
    laboratorio_id:row.laboratorio_id,tipo_produto:row.tipo_produto,status:row.status,
    updated_at:new Date().toISOString()
  }));
  if(upserts.length){
    const {error}=await supabase.from("products").upsert(upserts,{onConflict:"id"});
    if(error)throw error;
  }
  const updated=[...rows.values()].filter(x=>Boolean(x.id)).length;
  const created=rows.size-updated;
  return {created,updated,skipped:items.length-created-updated};
}
