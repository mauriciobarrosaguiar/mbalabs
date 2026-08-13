import { requireAppAccess } from "@/lib/core-data";
import { DroneGestorAppV3 } from "./DroneGestorAppV3";
import { DroneMapEvidence } from "./DroneMapEvidence";
import { DroneMissionContextReset } from "./DroneMissionContextReset";
import { DroneOsLifecycleSync } from "./DroneOsLifecycleSync";
import { DronePersistenceSync } from "./DronePersistenceSync";
import { DroneWeatherSync } from "./DroneWeatherSync";

export const dynamic = "force-dynamic";

function canManageDroneStandards(tipo: string, isAdminMaster: boolean) {
  const normalized = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
  return isAdminMaster || ["admin_empresa", "responsavel_tecnico", "rt"].includes(normalized);
}

export default async function DroneGestorCampoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/campo");
  const pilotName = current.usuario.nome || "Piloto";

  return (
    <>
      <DroneMissionContextReset />
      <DroneGestorAppV3
        userName={pilotName}
        userType={current.tipo}
        canManage={canManageDroneStandards(current.tipo, current.isAdminMaster)}
      />
      <DroneMapEvidence />
      <DronePersistenceSync />
      <DroneOsLifecycleSync />
      <DroneWeatherSync />
    </>
  );
}
