import { requireAppAccess } from "@/lib/core-data";
import { DroneSarpasAgriculturalGuard } from "../DroneSarpasAgriculturalGuard";
import { DroneEquipmentPicker } from "./DroneEquipmentPicker";
import { DroneFinishLabelBridge } from "./DroneFinishLabelBridge";
import { DroneGestorAppV3 } from "./DroneGestorAppV3";
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

function canManageDroneStandards(tipo: string, isAdminMaster: boolean) {
  const normalized = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
  return isAdminMaster || ["admin_empresa", "responsavel_tecnico", "rt"].includes(normalized);
}

export default async function DroneGestorCampoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/campo");
  const pilotName = current.usuario.nome || "Piloto";
  const canManage = canManageDroneStandards(current.tipo, current.isAdminMaster);
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
    <DroneGestorAppV3 userName={pilotName} userType={current.tipo} canManage={canManage} />
    <DronePersistenceSync />
    <DroneOsLifecycleSync />
    <DroneWeatherSync />
  </>;
}
