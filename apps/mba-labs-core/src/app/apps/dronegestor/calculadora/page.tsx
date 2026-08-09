import { requireAppAccess } from "@/lib/core-data";
import { QuickCaldaCalculator } from "./QuickCaldaCalculator";

export const dynamic = "force-dynamic";

export default async function DroneGestorCalculadoraPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/calculadora");
  return <QuickCaldaCalculator />;
}
