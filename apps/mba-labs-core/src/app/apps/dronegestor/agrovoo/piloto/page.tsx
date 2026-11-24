import {redirect} from "next/navigation";
import {requireAppAccess} from "@/lib/core-data";
import {isDroneGestorPilot,canManageDroneGestor} from "@/lib/dronegestor-role";
import {AgroVooPilotHome} from "./AgroVooPilotHome";
export const dynamic="force-dynamic";
export const metadata={title:"AgroVoo Piloto",manifest:"/agrovoo-piloto.webmanifest",appleWebApp:{capable:true,title:"AgroVoo Piloto",statusBarStyle:"default" as const},icons:{apple:"/pwa/agrovoo/192"}};
export default async function Page(){
 const current=await requireAppAccess("dronegestor","/apps/dronegestor/agrovoo/piloto");
 const role={tipo:current.tipo,isAdminMaster:current.isAdminMaster,permissoes:current.permissoes};
 if(!isDroneGestorPilot(role))redirect(canManageDroneGestor(role)?"/apps/dronegestor/agrovoo":"/apps/dronegestor");
 return <AgroVooPilotHome deviceOwner={`${current.empresaId||"solo"}:${current.usuario.id}`} trainingEnabled={process.env.VERCEL_ENV==="preview"||process.env.NODE_ENV==="development"} key={current.usuario.id} userId={current.usuario.id} userName={current.usuario.nome||"Piloto"}/>;
}
