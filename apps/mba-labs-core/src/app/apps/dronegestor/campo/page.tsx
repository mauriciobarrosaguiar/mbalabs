import { requireAppAccess } from "@/lib/core-data";
import { DroneGestorApp } from "./DroneGestorApp";
import { DroneMissionContextReset } from "./DroneMissionContextReset";
import { DroneOperationRecorder } from "./DroneOperationRecorder";
import { DronePersistenceSync } from "./DronePersistenceSync";
import { DroneWeatherSync } from "./DroneWeatherSync";

export const dynamic = "force-dynamic";

export default async function DroneGestorCampoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/campo");
  const pilotName = current.usuario.nome || "Piloto";

  return (
    <>
      <DroneMissionContextReset />
      <DroneGestorApp userName={pilotName} />
      <DronePersistenceSync />
      <DroneWeatherSync />
      <DroneOperationRecorder pilotName={pilotName} />
    </>
  );
}
