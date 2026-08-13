import type { ReactNode } from "react";

export default function DroneGestorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dronegestor-ui min-h-screen text-slate-950">
      {children}
      <style>{`
        .dronegestor-ui {
          color-scheme: light;
        }

        .dronegestor-ui input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),
        .dronegestor-ui select,
        .dronegestor-ui textarea {
          color: #0f172a;
          background-color: #ffffff;
          -webkit-text-fill-color: #0f172a;
          caret-color: #047857;
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

        .dronegestor-ui select option {
          color: #0f172a;
          background: #ffffff;
        }

        .dronegestor-ui input[type="date"] {
          color-scheme: light;
        }
      `}</style>
    </div>
  );
}
