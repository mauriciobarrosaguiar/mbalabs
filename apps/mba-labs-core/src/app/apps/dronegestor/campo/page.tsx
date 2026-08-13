import { requireAppAccess } from "@/lib/core-data";
import { DroneEquipmentPicker } from "./DroneEquipmentPicker";
import { DroneGestorAppV3 } from "./DroneGestorAppV3";
import { DroneMissionContextReset } from "./DroneMissionContextReset";
import { DroneOsLifecycleSync } from "./DroneOsLifecycleSync";
import { DronePersistenceSync } from "./DronePersistenceSync";
import { DroneProductMissionPicker } from "./DroneProductMissionPicker";
import { DroneRegulatoryGuard } from "./DroneRegulatoryGuard";
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

  return (
    <>
      <DroneMissionContextReset />
      <DroneEquipmentPicker canManage={canManage} />
      <DroneSimpleFlowUX />
      <DroneRegulatoryGuard />
      <DroneProductMissionPicker />
      <DroneGestorAppV3
        userName={pilotName}
        userType={current.tipo}
        canManage={canManage}
      />
      <DronePersistenceSync />
      <DroneOsLifecycleSync />
      <DroneWeatherSync />
    </>
  );
}
