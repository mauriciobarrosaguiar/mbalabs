import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cloudContext, cloudDb, cloudEvent, decryptCloud, driveCall, encryptCloud, ensureDriveFolder, googleSettings, googleTokens, requireCloudManager } from "@/lib/agrodoc-cloud";

export const dynamic="force-dynamic";
export const runtime="nodejs";
function match(a:string,b:string){ const x=Buffer.from(a),y=Buffer.from(b); return x.length===y.length && timingSafeEqual(x,y); }
export async function GET(request:NextRequest){
  const target="/apps/dronegestor/configuracoes";
  const redirect=(kind:string,message:string)=>new URL(target+"?"+kind+"="+encodeURIComponent(message),request.url);
  let result:NextResponse;
  try {
    const encrypted=request.cookies.get("agrodoc_drive_oauth")?.value;
    if(!encrypted)throw new Error("Sessão de autorização ausente. Conecte novamente.");
    const saved=JSON.parse(decryptCloud(encrypted)) as {
      state:string; userId:string; ownerId:string; ownerType:string; expires:number
    };
    const state=request.nextUrl.searchParams.get("state")||"";
    const code=request.nextUrl.searchParams.get("code")||"";
    if(!state||!match(saved.state,state)||Date.now()>saved.expires)throw new Error("Estado OAuth inválido ou expirado.");
    const context=await cloudContext();
    requireCloudManager(context);
    if(context.user_id!==saved.userId||context.owner_type!==saved.ownerType||context.owner_id!==saved.ownerId)
      throw new Error("O usuário ou a empresa mudou durante a autorização.");
    if(request.nextUrl.searchParams.get("error")||!code)throw new Error("Autorização cancelada ou recusada no Google.");
    const config=googleSettings();
    const tokens=await googleTokens({code,redirect_uri:config.redirectUri,grant_type:"authorization_code"});
    if(!String(tokens.scope||"").split(" ").includes("https://www.googleapis.com/auth/drive.file"))
      throw new Error("Permissão drive.file não concedida.");
    const me=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{
      headers:{"Authorization":"Bearer "+String(tokens.access_token)},cache:"no-store"
    });
    if(!me.ok)throw new Error("Não foi possível identificar a conta autorizada.");
    const account=await me.json() as {email?:string;sub?:string};
    const root=await ensureDriveFolder(context,String(tokens.access_token),"root","MBA AgroDoc",undefined,account.sub||"");
    const now=new Date().toISOString();
    const existing=await cloudDb().from("agrodoc_cloud_connections").select("refresh_token_encrypted,account_subject")
      .eq("owner_type",context.owner_type).eq("owner_id",context.owner_id).eq("provider","google_drive").maybeSingle();
    if(existing.error)throw existing.error;
    const refresh=tokens.refresh_token?encryptCloud(String(tokens.refresh_token)):
      (existing.data?.account_subject===account.sub?existing.data?.refresh_token_encrypted:null);
    if(!refresh)throw new Error("Google não devolveu autorização de longo prazo. Reconecte e autorize novamente.");
    const {error}=await cloudDb().from("agrodoc_cloud_connections").upsert({
      owner_type:context.owner_type,owner_id:context.owner_id,provider:"google_drive",
      account_email:account.email||null,account_subject:account.sub||null,
      access_token_encrypted:encryptCloud(String(tokens.access_token)),
      refresh_token_encrypted:refresh,
      token_expires_at:new Date(Date.now()+Number(tokens.expires_in||3600)*1000).toISOString(),
      root_folder_id:root,status:"connected",last_error:null,last_tested_at:now,updated_at:now,
      created_by:context.user_id
    },{onConflict:"owner_type,owner_id,provider"});
    if(error)throw error;
    await cloudEvent(context,"connection_authorized",undefined,{account:account.email||""});
    result=NextResponse.redirect(redirect("drive","connected"));
  }catch(error){
    result=NextResponse.redirect(redirect("drive_error",error instanceof Error?error.message:"Erro na conexão."));
  }
  result.cookies.set("agrodoc_drive_oauth","",{httpOnly:true,secure:true,sameSite:"lax",path:"/api/dronegestor/cloud/google",maxAge:0});
  return result;
}
