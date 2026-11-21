import { requireAppAccess } from "@/lib/core-data";
import { canAdministerDroneCompany } from "@/lib/dronegestor-company-access";
import { DroneTeamMode } from "./DroneTeamMode";

export const dynamic = "force-dynamic";

export default async function Page(){
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/equipe");
  return <DroneTeamMode canAdministerCompany={canAdministerDroneCompany({tipo:current.tipo,isAdminMaster:current.isAdminMaster,permissoes:current.permissoes})}/>;
}
