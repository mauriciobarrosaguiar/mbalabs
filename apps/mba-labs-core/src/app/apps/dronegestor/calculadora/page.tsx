import { requireAppAccess } from "@/lib/core-data";
import { QuickCaldaCalculatorV3 } from "./QuickCaldaCalculatorV3";

export const dynamic = "force-dynamic";

export default async function DroneGestorCalculadoraPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/calculadora");
  return (
    <>
      <QuickCaldaCalculatorV3 />
      <style>{`
        a[href="/apps/dronegestor/campo"],
        a[href="/apps/dronegestor/produtos"] {
          display: none !important;
        }
      `}</style>
    </>
  );
}
