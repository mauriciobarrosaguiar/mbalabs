import { requireAppAccess } from "@/lib/core-data";
import { DroneTeamMode } from "./DroneTeamMode";

export const dynamic = "force-dynamic";

export default async function Page(){
  await requireAppAccess("dronegestor", "/apps/dronegestor/equipe");
  return <DroneTeamMode/>;
}
