import { requireDroneManagementPage } from "@/lib/dronegestor-page-access";
import { canAdministerDroneCompany } from "@/lib/dronegestor-company-access";
import { DroneTeamMode } from "./DroneTeamMode";

export const dynamic = "force-dynamic";

export default async function Page(){
  const current = await requireDroneManagementPage( "/apps/dronegestor/equipe");
  return <DroneTeamMode canAdministerCompany={canAdministerDroneCompany({tipo:current.tipo,isAdminMaster:current.isAdminMaster,permissoes:current.permissoes})}/>;
}
