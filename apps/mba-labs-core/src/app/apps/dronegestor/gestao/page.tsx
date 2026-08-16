import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { DroneGestaoClientV3 } from "./DroneGestaoClientV3";
import { DroneManagerOperationsPanel } from "./DroneManagerOperationsPanel";
import { DroneOsPilotStep } from "./DroneOsPilotStep";

export const dynamic = "force-dynamic";

export default async function DroneGestorGestaoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/gestao");
  const canManage = canManageDroneGestor({ tipo: current.tipo, isAdminMaster: current.isAdminMaster, permissoes: current.permissoes });
  return <>
    {canManage && <DroneManagerOperationsPanel />}
    <DroneOsPilotStep canManage={canManage} />
    <div id="drone-os-management"><DroneGestaoClientV3 canManage={canManage} /></div>
  </>;
}
