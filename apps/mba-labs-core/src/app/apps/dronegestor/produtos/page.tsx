import { AgroDocHero } from "../AgroDocUi";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { DroneProductLibraryClient } from "./DroneProductLibraryClient";

export const dynamic = "force-dynamic";

export default async function DroneGestorProductsPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/produtos");
  const canManage = canManageDroneGestor({ tipo: current.tipo, isAdminMaster: current.isAdminMaster, permissoes: current.permissoes });

  return (
    <main className="agro-page-compact min-h-screen bg-slate-50 px-3 py-3 sm:px-6 sm:py-5">
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <AgroDocHero title="Defensivos e AGROFIT" description="Consulte produtos registrados e revisões técnicas da empresa."/>
        <DroneProductLibraryClient canManage={canManage}/>
      </div>
    </main>
  );
}
