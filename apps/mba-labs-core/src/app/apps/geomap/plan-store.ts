import "server-only";
import {getCurrentUserProfile} from "@/lib/core-data";
import {getSupabaseServer} from "@/lib/supabase";
import {makePlan,planSchema} from "./processing-plan";
export type SavedPlan={project_id:string;plan:ReturnType<typeof makePlan>};
export async function listSavedPlans():Promise<{ready:boolean;plans:SavedPlan[]}>{
 const current=await getCurrentUserProfile("/apps/geomap/processamento");
 if(!current.isAdminMaster)return {ready:false,plans:[]};
 const db=await getSupabaseServer();
 const {data,error}=await (db as any).from("geomap_plans").select("project_id,plan").eq("owner_id",current.authUser.id).limit(500);
 if(error)return {ready:false,plans:[]};
 const plans:SavedPlan[]=[];
 for(const row of data??[]){
  const p=row.plan; if(!p||p.projectId!==row.project_id)continue;
  const parsed=planSchema.safeParse({projectId:p.projectId,photos:p.photos,selected:p.selected,config:p.config});
  if(parsed.success)plans.push({project_id:row.project_id,plan:makePlan(parsed.data)});
 }
 return {ready:true,plans};
}
export async function savePlan(input:unknown):Promise<{ok:true}|{ok:false;message:string}>{
 const current=await getCurrentUserProfile("/apps/geomap/processamento");
 if(!current.isAdminMaster)return {ok:false,message:"Acesso não autorizado."};
 const parsed=planSchema.safeParse(input);
 if(!parsed.success||!parsed.data.projectId)return {ok:false,message:"Plano inválido ou sem projeto cadastrado."};
 const plan=makePlan(parsed.data),db=await getSupabaseServer();
 const table=()=> (db as any).from("geomap_plans");
 const {data,error}=await table().select("project_id").eq("project_id",plan.projectId).eq("owner_id",current.authUser.id).maybeSingle();
 if(error)return {ok:false,message:"Banco de planos ainda indisponível."};
 const result=data?await table().update({plan}).eq("project_id",plan.projectId).eq("owner_id",current.authUser.id).select("project_id").single():await table().insert({project_id:plan.projectId,owner_id:current.authUser.id,plan}).select("project_id").single();
 return result.error||!result.data?{ok:false,message:"Não foi possível salvar. Verifique o projeto e a disponibilidade do banco."}:{ok:true};
}
