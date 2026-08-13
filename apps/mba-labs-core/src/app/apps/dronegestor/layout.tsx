import type { ReactNode } from "react";
import { DroneAppShell } from "./DroneAppShell";

export default function DroneGestorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dronegestor-ui min-h-screen overflow-x-hidden bg-[#f4f8f1] text-slate-950">
      <DroneAppShell>{children}</DroneAppShell>
      <style>{`
        .dronegestor-ui {
          color-scheme: light;
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
          overflow-x: clip;
        }
        .dronegestor-ui *, .dronegestor-ui *::before, .dronegestor-ui *::after { box-sizing: border-box; }
        .dronegestor-ui main, .dronegestor-ui section, .dronegestor-ui article, .dronegestor-ui div { min-width: 0; }
        .dronegestor-ui img, .dronegestor-ui svg { max-width: 100%; }
        .dronegestor-ui h1, .dronegestor-ui h2, .dronegestor-ui h3 {
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: normal;
        }
        .dronegestor-ui p, .dronegestor-ui label, .dronegestor-ui strong { overflow-wrap: break-word; }
        .dronegestor-ui button, .dronegestor-ui a { min-width: 0; max-width: 100%; }

        .dronegestor-ui input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .dronegestor-ui select,
        .dronegestor-ui textarea {
          color: #0f172a;
          background-color: #ffffff;
          -webkit-text-fill-color: #0f172a;
          caret-color: #047857;
          max-width: 100%;
        }

        .dronegestor-ui input[type="file"] {
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .dronegestor-ui input:not([type="checkbox"]):not([type="radio"]):not([type="file"])::placeholder,
        .dronegestor-ui textarea::placeholder {
          color: #94a3b8;
          -webkit-text-fill-color: #94a3b8;
          opacity: 1;
        }

        .dronegestor-ui input:disabled,
        .dronegestor-ui select:disabled,
        .dronegestor-ui textarea:disabled {
          color: #475569;
          background-color: #f1f5f9;
          -webkit-text-fill-color: #475569;
          opacity: 1;
        }

        .dronegestor-ui select option { color: #0f172a; background: #ffffff; }
        .dronegestor-ui input[type="date"], .dronegestor-ui input[type="month"] { color-scheme: light; }
        .dronegestor-ui table { max-width: 100%; }

        @media (max-width: 640px) {
          .dronegestor-ui input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
          .dronegestor-ui select,
          .dronegestor-ui textarea { font-size: 16px; }

          .dronegestor-ui h1 {
            font-size: clamp(1.8rem, 8.5vw, 2.35rem) !important;
            line-height: 1.02 !important;
            letter-spacing: -0.035em;
          }

          .dronegestor-ui header .flex.gap-2 { flex-wrap: wrap; }
          .dronegestor-ui button, .dronegestor-ui a { -webkit-tap-highlight-color: transparent; }
          .dronegestor-ui .mobile-hide-scrollbar { scrollbar-width: none; }
          .dronegestor-ui .mobile-hide-scrollbar::-webkit-scrollbar { display: none; }

          /* Gestão: no celular as quatro seções viram uma grade 2x2, sem aba escondida para a direita. */
          .dronegestor-ui .flex.gap-2.overflow-x-auto:has(> button) {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
            overflow: visible;
          }
          .dronegestor-ui .flex.gap-2.overflow-x-auto:has(> button) > button {
            width: 100%;
            min-width: 0;
            min-height: 3.5rem;
            white-space: normal;
            line-height: 1.15;
            padding-inline: .7rem;
          }

          /* Campo: pares dose/unidade deixam de comprimir controles em telas estreitas. */
          .dronegestor-ui [class*="grid-cols-[1fr_140px]"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .dronegestor-ui [class*="grid-cols-[minmax(0,1fr)_minmax(132px,0.88fr)]"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .dronegestor-ui button[aria-label="Registrar mapa usado no voo"] {
            left: 1rem !important;
            right: auto !important;
            bottom: calc(5.75rem + env(safe-area-inset-bottom)) !important;
            width: 3.25rem !important;
            height: 3.25rem !important;
            min-height: 3.25rem !important;
            padding: 0 !important;
            justify-content: center !important;
            border-radius: 999px !important;
            background: #087a55 !important;
            color: white !important;
            border-color: #d2efde !important;
          }
          .dronegestor-ui button[aria-label="Registrar mapa usado no voo"] > span { display: none !important; }
        }

        @media (max-width: 380px) {
          .dronegestor-ui h1 { font-size: clamp(1.65rem, 8.2vw, 2rem) !important; }
          .dronegestor-ui .flex.gap-2.overflow-x-auto:has(> button) > button { font-size: .9rem; }
        }

        @media print {
          .drone-mobile-nav { display: none !important; }
          .dronegestor-ui { background: white !important; }
        }
      `}</style>
    </div>
  );
}
