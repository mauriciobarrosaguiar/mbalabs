import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function DroneGestorHistoricoPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/historico");
  redirect("/apps/dronegestor/calculadora");
}
