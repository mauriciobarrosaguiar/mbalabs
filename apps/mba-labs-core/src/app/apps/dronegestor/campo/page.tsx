import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor, droneGestorRole } from "@/lib/dronegestor-role";
import { DroneSarpasAgriculturalGuard } from "../DroneSarpasAgriculturalGuard";
import { DroneEquipmentPicker } from "./DroneEquipmentPicker";
import { DroneFinishLabelBridge } from "./DroneFinishLabelBridge";
import { DroneGestorAppV3 } from "./DroneGestorAppV3";
import { DroneGuidedFieldMode } from "./DroneGuidedFieldMode";
import { DroneLegacyStepHider } from "./DroneLegacyStepHider";
import { DroneMissionContextReset } from "./DroneMissionContextReset";
import { DroneMissionGateHint } from "./DroneMissionGateHint";
import { DroneMixerCalculator } from "./DroneMixerCalculator";
import { DroneOperationNextStep } from "./DroneOperationNextStep";
import { DroneOsLifecycleSync } from "./DroneOsLifecycleSync";
import { DronePersistenceSync } from "./DronePersistenceSync";
import { DronePilotPermissionBridge } from "./DronePilotPermissionBridge";
import { DroneProductMissionPicker } from "./DroneProductMissionPicker";
import { DroneRegulatoryGuard } from "./DroneRegulatoryGuard";
import { DroneSarpasStateBridge } from "./DroneSarpasStateBridge";
import { DroneSimpleFlowUX } from "./DroneSimpleFlowUX";
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
    <DroneSimpleFlowUX />
    <DroneOperationNextStep />
    <DroneLegacyStepHider />
    <DroneMissionGateHint />
    <DroneRegulatoryGuard canManage={canManage} />
    <DroneProductMissionPicker />
    <DroneSarpasStateBridge />
    <DronePilotPermissionBridge currentUserId={current.usuario.id} canManage={canManage} />
    <DroneMixerCalculator />
    <DroneFinishLabelBridge />
    <DroneGestorAppV3 userName={pilotName} userType={userType} canManage={canManage} />
    <DroneGuidedFieldMode pilotName={pilotName} />
    <DronePersistenceSync />
    <DroneOsLifecycleSync />
    <DroneWeatherSync />
  </>;
}
