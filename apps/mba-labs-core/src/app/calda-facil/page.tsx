import type { Metadata } from "next";
import { QuickCaldaCalculatorV3 } from "../apps/dronegestor/calculadora/QuickCaldaCalculatorV3";

export const metadata: Metadata = {
  title: "Calda Fácil",
  description: "Calculadora de calda simples e pública da MBA Labs."
};

export default function CaldaFacilPublicPage() {
  return (
    <>
      <QuickCaldaCalculatorV3 />
      <style>{`
        a[aria-label="Voltar para a MBA Labs"] {
          display: none !important;
        }
      `}</style>
    </>
  );
}
