import Link from "next/link";
import { ArrowLeft, Drone } from "lucide-react";
import { requireAppAccess } from "@/lib/core-data";
import { DroneEquipmentClient } from "./DroneEquipmentClient";

export const dynamic = "force-dynamic";

function canManageEquipment(tipo: string, isAdminMaster: boolean) {
  const normalized = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
  return isAdminMaster || ["admin_empresa", "responsavel_tecnico", "rt"].includes(normalized);
}

export default async function DroneEquipmentPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/equipamentos");
  const canManage = canManageEquipment(current.tipo, current.isAdminMaster);

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_40%,#eef2f7_100%)] px-4 py-6 sm:px-6 sm:py-9">
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <header className="rounded-[28px] border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <Link href="/apps/dronegestor" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700" aria-label="Voltar"><ArrowLeft size={20}/></Link>
            <div className="min-w-0 flex-1"><span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-emerald-700"><Drone size={15}/> DroneGestor</span><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Drones e equipamentos</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Cadastre os dados técnicos uma vez. No campo, o piloto escolhe o drone e o sistema preenche o restante automaticamente.</p></div>
          </div>
        </header>
        <DroneEquipmentClient canManage={canManage}/>
      </div>
    </main>
  );
}
