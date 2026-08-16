import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { DroneHistoricoClientV2 } from "./DroneHistoricoClientV2";
import { DroneHistoryPackageLinks } from "./DroneHistoryPackageLinks";

export const dynamic = "force-dynamic";

export default async function DroneGestorHistoricoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/historico");
  return <><DroneHistoryPackageLinks/><DroneHistoricoClientV2 userName={current.usuario.nome || "Piloto"} companyMode={Boolean(current.empresaId) && canManageDroneGestor({ tipo: current.tipo, isAdminMaster: current.isAdminMaster, permissoes: current.permissoes })}/></>;
}
