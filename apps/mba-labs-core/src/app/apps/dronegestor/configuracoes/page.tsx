import { requireDroneManagementPage } from "@/lib/dronegestor-page-access";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { AgroDocSettings } from "./AgroDocSettings";
export const dynamic = "force-dynamic";
export default async function Page() {
  const c = await requireDroneManagementPage(
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
