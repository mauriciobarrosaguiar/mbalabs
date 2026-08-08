import { requireAppAccess } from "@/lib/core-data";
import { DroneGestorApp } from "./DroneGestorApp";
import { DroneWeatherSync } from "./DroneWeatherSync";

export const dynamic = "force-dynamic";

export default async function DroneGestorCampoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/campo");

  return (
    <>
      <DroneGestorApp userName={current.usuario.nome || "Piloto"} />
      <DroneWeatherSync />
    </>
  );
}
