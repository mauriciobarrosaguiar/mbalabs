import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic="force-dynamic";
function str(v:unknown,n=300){return typeof v==="string"?v.trim().slice(0,n):""}
export async function GET(){
 try{
  const session=await getSessionProfile();
  if(!session.user||!session.profile || session.profile.status !== "ativo")return NextResponse.json({error:"Entre na MBA Labs."},{status:401});
  const t=str(session.profile.tipo).toLowerCase(),master=["super_admin","admin_master"].includes(t);
  if(!master&&!(session.appsLiberados??[]).some(a=>a.slug==="dronegestor"&&a.canAccess))
    return NextResponse.json({error:"Acesso não liberado."},{status:403});
  const db=createSupabaseAdminClient() as any;
  const userId=session.profile.id,empresaId=session.profile.empresa_id;
  const ops=db.from("core_logs").select("id,detalhes,created_at").eq("app_slug","dronegestor")
    .eq("acao","operacao_finalizada").eq("usuario_id",userId).order("created_at",{ascending:false}).limit(400);
  let reviews=db.from("core_logs").select("detalhes,created_at").eq("app_slug","dronegestor")
    .eq("acao","operacao_revisao_mapa_2026_v1").order("created_at",{ascending:true}).limit(2500);
  reviews=empresaId?reviews.eq("empresa_id",empresaId):reviews.eq("usuario_id",userId);
  const [opResult,reviewResult]=await Promise.all([ops,reviews]);
  if(opResult.error)throw opResult.error;if(reviewResult.error)throw reviewResult.error;
  const ids=new Set((opResult.data||[]).map((x:any)=>String(x.id)));
  const last=new Map<string,any>();
  for(const row of reviewResult.data||[]){
   const id=str(row.detalhes?.operationEventId,120);
   if(ids.has(id))last.set(id,{...row.detalhes,reviewedAt:row.created_at});
  }
  const items=(opResult.data||[]).filter((op:any)=>last.get(String(op.id))?.status==="correcao")
    .map((op:any)=>({id:op.id,ordemServicoNumero:str(op.detalhes?.summary?.ordemServicoNumero),
      fazendaNome:str(op.detalhes?.summary?.fazendaNome),
      motivo:str(last.get(String(op.id))?.observacao,1500),
      revisadoEm:last.get(String(op.id))?.reviewedAt})).slice(0,8);
  return NextResponse.json({ok:true,items});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Erro ao consultar pendências do piloto."},{status:500})}
}
