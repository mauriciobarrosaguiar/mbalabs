import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function DroneGestorPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor");
  redirect("/apps/dronegestor/calculadora");
}
