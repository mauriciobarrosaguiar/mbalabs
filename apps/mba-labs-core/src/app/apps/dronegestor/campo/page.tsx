import { requireAppAccess } from "@/lib/core-data";
import { DroneGestorApp } from "./DroneGestorApp";
import { DroneOperationRecorder } from "./DroneOperationRecorder";
import { DronePersistenceSync } from "./DronePersistenceSync";
import { DroneWeatherSync } from "./DroneWeatherSync";

export const dynamic = "force-dynamic";

export default async function DroneGestorCampoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/campo");
  const pilotName = current.usuario.nome || "Piloto";

  return (
    <>
      <DroneGestorApp userName={pilotName} />
      <DronePersistenceSync />
      <DroneWeatherSync />
      <DroneOperationRecorder pilotName={pilotName} />
    </>
  );
}
