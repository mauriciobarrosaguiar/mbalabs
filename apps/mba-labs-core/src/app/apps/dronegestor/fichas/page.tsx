import { requireAppAccess } from "@/lib/core-data";
import { DroneOperationSheetsClient } from "./DroneOperationSheetsClient";

export const dynamic = "force-dynamic";

function companyHistory(tipo: string, empresaId: string | null) {
  const normalized = tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
  return Boolean(empresaId) && ["admin_empresa", "responsavel_tecnico", "rt", "super_admin", "admin_master"].includes(normalized);
}

export default async function DroneGestorOperationSheetsPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/fichas");
  return <DroneOperationSheetsClient userName={current.usuario.nome || "Piloto"} companyMode={companyHistory(current.usuario.tipo, current.empresaId)}/>;
}
