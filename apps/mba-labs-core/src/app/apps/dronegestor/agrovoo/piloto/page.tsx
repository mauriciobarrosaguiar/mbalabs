import {redirect} from "next/navigation";
import {requireAppAccess} from "@/lib/core-data";
import {isDroneGestorPilot,canManageDroneGestor} from "@/lib/dronegestor-role";
import {AgroVooPilotHome} from "./AgroVooPilotHome";
export const dynamic="force-dynamic";
export default async function Page(){
 const current=await requireAppAccess("dronegestor","/apps/dronegestor/agrovoo/piloto");
 const role={tipo:current.tipo,isAdminMaster:current.isAdminMaster,permissoes:current.permissoes};
 if(!isDroneGestorPilot(role))redirect(canManageDroneGestor(role)?"/apps/dronegestor/agrovoo":"/apps/dronegestor");
 return <AgroVooPilotHome key={current.usuario.id} userId={current.usuario.id} userName={current.usuario.nome||"Piloto"}/>;
}
