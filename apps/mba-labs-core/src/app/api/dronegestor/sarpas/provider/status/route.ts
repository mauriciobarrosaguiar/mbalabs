import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { sarpasProviderStatus } from "@/lib/dronegestor-sarpas-provider";
export const dynamic="force-dynamic";
export async function GET(){
  const session=await getSessionProfile();
  if(!session.user||!session.profile || session.profile.status !== "ativo")return NextResponse.json({error:"Autenticação necessária."},{status:401});
  const type=session.profile.tipo.toLowerCase().replaceAll(" ","_");
  const master=["admin_master","super_admin"].includes(type);
  const allowed=(session.appsLiberados??[]).some(a=>a.slug==="dronegestor"&&a.canAccess);
  if((!master&&!allowed)||!canManageDroneGestor({tipo:session.profile.tipo,isAdminMaster:master,permissoes:session.permissoes}))return NextResponse.json({error:"Acesso restrito."},{status:403});
  return NextResponse.json({ok:true,...sarpasProviderStatus(),submissionEnabled:false},{headers:{"Cache-Control":"no-store"}});
}
