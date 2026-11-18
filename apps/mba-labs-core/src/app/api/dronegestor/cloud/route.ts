import { NextResponse } from "next/server";
import { cloudConnection, cloudContext, cloudDb, cloudEvent, cloudScope, CloudError, decryptCloud, driveCall, googleAccessToken, requireCloudManager } from "@/lib/agrodoc-cloud";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failure(error: unknown) {
  const status = error instanceof CloudError ? error.status : 500;
  return NextResponse.json({ok:false,error:error instanceof Error ? error.message : "Falha na central de armazenamento."},{status});
}
export async function GET() {
  try {
    const context = await cloudContext();
    const db = cloudDb();
    let connection;
    try { connection = await cloudConnection(context); }
    catch(error) {
      const code=String((error as {code?:string})?.code||"");
      if(!["42P01","PGRST205"].includes(code))throw error;
      return NextResponse.json({
        ok:true,canManage:context.can_manage,setupRequired:true,oauthConfigured:false,
        google:{status:"disconnected",account:"",lastTestedAt:null,error:"Migração de armazenamento ainda não configurada."},
        dropbox:{status:"unavailable"},
        counts:{synced:0,pending:0,failed:0,partial:false},
        files:[],events:[]
      });
    }
    if (!context.can_manage) {
      // Pilotos precisam saber apenas se o Drive da empresa esta ativo.
      // A central administrativa e seu historico nunca devem listar
      // dados de OS de outros pilotos.
      return NextResponse.json({
        ok:true,canManage:false,
        google:{status:connection?.status || "disconnected",account:"",lastTestedAt:null,error:null},
        dropbox:{status:"unavailable"},
        counts:{synced:0,pending:0,failed:0,partial:false},
        files:[],events:[]
      });
    }
    const {data:files,error:filesError} = await cloudScope(
      db.from("agrodoc_cloud_files").select("id,os_id,original_name,size_bytes,status,created_at,last_error,attempts"), context
    ).order("created_at",{ascending:false}).limit(100);
    if (filesError) throw filesError;
    const {data:events,error:eventsError} = await cloudScope(
      db.from("agrodoc_cloud_events").select("action,created_at,file_id,details"),context
    ).order("created_at",{ascending:false}).limit(20);
    if (eventsError) throw eventsError;
    const all = files || [];
    return NextResponse.json({
      ok:true,
      canManage:context.can_manage,
      oauthConfigured:Boolean(process.env.AGRODOC_GOOGLE_CLIENT_ID && process.env.AGRODOC_GOOGLE_CLIENT_SECRET && process.env.AGRODOC_GOOGLE_REDIRECT_URI && process.env.AGRODOC_CLOUD_ENCRYPTION_KEY),
      google:{
        status:connection?.status || "disconnected", account:connection?.account_email || "",
        lastTestedAt:connection?.last_tested_at || null, error:connection?.last_error || null
      },
      dropbox:{status:"unavailable"},
      counts:{synced:all.filter((a:any)=>a.status==="synced").length,
        pending:all.filter((a:any)=>a.status==="pending").length,
        failed:all.filter((a:any)=>a.status==="failed").length,
        partial:all.length===100},
      files:all,
      events:events || []
    });
  } catch(error) { return failure(error); }
}
export async function POST(request:Request) {
  try {
    const context = await cloudContext();
    requireCloudManager(context);
    const body = await request.json().catch(()=>({})) as {action?:string};
    if (!["test","disconnect"].includes(body.action || "")) throw new CloudError("Ação não permitida.");
    const connection = await cloudConnection(context);
    if (!connection) throw new CloudError("Conta não conectada.",404);
    if (body.action==="test") {
      const {token}=await googleAccessToken(context);
      await driveCall(token,"files/"+encodeURIComponent(connection.root_folder_id || "root")+"?fields=id,name,mimeType");
      const at=new Date().toISOString();
      const {error}=await cloudScope(cloudDb().from("agrodoc_cloud_connections").update({
        status:"connected",last_error:null,last_tested_at:at,updated_at:at
      }),context).eq("provider","google_drive");
      if(error) throw error;
      await cloudEvent(context,"connection_test");
      return NextResponse.json({ok:true,message:"Google Drive acessível."});
    }
    // Revogação no Google (best effort) seguida da remoção local dos tokens.
    if (connection.access_token_encrypted) {
      try {
        await fetch("https://oauth2.googleapis.com/revoke",{
          method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
          body:new URLSearchParams({token:decryptCloud(connection.access_token_encrypted)}),
          cache:"no-store"
        });
      }catch { /* Sem rede: credenciais locais ainda serão removidas. */ }
    }
    const {error}=await cloudScope(cloudDb().from("agrodoc_cloud_connections").update({
      status:"disconnected",access_token_encrypted:null,refresh_token_encrypted:null,
      token_expires_at:null,last_error:null,updated_at:new Date().toISOString()
    }),context).eq("provider","google_drive");
    if(error)throw error;
    await cloudEvent(context,"connection_disconnected");
    return NextResponse.json({ok:true,message:"Conta desconectada. Documentos e histórico preservados."});
  }catch(error){return failure(error);}
}
