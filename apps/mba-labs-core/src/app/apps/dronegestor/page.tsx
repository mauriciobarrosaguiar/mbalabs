import Link from "next/link";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { DroneHomeDashboard } from "./DroneHomeDashboard";

export const dynamic = "force-dynamic";

export default async function DroneGestorPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor");
  const canManage = canManageDroneGestor({
    tipo: current.tipo,
    isAdminMaster: current.isAdminMaster,
    permissoes: current.permissoes,
  });
  return <>
    {canManage && <div className="mx-auto mt-4 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:mt-6">
      <div>
        <strong className="block text-sm font-black text-emerald-950">Nova experiência AgroVoo Gestão</strong>
        <p className="mt-1 text-xs text-emerald-900">Prévia da Fase 2: painel simplificado e criação guiada de OS. O fluxo anterior continua disponível.</p>
      </div>
      <Link href="/apps/dronegestor/agrovoo" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white no-underline">Abrir prévia AgroVoo</Link>
    </div>}
    <DroneHomeDashboard userName={current.usuario.nome || "Piloto"} canManage={canManage} />
  </>;
}
