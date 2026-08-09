import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function DroneGestorGestaoPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/gestao");
  redirect("/apps/dronegestor/calculadora");
}
