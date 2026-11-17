import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { AgroDocSettings } from "./AgroDocSettings";
export const dynamic = "force-dynamic";
export default async function Page() {
  const c = await requireAppAccess(
    "dronegestor",
    "/apps/dronegestor/configuracoes",
  );
  return (
    <AgroDocSettings
      canManage={canManageDroneGestor({
        tipo: c.tipo,
        isAdminMaster: c.isAdminMaster,
        permissoes: c.permissoes,
      })}
    />
  );
}
