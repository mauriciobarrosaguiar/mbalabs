import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/core-data";
import { GeoMapDesign } from "./design/GeoMapDesign";
import { listGeoMapProjects } from "./project-store";
export const dynamic = "force-dynamic";
export default async function GeoMapPage() {
 const current=await getCurrentUserProfile("/apps/geomap");
 if(!current.isAdminMaster) redirect("/acesso-bloqueado?app=geomap");
 return <GeoMapDesign data={await listGeoMapProjects()}/>;
}
