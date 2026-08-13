import { requireAppAccess } from "@/lib/core-data";
import { DroneOperationalProfile } from "./DroneOperationalProfile";

export const dynamic = "force-dynamic";

export default async function DroneOperationalProfilePage(){
  await requireAppAccess("dronegestor","/apps/dronegestor/perfil-operacional");
  return <DroneOperationalProfile/>;
}
