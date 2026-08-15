import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { DroneOperationSheetsClient } from "./DroneOperationSheetsClient";

export const dynamic = "force-dynamic";

export default async function DroneGestorOperationSheetsPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/fichas");
  return <DroneOperationSheetsClient userName={current.usuario.nome || "Piloto"} companyMode={Boolean(current.empresaId) && canManageDroneGestor({ tipo: current.tipo, isAdminMaster: current.isAdminMaster, permissoes: current.permissoes })}/>;
}
