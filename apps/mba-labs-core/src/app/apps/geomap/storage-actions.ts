"use server";
import {getCurrentUserProfile} from "@/lib/core-data";
import {runDiagnostic,type Diagnostic} from "./r2-diagnostic";
export async function testGeoMapStorage():Promise<Diagnostic>{
 const current=await getCurrentUserProfile("/apps/geomap/armazenamento");
 if(!current.isAdminMaster)return {configured:false,write:false,read:false,remove:false,absent:false,message:"Acesso não autorizado."};
 return runDiagnostic(process.env);
}

import {testPublicPhoto,type PublicPhotoResult} from "./r2-public-photo";
export async function testGeoMapPublicPhoto():Promise<PublicPhotoResult>{
 const current=await getCurrentUserProfile("/apps/geomap/armazenamento");
 if(!current.isAdminMaster)return {source:false,bytes:0,gps:false,camera:null,write:false,integrity:false,remove:false,absent:false,message:"Acesso não autorizado."};
 return testPublicPhoto(process.env);
}

import {readInventory,type Inventory} from "./r2-inventory";
export async function getGeoMapInventory():Promise<Inventory>{const current=await getCurrentUserProfile("/apps/geomap/armazenamento");if(!current.isAdminMaster)return {ok:false,bytes:0,objects:0,complete:false,message:"Acesso não autorizado."};return readInventory(process.env);}
