import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor, droneGestorRole } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";

const ACTION = "configuracao_empresa_v1";

type Settings = {
  insightsObrigatorios: boolean;
  margemPreventiva: number;
  bloquearMargemPreventiva: boolean;
  exigirConfirmacao: boolean;
  protocoloBordaduraCigarrinha: boolean;
};

type Context = { usuarioId:string; tipo:string; empresaId:string|null; isAdmin:boolean; canManage:boolean };
const defaults:Settings = { insightsObrigatorios:true, margemPreventiva:90, bloquearMargemPreventiva:true, exigirConfirmacao:true, protocoloBordaduraCigarrinha:false };
function normalizeType(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replaceAll(" ","_")}
async function getContext():Promise<{current:Context|null;response:NextResponse|null}>{const context=await getSessionProfile();if(!context.user||!context.profile)return{current:null,response:NextResponse.json({ok:false,error:"Autenticação necessária."},{status:401})};const admin=["super_admin","admin_master"].includes(normalizeType(context.profile.tipo));const allowed=(context.appsLiberados??[]).some(app=>app.slug==="dronegestor"&&app.canAccess);if(!admin&&!allowed)return{current:null,response:NextResponse.json({ok:false,error:"Acesso ao DroneGestor não liberado."},{status:403})};const roleInput={tipo:context.profile.tipo,isAdminMaster:admin,permissoes:context.permissoes};return{current:{usuarioId:context.profile.id,tipo:droneGestorRole(roleInput),empresaId:context.profile.empresa_id,isAdmin:admin,canManage:canManageDroneGestor(roleInput)},response:null}}
function scope(query:any,current:Context){return current.empresaId?query.eq("empresa_id",current.empresaId):query.eq("usuario_id",current.usuarioId)}
function sanitize(value:unknown):Settings{const source=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};const margin=Number(source.margemPreventiva);return{insightsObrigatorios:source.insightsObrigatorios!==false,margemPreventiva:Number.isFinite(margin)?Math.max(0,Math.min(5000,margin)):defaults.margemPreventiva,bloquearMargemPreventiva:source.bloquearMargemPreventiva!==false,exigirConfirmacao:source.exigirConfirmacao!==false,protocoloBordaduraCigarrinha:source.protocoloBordaduraCigarrinha===true}}

export async function GET(){try{const access=await getContext();if(access.response)return access.response;const current=access.current!,admin=createSupabaseAdminClient() as any;let query=admin.from("core_logs").select("detalhes,created_at").eq("app_slug","dronegestor").eq("acao",ACTION).order("created_at",{ascending:false}).limit(1);query=scope(query,current);const {data,error}=await query.maybeSingle();if(error)throw error;const settings=data?.detalhes&&typeof data.detalhes==="object"&&"settings" in data.detalhes?sanitize((data.detalhes as any).settings):defaults;return NextResponse.json({ok:true,settings,canManage:current.canManage,updatedAt:data?.created_at??null})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha ao carregar configuração."},{status:500})}}

export async function POST(request:NextRequest){try{const access=await getContext();if(access.response)return access.response;const current=access.current!;if(!current.canManage)return NextResponse.json({ok:false,error:"Somente administrador da empresa ou responsável técnico pode alterar os padrões."},{status:403});const body=await request.json(),settings=sanitize(body?.settings),admin=createSupabaseAdminClient() as any,now=new Date().toISOString();const {error}=await admin.from("core_logs").insert({empresa_id:current.empresaId,usuario_id:current.usuarioId,app_slug:"dronegestor",acao:ACTION,detalhes:{settings,updatedAt:now,updatedByType:current.tipo}});if(error)throw error;return NextResponse.json({ok:true,settings,updatedAt:now})}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha ao salvar configuração."},{status:500})}}
