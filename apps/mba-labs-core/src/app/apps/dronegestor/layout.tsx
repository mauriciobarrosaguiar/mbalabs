import type { ReactNode } from "react";
import { DroneAppShell } from "./DroneAppShell";

export default function DroneGestorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dronegestor-ui min-h-screen overflow-x-hidden bg-[#f4f8f1] text-slate-950">
      <DroneAppShell>{children}</DroneAppShell>
      <style>{`
        .dronegestor-ui { color-scheme: light; }
        .dronegestor-ui *, .dronegestor-ui *::before, .dronegestor-ui *::after { box-sizing: border-box; }
        .dronegestor-ui main, .dronegestor-ui section, .dronegestor-ui article, .dronegestor-ui div { min-width: 0; }
        .dronegestor-ui img, .dronegestor-ui svg { max-width: 100%; }

        .dronegestor-ui input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .dronegestor-ui select,
        .dronegestor-ui textarea {
          color: #0f172a;
          background-color: #ffffff;
          -webkit-text-fill-color: #0f172a;
          caret-color: #047857;
          max-width: 100%;
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
          .dronegestor-ui button, .dronegestor-ui a { -webkit-tap-highlight-color: transparent; }
          .dronegestor-ui .mobile-hide-scrollbar { scrollbar-width: none; }
          .dronegestor-ui .mobile-hide-scrollbar::-webkit-scrollbar { display: none; }
        }

        @media print {
          .drone-mobile-nav { display: none !important; }
          .dronegestor-ui { background: white !important; }
        }
      `}</style>
    </div>
  );
}
