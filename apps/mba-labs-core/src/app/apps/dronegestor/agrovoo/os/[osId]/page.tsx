import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { AgroVooOrderDetails } from "./AgroVooOrderDetails";

export const dynamic = "force-dynamic";

export default async function AgroVooOsPage({
  params,
}: { params: Promise<{ osId: string }> }) {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/agrovoo");
  if (!canManageDroneGestor({
    tipo: current.tipo,
    isAdminMaster: current.isAdminMaster,
    permissoes: current.permissoes,
  })) redirect("/apps/dronegestor/gestao");
  const { osId } = await params;
  if (!osId || osId.length > 120) redirect("/apps/dronegestor/agrovoo");
  return <AgroVooOrderDetails osId={osId} />;
}
