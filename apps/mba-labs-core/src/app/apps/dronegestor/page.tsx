import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { DroneHomeDashboard } from "./DroneHomeDashboard";

export const dynamic = "force-dynamic";

export default async function DroneGestorPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor");
  return <DroneHomeDashboard userName={current.usuario.nome || "Piloto"} canManage={canManageDroneGestor({ tipo: current.tipo, isAdminMaster: current.isAdminMaster, permissoes: current.permissoes })} />;
}
