import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import { canAdministerDroneCompany } from "@/lib/dronegestor-company-access";
import { DroneCompanyEmployees } from "./DroneCompanyEmployees";
export const dynamic = "force-dynamic";
export default async function Page() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/funcionarios");
  if (current.usuario.status !== "ativo" || !canAdministerDroneCompany({tipo:current.tipo,isAdminMaster:current.isAdminMaster,permissoes:current.permissoes})) redirect("/apps/dronegestor");
  return <DroneCompanyEmployees/>;
}
