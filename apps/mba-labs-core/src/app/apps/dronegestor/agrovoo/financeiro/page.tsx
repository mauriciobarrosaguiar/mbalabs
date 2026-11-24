import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import { canAdministerDroneCompany } from "@/lib/dronegestor-company-access";
import { AgroVooFinanceClient } from "./AgroVooFinanceClient";
export const dynamic="force-dynamic";
export default async function Page(){
  const current=await requireAppAccess("dronegestor","/apps/dronegestor/agrovoo/financeiro");
  if(!canAdministerDroneCompany({tipo:current.tipo,isAdminMaster:current.isAdminMaster,permissoes:current.permissoes}))redirect("/apps/dronegestor/agrovoo");
  return <AgroVooFinanceClient/>;
}
