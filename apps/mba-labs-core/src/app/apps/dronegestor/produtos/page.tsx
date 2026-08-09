import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function DroneGestorProductsPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/produtos");
  redirect("/apps/dronegestor/calculadora");
}
