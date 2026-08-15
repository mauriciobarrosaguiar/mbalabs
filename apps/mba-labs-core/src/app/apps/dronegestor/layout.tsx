import type { ReactNode } from "react";
import { getSessionProfile } from "@/lib/core-data";
import { DroneActiveOperationBridge } from "./DroneActiveOperationBridge";
import { DroneAppShell } from "./DroneAppShell";

export default async function DroneGestorLayout({ children }: { children: ReactNode }) {
  const session = await getSessionProfile();
  const deviceOwner = session.profile ? `${session.profile.empresa_id || "solo"}:${session.profile.id}` : "sessao-sem-perfil";
  return (
    <div className="dronegestor-ui min-h-screen overflow-x-hidden bg-[#f4f8f1] text-slate-950">
      <DroneActiveOperationBridge deviceOwner={deviceOwner} />
      <DroneAppShell>{children}</DroneAppShell>
      <style>{`
        .dronegestor-ui {
          width: 100%;
          max-width: 100vw;
          color-scheme: light;
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
          overflow-x: clip;
        }
        .dronegestor-ui *, .dronegestor-ui *::before, .dronegestor-ui *::after { box-sizing: border-box; }
        .dronegestor-ui main, .dronegestor-ui section, .dronegestor-ui article, .dronegestor-ui header, .dronegestor-ui footer, .dronegestor-ui nav, .dronegestor-ui div { min-width: 0; max-width: 100%; }
        .dronegestor-ui img, .dronegestor-ui svg, .dronegestor-ui video, .dronegestor-ui canvas { max-width: 100%; height: auto; }
        .dronegestor-ui h1, .dronegestor-ui h2, .dronegestor-ui h3 {
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: normal;
        }
        .dronegestor-ui p, .dronegestor-ui label, .dronegestor-ui strong, .dronegestor-ui span { overflow-wrap: break-word; }
        .dronegestor-ui button, .dronegestor-ui a { min-width: 0; max-width: 100%; white-space: normal; }
        .dronegestor-ui .overflow-x-auto { max-width: 100%; }

        .dronegestor-ui input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .dronegestor-ui select,
        .dronegestor-ui textarea {
          width: 100%;
          min-width: 0;
          color: #0f172a;
          background-color: #ffffff;
          -webkit-text-fill-color: #0f172a;
          caret-color: #047857;
          max-width: 100%;
        }

        .dronegestor-ui input[type="file"] {
          width: 100%;
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
            font-size: clamp(1.65rem, 7.8vw, 2.25rem) !important;
            line-height: 1.05 !important;
            letter-spacing: -0.035em;
          }
          .dronegestor-ui h2 { line-height: 1.12; }

          .dronegestor-ui main { padding-left: .75rem !important; padding-right: .75rem !important; }
          .dronegestor-ui header .flex.gap-2 { flex-wrap: wrap; }
          .dronegestor-ui .flex.items-center.justify-between,
          .dronegestor-ui .flex.items-start.justify-between { column-gap: .65rem; }
          .dronegestor-ui button, .dronegestor-ui a { -webkit-tap-highlight-color: transparent; }
          .dronegestor-ui .mobile-hide-scrollbar { scrollbar-width: none; }
          .dronegestor-ui .mobile-hide-scrollbar::-webkit-scrollbar { display: none; }

          /* Campo: textos de orientação ficam legíveis sob sol sem aumentar os controles compactos. */
          .dronegestor-ui .drone-field-flow small { font-size: .8rem !important; line-height: 1.2rem !important; }
          .dronegestor-ui .drone-field-flow p[class*="text-[11px]"] { font-size: .78rem !important; line-height: 1.15rem !important; }
          .dronegestor-ui .drone-field-flow p[class*="text-xs"] { line-height: 1.2rem; }

          .dronegestor-ui [class*="grid-cols-2"]:not(.drone-mobile-nav) { grid-template-columns: minmax(0, 1fr) !important; }
          .dronegestor-ui [class*="sm:grid-cols-2"] { grid-template-columns: minmax(0, 1fr); }

          /* Gestão: somente o grupo direto de quatro abas administrativas vira grade 2x2. */
          .dronegestor-ui main > div > div.flex.gap-2.overflow-x-auto:has(> button:nth-child(4)):not(:has(> button:nth-child(5))) {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
            overflow: visible;
          }
          .dronegestor-ui main > div > div.flex.gap-2.overflow-x-auto:has(> button:nth-child(4)):not(:has(> button:nth-child(5))) > button {
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

          /* Ações largas e modais nunca podem ultrapassar a largura útil do celular. */
          .dronegestor-ui [class*="fixed"][class*="inset-0"] > section,
          .dronegestor-ui [role="dialog"] {
            width: calc(100vw - 1rem) !important;
            max-width: calc(100vw - 1rem) !important;
          }
          .dronegestor-ui .drone-mobile-stack { grid-template-columns: minmax(0,1fr) !important; }
          .dronegestor-ui .drone-mobile-actions { display: grid !important; grid-template-columns: minmax(0,1fr) !important; width: 100%; }
          .dronegestor-ui .drone-mobile-actions > * { width: 100%; justify-content: center; }

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
          .dronegestor-ui h1 { font-size: clamp(1.55rem, 7.8vw, 1.95rem) !important; }
          .dronegestor-ui main > div > div.flex.gap-2.overflow-x-auto:has(> button:nth-child(4)):not(:has(> button:nth-child(5))) > button { font-size: .9rem; }
        }

        @media print {
          .drone-mobile-nav { display: none !important; }
          .dronegestor-ui { background: white !important; }
        }
      `}</style>
    </div>
  );
}
