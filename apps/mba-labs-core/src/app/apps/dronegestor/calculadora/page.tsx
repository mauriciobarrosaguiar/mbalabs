import { requireAppAccess } from "@/lib/core-data";
import { QuickCaldaCalculatorV2 } from "./QuickCaldaCalculatorV2";

export const dynamic = "force-dynamic";

export default async function DroneGestorCalculadoraPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/calculadora");
  return <QuickCaldaCalculatorV2 />;
}