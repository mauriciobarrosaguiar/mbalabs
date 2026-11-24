import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";

/** Server boundary for pages hidden from operational-only profiles. */
export async function requireDroneManagementPage(path: string) {
  const current = await requireAppAccess("dronegestor", path);
  if (current.usuario.status !== "ativo" || !canManageDroneGestor({
    tipo: current.tipo,
    isAdminMaster: current.isAdminMaster,
    permissoes: current.permissoes,
  })) redirect("/apps/dronegestor/gestao");
  return current;
}
