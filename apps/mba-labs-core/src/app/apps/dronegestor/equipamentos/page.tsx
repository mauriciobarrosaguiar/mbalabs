import { AgroDocHero } from "../AgroDocUi";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { DroneEquipmentClient } from "./DroneEquipmentClient";

export const dynamic = "force-dynamic";

export default async function DroneEquipmentPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/equipamentos");
  const canManage = canManageDroneGestor({ tipo: current.tipo, isAdminMaster: current.isAdminMaster, permissoes: current.permissoes });

  return (
    <main className="agro-page-compact min-h-screen bg-slate-50 px-3 py-3 sm:px-6 sm:py-5">
      <div className="mx-auto grid w-full max-w-5xl gap-4 sm:gap-5">
        <AgroDocHero title="Drones e equipamentos" description="Cadastre e reutilize os dados técnicos dos seus equipamentos."/>
        <DroneEquipmentClient canManage={canManage}/>
      </div>
    </main>
  );
}
