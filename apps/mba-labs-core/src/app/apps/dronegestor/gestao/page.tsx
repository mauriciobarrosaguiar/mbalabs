import { requireAppAccess } from "@/lib/core-data";
import { DroneGestaoClient } from "./DroneGestaoClient";

export const dynamic = "force-dynamic";

export default async function DroneGestorGestaoPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/gestao");
  return <DroneGestaoClient />;
}
