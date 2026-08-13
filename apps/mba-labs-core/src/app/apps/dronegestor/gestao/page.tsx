import { requireAppAccess } from "@/lib/core-data";
import { DroneGestaoClientV3 } from "./DroneGestaoClientV3";

export const dynamic = "force-dynamic";

function canManageDrone(tipo: string, isAdminMaster: boolean) {
  const normalized = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
  return isAdminMaster || ["admin_empresa", "responsavel_tecnico", "rt"].includes(normalized);
}

export default async function DroneGestorGestaoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/gestao");
  return <DroneGestaoClientV3 canManage={canManageDrone(current.tipo, current.isAdminMaster)} />;
}
