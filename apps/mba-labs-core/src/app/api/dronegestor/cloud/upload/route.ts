import { NextRequest, NextResponse } from "next/server";
import { cloudContext, cloudDb, cloudEvent, cloudScope, CloudError, decryptCloud, driveCall, driveOperationFolder, encryptCloud, googleAccessToken, safeCloudName } from "@/lib/agrodoc-cloud";
import { requireDroneOsAccess, droneOsErrorResponse } from "@/lib/dronegestor-os-access";

export const dynamic="force-dynamic";
export const runtime="nodejs";

const MIME: Record<string,string> = {
  "application/pdf":".pdf","image/jpeg":".jpg","image/png":".png","image/webp":".webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":".xlsx",
  "video/mp4":".mp4","video/quicktime":".mov","application/zip":".zip",
  "application/vnd.google-earth.kml+xml":".kml","application/vnd.google-earth.kmz":".kmz"
};
const TYPES: Record<string,string> = {
  outro:"Outros",receituario:"Receituários",mapa_aplicacao:"Mapas",
  sarpas_autorizacao:"Autorizações",sisant_certidao:"Autorizações",
  avaliacao_risco:"Outros",seguro:"Autorizações",exame_piloto_anac:"Autorizações",
  registro_mapa:"Autorizações",relatorio_mapa:"Relatórios MAPA",
  foto:"Fotos",video:"Vídeos",historico_voo:"Histórico de voo",
  relatorio_operacional:"Relatórios operacionais"
};
type Input={action?:string;osId?:string;documentId?:string;category?:string;name?:string;mimeType?:string;size?:number;sha256?:string};
function responseError(error:unknown) {
  const osError=droneOsErrorResponse(error);
  return NextResponse.json({ok:false,error:osError?.message||(error instanceof Error ? error.message:"Falha no envio.")},
    {status:osError?.status||(error instanceof CloudError?error.status:500)});
}
async function checkOs(context:Awaited<ReturnType<typeof cloudContext>>,osId:string) {
  return requireDroneOsAccess(cloudDb(),{
    userId:context.user_id,empresaId:context.owner_type==="empresa"?context.owner_id:null,
    canManage:context.can_manage
  },osId);
}
async function checkUploadPermission(context:Awaited<ReturnType<typeof cloudContext>>) {
  if(context.can_manage || context.owner_type==="usuario")return;
  const {data,error}=await cloudDb().from("core_logs").select("detalhes")
    .eq("app_slug","dronegestor").eq("acao","piloto_operacional_v1")
    .eq("empresa_id",context.owner_id)
    .contains("detalhes",{usuarioId:context.user_id,ativo:true}).limit(1).maybeSingle();
  if(error)throw error;
  if(!data || data.detalhes?.permissoes?.anexarEvidencias===false)
    throw new CloudError("Este piloto não tem permissão para anexar evidências.",403);
}
async function fetchRecord(context:Awaited<ReturnType<typeof cloudContext>>,documentId:string) {
  const {data,error}=await cloudScope(cloudDb().from("agrodoc_cloud_files").select("*"),context).eq("id",documentId).maybeSingle();
  if(error)throw error;
  if(!data)throw new CloudError("Envio não encontrado nesta empresa.",404);
  return data as Record<string,any>;
}
export async function GET(request:NextRequest){
  try{
    const c=await cloudContext();
    const osId=String(request.nextUrl.searchParams.get("osId")||"").slice(0,120);
    if(!osId)throw new CloudError("Informe a OS.");
    await checkOs(c,osId);
    await checkUploadPermission(c);
    const {data,error}=await cloudScope(cloudDb().from("agrodoc_cloud_files")
      .select("id,os_id,original_name,size_bytes,mime_type,sha256,status,upload_session_encrypted,created_at"),c)
      .eq("os_id",osId).eq("status","pending").order("created_at",{ascending:false}).limit(20);
    if(error)throw error;
    return NextResponse.json({ok:true,pending:(data||[]).map((item:any)=>({
      id:item.id,osId:item.os_id,name:item.original_name,size:item.size_bytes,
      mimeType:item.mime_type,sha256:item.sha256,createdAt:item.created_at,
      sessionUrl:item.upload_session_encrypted?decryptCloud(item.upload_session_encrypted):null
    }))});
  }catch(error){return responseError(error);}
}
export async function POST(request:NextRequest) {
  try {
    const c=await cloudContext();
    await checkUploadPermission(c);
    const body=await request.json().catch(()=>({})) as Input;
    if(body.action==="complete"){
      const doc=await fetchRecord(c,String(body.documentId||""));
      await checkOs(c,doc.os_id);
      if(doc.status==="synced")return NextResponse.json({ok:true,id:doc.id,status:"synced",duplicate:true});
      const {token}=await googleAccessToken(c);
      const expectedId=doc.id;
      // Busca por appProperties para impedir que um ID de arquivo de outro usuário seja confirmado.
      const q="appProperties has { key='agrodocUploadId' and value='"+expectedId+"' } and trashed=false";
      const r=await driveCall(token,"files?fields=files(id,name,size,parents,md5Checksum,appProperties)&q="+encodeURIComponent(q));
      const data=await r.json() as {files?:Array<Record<string,any>>};
      const file=(data.files||[]).find((f)=>f.appProperties?.agrodocOwnerId===c.owner_id &&
        String(f.size)===String(doc.size_bytes)&&f.parents?.includes(doc.provider_folder_id));
      if(!file)throw new CloudError("Arquivo ainda não foi confirmado no Drive, ou seus metadados não conferem.",409);
      const {error}=await cloudScope(cloudDb().from("agrodoc_cloud_files").update({
        provider_file_id:file.id,provider_md5:file.md5Checksum||null,status:"synced",
        upload_session_encrypted:null,last_error:null,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()
      }),c).eq("id",doc.id).eq("status","pending");
      if(error)throw error;
      await cloudEvent(c,"upload_complete",doc.id,{providerFileId:file.id,bytes:doc.size_bytes});
      return NextResponse.json({ok:true,id:doc.id,status:"synced"});
    }
    if(body.action!=="start")throw new CloudError("Ação de upload inválida.");
    const osId=String(body.osId||"").trim().slice(0,120);
    const category=String(body.category||"");
    const name=String(body.name||"");
    const mimeType=String(body.mimeType||"");
    const size=Number(body.size);
    const sha=String(body.sha256||"").toLowerCase();
    if(!osId||!TYPES[category]||!name||name.length>240||!MIME[mimeType])throw new CloudError("OS, categoria ou formato de arquivo inválido.");
    if(!Number.isSafeInteger(size)||size<1||size>2*1024*1024*1024)throw new CloudError("Arquivo excede o limite de 2 GB por envio.");
    if(sha && !/^[a-f0-9]{64}$/.test(sha))throw new CloudError("Hash SHA-256 inválido.");
    const os=await checkOs(c,osId);
    const db=cloudDb();
    // A mesma OS, categoria e hash não deve criar duplicatas por repetição de envio.
    if(sha){
      const {data:duplicates,error:e}=await cloudScope(db.from("agrodoc_cloud_files").select("id,status,upload_session_encrypted"),c)
        .eq("os_id",osId).eq("category",category).eq("sha256",sha).in("status",["pending","synced"]).limit(1);
      if(e)throw e;
      if(duplicates?.length)return NextResponse.json({
        ok:true,duplicate:true,id:duplicates[0].id,status:duplicates[0].status,
        sessionUrl:duplicates[0].upload_session_encrypted?decryptCloud(duplicates[0].upload_session_encrypted):null
      });
    }
    const {token,connection}=await googleAccessToken(c);
    const propertyId=String(os.data.fazendaId||os.data.propriedadeId||"nao-informada").slice(0,120);
    const propertyName=String(os.data.fazendaNome||os.data.propriedadeNome||"Propriedade").slice(0,120);
    const folderId=await driveOperationFolder(c,token,osId,propertyId,propertyName,TYPES[category],connection.account_subject||"");
    const docId=crypto.randomUUID();
    const now=new Date().toISOString();
    const {error:insertionError}=await db.from("agrodoc_cloud_files").insert({
      id:docId,owner_type:c.owner_type,owner_id:c.owner_id,provider:"google_drive",
      os_id:osId,property_id:propertyId,category,original_name:name,mime_type:mimeType,
      size_bytes:size,sha256:sha||null,provider_folder_id:folderId,uploaded_by:c.user_id,
      status:"pending",attempts:1,created_at:now,updated_at:now
    });
    if(insertionError) {
      if(insertionError.code==="23505")throw new CloudError("Arquivo com o mesmo conteúdo já está em envio nesta OS.",409);
      throw insertionError;
    }
    try{
      const initiate=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,md5Checksum,parents,appProperties",{
        method:"POST",cache:"no-store",
        headers:{
          "Authorization":"Bearer "+token,"Content-Type":"application/json; charset=UTF-8",
          "X-Upload-Content-Type":mimeType,"X-Upload-Content-Length":String(size)
        },
        body:JSON.stringify({
          name:safeCloudName(name),mimeType,parents:[folderId],
          appProperties:{agrodocUploadId:docId,agrodocOwnerId:c.owner_id,agrodocOsId:osId}
        })
      });
      const sessionUrl=initiate.headers.get("location");
      if(!initiate.ok||!sessionUrl||!sessionUrl.startsWith("https://www.googleapis.com/"))
        throw new CloudError("Drive não iniciou sessão retomável ("+initiate.status+").",502);
      const {error:saveError}=await cloudScope(db.from("agrodoc_cloud_files").update({
        upload_session_encrypted:encryptCloud(sessionUrl),updated_at:new Date().toISOString()
      }),c).eq("id",docId);
      if(saveError)throw saveError;
      await cloudEvent(c,"upload_started",docId,{category,bytes:size});
      return NextResponse.json({ok:true,id:docId,status:"pending",sessionUrl});
    }catch(error){
      await cloudScope(db.from("agrodoc_cloud_files").update({
        status:"failed",last_error:"Falha ao iniciar upload resumable",updated_at:new Date().toISOString()
      }),c).eq("id",docId);
      throw error;
    }
  }catch(error){return responseError(error);}
}
