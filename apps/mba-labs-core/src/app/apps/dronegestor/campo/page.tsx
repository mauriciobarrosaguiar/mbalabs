import Link from "next/link";
import { Calculator } from "lucide-react";
import { requireAppAccess } from "@/lib/core-data";
import { DroneGestorAppV3 } from "./DroneGestorAppV3";
import { DroneMissionContextReset } from "./DroneMissionContextReset";
import { DroneOsLifecycleSync } from "./DroneOsLifecycleSync";
import { DronePersistenceSync } from "./DronePersistenceSync";
import { DroneWeatherSync } from "./DroneWeatherSync";

export const dynamic = "force-dynamic";

function canManageDroneStandards(tipo: string, isAdminMaster: boolean) {
  const normalized = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
  return isAdminMaster || ["admin_empresa", "responsavel_tecnico", "rt"].includes(normalized);
}

export default async function DroneGestorCampoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/campo");
  const pilotName = current.usuario.nome || "Piloto";

  return (
    <div className="dronegestor-mobile-shell">
      <DroneMissionContextReset />
      <DroneGestorAppV3
        userName={pilotName}
        userType={current.tipo}
        canManage={canManageDroneStandards(current.tipo, current.isAdminMaster)}
      />
      <DronePersistenceSync />
      <DroneOsLifecycleSync />
      <DroneWeatherSync />
      <Link
        href="/apps/dronegestor/calculadora"
        className="fixed bottom-[92px] left-3 z-30 flex min-h-11 items-center gap-2 rounded-2xl border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-900 no-underline shadow-lg shadow-emerald-950/15 sm:bottom-5 sm:left-5 sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm"
      >
        <Calculator size={18}/>
        Calda rápida
      </Link>
      <style>{`
        .dronegestor-mobile-shell {
          -webkit-text-size-adjust: 100%;
          text-size-adjust: 100%;
        }
        .dronegestor-mobile-shell input,
        .dronegestor-mobile-shell select,
        .dronegestor-mobile-shell textarea {
          font-size: 16px;
        }
        .dronegestor-mobile-shell label {
          color: #334155;
        }
        .dronegestor-mobile-shell label strong {
          color: #0f172a;
        }
        @media (max-width: 639px) {
          .dronegestor-mobile-shell .pb-24 {
            padding-bottom: 9.5rem !important;
          }
          .dronegestor-mobile-shell nav {
            padding-bottom: max(.55rem, env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </div>
  );
}
