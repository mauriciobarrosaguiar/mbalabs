import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/core-data";
import { DroneSystemAdministration } from "./DroneSystemAdministration";
export const dynamic = "force-dynamic";
export default async function Page() {
  const current = await getCurrentUserProfile("/apps/dronegestor/administracao");
  if (!current.isAdminMaster || current.usuario.status !== "ativo") redirect("/apps/dronegestor");
  return <DroneSystemAdministration/>;
}
