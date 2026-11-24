import {notFound,redirect} from "next/navigation";
import {requireAppAccess} from "@/lib/core-data";
import {isDroneGestorPilot} from "@/lib/dronegestor-role";
import {AgroVooTraining} from "./AgroVooTraining";
export const dynamic="force-dynamic";
export default async function Page(){
 if(process.env.VERCEL_ENV!=="preview"&&process.env.NODE_ENV!=="development")notFound();
 const current=await requireAppAccess("dronegestor","/apps/dronegestor/agrovoo/piloto/treinamento");
 if(!isDroneGestorPilot({tipo:current.tipo,isAdminMaster:current.isAdminMaster,permissoes:current.permissoes}))redirect("/apps/dronegestor");
 return <AgroVooTraining key={current.usuario.id}/>;
}
