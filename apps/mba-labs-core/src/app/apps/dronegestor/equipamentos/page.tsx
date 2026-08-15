import Link from "next/link";
import { ArrowLeft, Drone } from "lucide-react";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { DroneEquipmentClient } from "./DroneEquipmentClient";

export const dynamic = "force-dynamic";

export default async function DroneEquipmentPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/equipamentos");
  const canManage = canManageDroneGestor({ tipo: current.tipo, isAdminMaster: current.isAdminMaster, permissoes: current.permissoes });

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_40%,#eef2f7_100%)] px-3 py-4 sm:px-6 sm:py-9">
      <div className="mx-auto grid w-full max-w-5xl gap-4 sm:gap-5">
        <header className="rounded-[24px] border border-emerald-200 bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <Link href="/apps/dronegestor" className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 sm:size-11" aria-label="Voltar"><ArrowLeft size={20}/></Link>
            <div className="min-w-0 flex-1">
              <span className="inline-flex max-w-full items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-emerald-700 sm:text-xs"><Drone size={15}/> DroneGestor</span>
              <h1 className="mt-2 max-w-full break-words text-[clamp(1.9rem,8vw,3rem)] font-black leading-[1.02] tracking-[-.04em] text-slate-950">Drones e equipamentos</h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-500 sm:text-sm">Cadastre os dados técnicos uma vez. No campo, o piloto escolhe o drone e o sistema preenche o restante automaticamente.</p>
            </div>
          </div>
        </header>
        <DroneEquipmentClient canManage={canManage}/>
      </div>
    </main>
  );
}
