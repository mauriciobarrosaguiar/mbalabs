import { requireAppAccess } from "@/lib/core-data";
import { DronePilotsManager } from "./DronePilotsManager";

export const dynamic = "force-dynamic";

export default async function Page(){
  await requireAppAccess("dronegestor", "/apps/dronegestor/pilotos");
  return <DronePilotsManager/>;
}
