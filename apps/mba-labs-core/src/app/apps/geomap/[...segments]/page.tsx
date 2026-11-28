import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/core-data";
import { GeoMapDesign } from "../design/GeoMapDesign";
import { listGeoMapProjects } from "../project-store";
import { listSavedPlans } from "../plan-store";
export const dynamic="force-dynamic";
export default async function GeoMapSubPage({params}:{params:Promise<{segments:string[]}>}) {
 const {segments}=await params;
 const current=await getCurrentUserProfile("/apps/geomap/"+segments.map(encodeURIComponent).join("/"));
 if(!current.isAdminMaster) redirect("/acesso-bloqueado?app=geomap");
 return <GeoMapDesign segments={segments} data={await listGeoMapProjects()} saved={segments[0]==="processamento"?await listSavedPlans():undefined}/>;
}
