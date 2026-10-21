import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, isTenantSuspended } from "@/modules/cotacoes/lib/auth/session";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

export const dynamic = "force-dynamic";
type ProductInput = { ean: string; nome: string; laboratorio?: string; tipoProduto?: string };
const normalize = (value: unknown) => String(value ?? "").trim();
const key = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

class ImportAccessError extends Error {
  readonly status: 401 | 403;

  constructor(message: string, status: 401 | 403) {
    super(message);
    this.status = status;
  }
}

async function access(mode: string) {
  const auth = await getCurrentAuthContext();
  if (!auth.isAuthenticated || !auth.isActive) throw new ImportAccessError("Acesso não autorizado.", 401);
  if (mode === "catalog") {
    if (!auth.isSuperAdmin) throw new ImportAccessError("Catálogo central exclusivo do administrador MBA Cotações.", 403);
    return { mode, tenantId: null, actor: auth.user?.id };
  }
  if (auth.isSuperAdmin || !auth.tenantAccess || isTenantSuspended(auth.tenantAccess.tenantStatus)) {
    throw new ImportAccessError("Selecione uma farmácia ativa; a conta administrativa não pode cadastrar produtos em nome de clientes.", 403);
  }
  if (!["ADMIN_EMPRESA","COMPRADOR"].includes(auth.tenantAccess.role)) throw new ImportAccessError("Sem permissão para importar produtos.", 403);
  return { mode, tenantId: auth.tenantAccess.tenantId, actor: auth.user?.id };
}

export async function GET(request: NextRequest) {
  try {
    const mode = request.nextUrl.searchParams.get("mode") === "catalog" ? "catalog" : "tenant";
    const authorized = await access(mode);
    const supabase = createSupabaseAdminClient();
    if (mode === "catalog") {
      const page = Math.max(0, Math.min(100000, Number(request.nextUrl.searchParams.get("page") ?? 0) || 0));
      const search = String(request.nextUrl.searchParams.get("q") ?? "")
        .replace(/[^a-zA-Z0-9À-ÿ -]/g, "").trim().slice(0, 90);
      let query = supabase.from("cot_product_catalog")
        .select("id,ean,produto,laboratorio,tipo_produto,ativo",{count:"exact"});
      if (search) query = query.or(`produto.ilike.%${search}%,ean.ilike.%${search}%`);
      const {data,error,count} = await query.order("updated_at",{ascending:false})
        .range(page*200,page*200+199);
      if(error)throw error;
      return NextResponse.json({rows:data??[],count:count??0,page});
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

      const page=(typeof body.page==="number"&&Number.isInteger(body.page)&&body.page>=0&&body.page<=10000)?body.page:0;
      const {data:all,error}=await supabase.from("cot_product_catalog")
        .select("ean,produto,laboratorio,tipo_produto").eq("ativo",true)
        .order("ean").order("laboratorio").range(page*250,(page+1)*250-1);
      if(error)throw error;
      const result=await importProducts(supabase,authorized.tenantId,(all??[]).map((p:{ean:string;produto:string;laboratorio:string;tipo_produto:string|null})=>({
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
    if (error instanceof ImportAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[Cotações produtos] Importação falhou",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Erro ao importar."},{status:500});
  }
}


/** Exclusão EXCLUSIVA do catálogo central. Não acessa public.products nem
 * registros copiados pelas farmácias, inclusive suas cotações históricas. */
export async function DELETE(request: NextRequest) {
  try {
    await access("catalog");
    const body = await request.json() as { ids?: string[]; all?: boolean; confirmation?: string };
    const supabase = createSupabaseAdminClient();
    if (body.all === true) {
      if (body.confirmation !== "EXCLUIR CATÁLOGO CENTRAL") {
        return NextResponse.json({error:"Confirmação de exclusão do catálogo incorreta."},{status:400});
      }
      const {error} = await supabase.from("cot_product_catalog")
        .delete().gte("created_at","1970-01-01T00:00:00Z");
      if(error) throw error;
      return NextResponse.json({ok:true,deletedAll:true});
    }
    const ids = [...new Set(body.ids ?? [])];
    if (!ids.length || ids.length>200 || ids.some(id=> !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id))) {
      return NextResponse.json({error:"Selecione de 1 a 200 produtos válidos."},{status:400});
    }
    const {data,error} = await supabase.from("cot_product_catalog")
      .delete().in("id",ids).select("id");
    if(error) throw error;
    return NextResponse.json({ok:true,deletedIds:(data??[]).map((row:{id:string})=>row.id)});
  } catch(error) {
    if(error instanceof ImportAccessError) return NextResponse.json({error:error.message},{status:error.status});
    console.error("[Cotações catálogo] Exclusão do catálogo central falhou",error);
    return NextResponse.json({error:"Não foi possível excluir itens do catálogo central."},{status:500});
  }
}

type Client=ReturnType<typeof createSupabaseAdminClient>;
async function importProducts(supabase:Client,tenantId:string,items:ProductInput[],updateExisting:boolean) {
  const labNames=[...new Set(items.map(x=>x.laboratorio??"").filter(Boolean))];
  const {data:oldLabs,error:labsError}=await supabase.from("laboratories").select("id,nome")
    .eq("tenant_id",tenantId);
  if(labsError)throw labsError;
  const byName:Map<string,string>=new Map((oldLabs??[]).map((l:{nome:string;id:string})=>[key(l.nome),l.id]));
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
    .select("id,ean,laboratorio_id").eq("tenant_id",tenantId).is("deleted_at",null).in("ean",eans);
  if(existingError)throw existingError;
  const existingByKey:Map<string,string>=new Map((existing??[]).map((p:{ean:string;laboratorio_id:string|null;id:string})=>[p.ean+"|"+(p.laboratorio_id??""),p.id]));
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
