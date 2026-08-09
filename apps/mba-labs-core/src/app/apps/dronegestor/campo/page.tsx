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
    <>
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
        className="fixed bottom-5 left-4 z-40 flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm font-black text-emerald-900 no-underline shadow-xl shadow-emerald-950/15"
      >
        <Calculator size={19}/>
        Calda rápida
      </Link>
    </>
  );
}
