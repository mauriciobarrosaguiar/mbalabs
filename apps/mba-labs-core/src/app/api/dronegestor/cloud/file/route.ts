import { NextRequest, NextResponse } from "next/server";
import { cloudContext, cloudDb, cloudScope, CloudError, driveCall, googleAccessToken } from "@/lib/agrodoc-cloud";
import { requireDroneOsAccess,droneOsErrorResponse } from "@/lib/dronegestor-os-access";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:NextRequest){
  try{
    const c=await cloudContext();
    const id=String(request.nextUrl.searchParams.get("id")||"");
    const {data,error}=await cloudScope(cloudDb().from("agrodoc_cloud_files")
      .select("id,os_id,provider_file_id,original_name,mime_type,size_bytes,status"),c).eq("id",id).maybeSingle();
    if(error)throw error;
    if(!data||data.status!=="synced"||!data.provider_file_id)throw new CloudError("Arquivo não encontrado.",404);
    await requireDroneOsAccess(cloudDb(),{
      userId:c.user_id,empresaId:c.owner_type==="empresa"?c.owner_id:null,canManage:c.can_manage
    },String(data.os_id));
    const {token}=await googleAccessToken(c);
    const file=await driveCall(token,"files/"+encodeURIComponent(data.provider_file_id)+"?alt=media");
    return new NextResponse(file.body,{
      headers:{
        "Content-Type":data.mime_type,
        "Content-Disposition":"attachment; filename*=UTF-8''"+encodeURIComponent(String(data.original_name)),
        "Cache-Control":"private, no-store",
        "X-Content-Type-Options":"nosniff"
      }
    });
  }catch(error){
    const os=droneOsErrorResponse(error);
    return NextResponse.json({ok:false,error:os?.message||(error instanceof Error?error.message:"Falha no download.")},
      {status:os?.status||(error instanceof CloudError?error.status:500)});
  }
}
