import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function DroneGestorCampoPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/campo");
  redirect("/apps/dronegestor/calculadora");
}
