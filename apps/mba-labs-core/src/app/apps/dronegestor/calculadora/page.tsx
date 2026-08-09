import type { Metadata } from "next";
import { QuickCaldaCalculatorV3 } from "./QuickCaldaCalculatorV3";

export const metadata: Metadata = {
  title: "Calda Fácil | MBA Labs",
  description: "Calculadora simples de calda para preparo por hectare, misturador, vazão e doses de produtos."
};

export default function DroneGestorCalculadoraPage() {
  return (
    <>
      <QuickCaldaCalculatorV3 />
      <style>{`
        a[aria-label="Voltar para a MBA Labs"],
        a[href="/apps/dronegestor/campo"],
        a[href="/apps/dronegestor/produtos"] {
          display: none !important;
        }
      `}</style>
    </>
  );
}
