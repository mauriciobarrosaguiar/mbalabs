import "server-only";
import { getCurrentUserProfile } from "@/lib/core-data";
import { getSupabaseServer } from "@/lib/supabase";
import { projectInputSchema, type RealProject, type ProjectList } from "./project-model";
const fields="id,name,client,property,city,uf,operator,rt,date,purpose,drone,status,created_at";
export async function listGeoMapProjects():Promise<ProjectList>{
 const current=await getCurrentUserProfile("/apps/geomap");
 if(!current.isAdminMaster) return {ready:false,projects:[]};
 const db=await getSupabaseServer();
 const {data,error}=await (db as any).from("geomap_projects").select(fields).eq("owner_id",current.authUser.id).order("created_at",{ascending:false}).limit(500);
 if(error)return {ready:false,projects:[]};
 return {ready:true,projects:(data??[]) as RealProject[]};
}
export async function insertGeoMapProject(input:unknown):Promise<{ok:true;id:string}|{ok:false;message:string}>{
 const current=await getCurrentUserProfile("/apps/geomap/novo-projeto");
 if(!current.isAdminMaster)return {ok:false,message:"Acesso não autorizado."};
 const parsed=projectInputSchema.safeParse(input);
 if(!parsed.success)return {ok:false,message:"Confira os campos obrigatórios e os formatos."};
 const db=await getSupabaseServer();
 const {data,error}=await (db as any).from("geomap_projects").insert({...parsed.data,owner_id:current.authUser.id}).select("id").single();
 if(error||!data)return {ok:false,message:"Não foi possível salvar. O armazenamento de projetos pode ainda não estar habilitado."};
 return {ok:true,id:data.id};
}
