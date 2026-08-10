import type { Metadata } from "next";
import { PwaInstallAndUpdate } from "./PwaInstallAndUpdate";
import { QuickCaldaCalculatorV3 } from "./QuickCaldaCalculatorV3";

export const metadata: Metadata = {
  title: "Calda Fácil | MBA Labs",
  description: "Calculadora simples de calda para preparo por hectare, misturador, vazão e doses de produtos.",
  manifest: "/drone-calculadora.webmanifest",
  icons: {
    icon: "/calda-facil-icon.svg",
    apple: "/calda-facil-icon.svg"
  }
};

export default function DroneGestorCalculadoraPage() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener("beforeinstallprompt", function (event) {
              event.preventDefault();
              window.__caldaInstallPrompt = event;
            });
          `
        }}
      />
      <PwaInstallAndUpdate />
      <QuickCaldaCalculatorV3 />
      <style>{`
        html,
        body,
        input,
        select,
        textarea,
        button {
          color-scheme: light only;
        }

        a[aria-label="Voltar para a MBA Labs"],
        a[href="/apps/dronegestor/campo"],
        a[href="/apps/dronegestor/produtos"] {
          display: none !important;
        }
      `}</style>
    </>
  );
}
