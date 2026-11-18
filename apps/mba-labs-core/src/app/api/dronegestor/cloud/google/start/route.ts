import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cloudContext, encryptCloud, googleSettings, requireCloudManager, CloudError } from "@/lib/agrodoc-cloud";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:NextRequest){
  try {
    const c=await cloudContext();
    requireCloudManager(c);
    const config=googleSettings();
    const state=randomBytes(32).toString("base64url");
    const params=new URLSearchParams({
      client_id:config.clientId,
      redirect_uri:config.redirectUri,
      response_type:"code",
      access_type:"offline",
      prompt:"consent select_account",
      scope:"openid email https://www.googleapis.com/auth/drive.file",
      include_granted_scopes:"false",
      state
    });
    const response=NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?"+params.toString());
    response.cookies.set("agrodoc_drive_oauth",encryptCloud(JSON.stringify({
      state,userId:c.user_id,ownerType:c.owner_type,ownerId:c.owner_id,
      expires:Date.now()+10*60*1000
    })),{httpOnly:true,secure:true,sameSite:"lax",path:"/api/dronegestor/cloud/google",maxAge:600});
    return response;
  }catch(error){
    const message=error instanceof Error?error.message:"Falha ao iniciar OAuth.";
    if(error instanceof CloudError && error.status===401) return NextResponse.redirect(new URL("/login",request.url));
    return NextResponse.redirect(new URL("/apps/dronegestor/configuracoes?drive_error="+encodeURIComponent(message),request.url));
  }
}
