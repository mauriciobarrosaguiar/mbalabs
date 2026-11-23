import { requireDroneManagementPage } from "@/lib/dronegestor-page-access";
import { DronePilotQualifications } from "./DronePilotQualifications";
import { DronePilotsManager } from "./DronePilotsManager";

export const dynamic = "force-dynamic";

export default async function Page(){
  await requireDroneManagementPage( "/apps/dronegestor/pilotos");
  return <>
    <DronePilotQualifications />
    <DronePilotsManager/>
  </>;
}
