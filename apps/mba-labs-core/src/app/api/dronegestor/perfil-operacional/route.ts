import { NextRequest, NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor, droneGestorRole } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

export const dynamic = "force-dynamic";
const ACTION = "perfil_operacional_v1";

type OperationMode = "solo" | "equipe";
type Profile = {
  modoOperacao: OperationMode;
  operadorNome:string;
  cpfCnpj:string;
  registroMapa:string;
  processoSei:string;
  rtNome:string;
  rtConselho:string;
  rtRegistro:string;
  email:string;
  telefone:string;
  observacoes:string;
};
type Context={usuarioId:string;tipo:string;empresaId:string|null;canManage:boolean};
const empty:Profile={modoOperacao:"solo",operadorNome:"",cpfCnpj:"",registroMapa:"",processoSei:"",rtNome:"",rtConselho:"",rtRegistro:"",email:"",telefone:"",observacoes:""};
function normalize(value:string){return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replaceAll(" ","_")}
function text(value:unknown,max:number){return typeof value==="string"?value.trim().slice(0,max):""}
function operationMode(value:unknown):OperationMode{return value==="equipe"?"equipe":"solo"}
function sanitize(value:unknown):Profile{const source=value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};return{
  modoOperacao:operationMode(source.modoOperacao),operadorNome:text(source.operadorNome,180),cpfCnpj:text(source.cpfCnpj,32),registroMapa:text(source.registroMapa,80),processoSei:text(source.processoSei,100),
  rtNome:text(source.rtNome,180),rtConselho:text(source.rtConselho,40),rtRegistro:text(source.rtRegistro,80),email:text(source.email,180),telefone:text(source.telefone,40),observacoes:text(source.observacoes,1200)
}}
async function context():Promise<{current:Context|null;response:NextResponse|null}>{const data=await getSessionProfile();if(!data.user||!data.profile)return{current:null,response:NextResponse.json({ok:false,error:"Autenticação necessária."},{status:401})};const type=normalize(data.profile.tipo);const master=["super_admin","admin_master"].includes(type);const allowed=(data.appsLiberados??[]).some(app=>app.slug==="dronegestor"&&app.canAccess);if(!master&&!allowed)return{current:null,response:NextResponse.json({ok:false,error:"Acesso ao DroneGestor não liberado."},{status:403})};const roleInput={tipo:data.profile.tipo,isAdminMaster:master,permissoes:data.permissoes};return{current:{usuarioId:data.profile.id,tipo:droneGestorRole(roleInput),empresaId:data.profile.empresa_id,canManage:canManageDroneGestor(roleInput)},response:null}}
function scope(query:any,current:Context){return current.empresaId?query.eq("empresa_id",current.empresaId):query.eq("usuario_id",current.usuarioId)}

export async function GET(){try{const access=await context();if(access.response)return access.response;const current=access.current!,admin=createSupabaseAdminClient() as any;let query=admin.from("core_logs").select("detalhes,created_at").eq("app_slug","dronegestor").eq("acao",ACTION).order("created_at",{ascending:false}).limit(1);query=scope(query,current);const {data,error}=await query.maybeSingle();if(error)throw error;const profile=sanitize(data?.detalhes?.profile??empty);return NextResponse.json({ok:true,profile,canManage:current.canManage,updatedAt:data?.created_at??null});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha ao carregar perfil operacional."},{status:500})}}

export async function POST(request:NextRequest){try{const access=await context();if(access.response)return access.response;const current=access.current!;if(!current.canManage)return NextResponse.json({ok:false,error:"Somente ADMIN/RT pode alterar o perfil operacional."},{status:403});const body=await request.json(),profile=sanitize(body?.profile),admin=createSupabaseAdminClient() as any,now=new Date().toISOString();const {error}=await admin.from("core_logs").insert({empresa_id:current.empresaId,usuario_id:current.usuarioId,app_slug:"dronegestor",acao:ACTION,detalhes:{profile,updatedAt:now,updatedByType:current.tipo}});if(error)throw error;return NextResponse.json({ok:true,profile,updatedAt:now});}catch(error){return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Falha ao salvar perfil operacional."},{status:500})}}
