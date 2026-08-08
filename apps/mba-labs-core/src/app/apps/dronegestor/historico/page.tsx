import { requireAppAccess } from "@/lib/core-data";
import { DroneHistoricoClient } from "./DroneHistoricoClient";

export const dynamic = "force-dynamic";

export default async function DroneGestorHistoricoPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/historico");

  return (
    <DroneHistoricoClient
      userName={current.usuario.nome || "Piloto"}
      companyMode={["admin_empresa", "super_admin", "admin_master"].includes(current.usuario.tipo) && Boolean(current.empresaId)}
    />
  );
}
