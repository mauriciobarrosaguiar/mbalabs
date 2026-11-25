import { redirect } from "next/navigation";
import { requireAppAccess } from "@/lib/core-data";
import { canManageDroneGestor, isDroneGestorPilot } from "@/lib/dronegestor-role";
export const dynamic="force-dynamic";
export default async function AgroVooEntryPage(){
 const current=await requireAppAccess("dronegestor","/apps/agrovoo");
 const role={tipo:current.tipo,isAdminMaster:current.isAdminMaster,permissoes:current.permissoes};
 if(canManageDroneGestor(role))redirect("/apps/agrovoo/painel");
 if(isDroneGestorPilot(role))redirect("/apps/agrovoo/piloto");
 redirect("/apps/agrovoo/fichas");
}
