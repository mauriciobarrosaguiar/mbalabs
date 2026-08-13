import { requireAppAccess } from "@/lib/core-data";
import { DroneHomeDashboard } from "./DroneHomeDashboard";

export const dynamic = "force-dynamic";

function canManageEquipment(tipo: string, isAdminMaster: boolean) {
  const normalized = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
  return isAdminMaster || ["admin_empresa", "responsavel_tecnico", "rt"].includes(normalized);
}

export default async function DroneGestorPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor");
  return <DroneHomeDashboard userName={current.usuario.nome || "Piloto"} canManage={canManageEquipment(current.tipo, current.isAdminMaster)} />;
}
