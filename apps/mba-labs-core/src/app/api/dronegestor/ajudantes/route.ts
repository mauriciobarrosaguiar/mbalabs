import {NextRequest,NextResponse} from "next/server";
import {getSessionProfile} from "@/lib/core-data";
import {canManageDroneGestor,isDroneGestorPilot} from "@/lib/dronegestor-role";
import {requireDroneOsAccess,droneOsErrorResponse} from "@/lib/dronegestor-os-access";
import {assistantNames,assistantRoles} from "@/lib/agrovoo-assistant-directory";
import {createSupabaseAdminClient} from "@mba-labs/shared/supabase/server";
export const dynamic="force-dynamic";
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(request:NextRequest){
 try{
  const s=await getSessionProfile();
  if(!s.user||!s.profile)return reply({ok:false,error:"Autenticação necessária."},401);
  const p=s.profile;
  if(p.status!=="ativo")return reply({ok:false,error:"Conta inativa."},403);
  const role={tipo:p.tipo,permissoes:s.permissoes};
  const canManage=canManageDroneGestor(role);
  if(!(s.appsLiberados??[]).some(a=>a.slug==="dronegestor"&&a.canAccess)||(!canManage&&!isDroneGestorPilot(role)))return reply({ok:false,error:"Consulta não autorizada."},403);
  const osId=(request.nextUrl.searchParams.get("osId")||"").trim();
  if(!osId||osId.length>120)return reply({ok:false,error:"Selecione uma OS válida."},400);
  const admin=createSupabaseAdminClient() as any;
  const os=await requireDroneOsAccess(admin,{userId:p.id,empresaId:p.empresa_id,canManage},osId);
  if(!["aberta","preparacao","em_preparacao"].includes(String(os.data.status||"aberta")))return reply({ok:false,error:"A seleção só está disponível na preparação."},409);
  if(!p.empresa_id)return reply({ok:true,names:[],solo:true});
  const app=await admin.from("core_apps").select("id").eq("slug","dronegestor").eq("ativo",true).maybeSingle();
  if(app.error||!app.data?.id)return reply({ok:false,error:"Cadastro indisponível."},503);
  const perms=await admin.from("core_usuario_app_permissoes").select("usuario_id").eq("empresa_id",p.empresa_id).eq("app_id",app.data.id).eq("status","ativo").in("perfil_app",[...assistantRoles]).limit(501);
  if(perms.error)throw perms.error;
  if((perms.data??[]).length>500)return reply({ok:false,error:"Equipe excede o limite desta consulta."},409);
  const ids=Array.from(new Set<string>((perms.data??[]).map((x:{usuario_id:string})=>x.usuario_id))).filter(id=>id!==p.id);
  if(!ids.length)return reply({ok:true,names:[]});
  const users=await admin.from("core_usuarios").select("id,nome,status").eq("empresa_id",p.empresa_id).eq("status","ativo").in("id",ids);
  if(users.error)throw users.error;
  return reply({ok:true,names:assistantNames(users.data,p.id)});
 }catch(error){
  const access=droneOsErrorResponse(error);
  return access?reply({ok:false,error:access.message},access.status):reply({ok:false,error:"Não foi possível consultar os ajudantes."},503);
 }
}
