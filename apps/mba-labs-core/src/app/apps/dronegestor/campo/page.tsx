import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor, droneGestorRole } from "@/lib/dronegestor-role";
import { DroneSarpasAgriculturalGuard } from "../DroneSarpasAgriculturalGuard";
import { DroneEquipmentPicker } from "./DroneEquipmentPicker";
import { DroneFinishLabelBridge } from "./DroneFinishLabelBridge";
import { DroneGestorAppV3 } from "./DroneGestorAppV3";
import { DroneGuidedFieldMode } from "./DroneGuidedFieldMode";
import { DroneMissionContextReset } from "./DroneMissionContextReset";
import { DroneMixerCalculator } from "./DroneMixerCalculator";
import { DroneOsLifecycleSync } from "./DroneOsLifecycleSync";
import { DronePersistenceSync } from "./DronePersistenceSync";
import { DronePilotPermissionBridge } from "./DronePilotPermissionBridge";
import { DroneRegulatoryGuard } from "./DroneRegulatoryGuard";
import { DroneSarpasStateBridge } from "./DroneSarpasStateBridge";
import { DroneWeatherSync } from "./DroneWeatherSync";

export const dynamic = "force-dynamic";

export default async function DroneGestorCampoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/campo");
  const pilotName = current.usuario.nome || "Piloto";
  const roleInput = { tipo: current.tipo, isAdminMaster: current.isAdminMaster, permissoes: current.permissoes };
  const canManage = canManageDroneGestor(roleInput);
  const userType = droneGestorRole(roleInput);
  return <>
    <DroneMissionContextReset />
    <DroneSarpasAgriculturalGuard />
    <DroneEquipmentPicker canManage={canManage} />
    <DroneRegulatoryGuard canManage={canManage} />
    <DroneSarpasStateBridge />
    <DronePilotPermissionBridge currentUserId={current.usuario.id} canManage={canManage} />
    <DroneMixerCalculator />
    <DroneFinishLabelBridge />
    <DroneGestorAppV3 currentUserId={current.usuario.id} userName={pilotName} userType={userType} canManage={canManage} />
    <DroneGuidedFieldMode pilotName={pilotName} />
    <DronePersistenceSync />
    <DroneOsLifecycleSync />
    <DroneWeatherSync />
  </>;
}
