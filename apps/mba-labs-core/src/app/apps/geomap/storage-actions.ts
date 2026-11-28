"use server";
import {getCurrentUserProfile} from "@/lib/core-data";
import {runDiagnostic,type Diagnostic} from "./r2-diagnostic";
export async function testGeoMapStorage():Promise<Diagnostic>{
 const current=await getCurrentUserProfile("/apps/geomap/armazenamento");
 if(!current.isAdminMaster)return {configured:false,write:false,read:false,remove:false,absent:false,message:"Acesso não autorizado."};
 return runDiagnostic(process.env);
}
