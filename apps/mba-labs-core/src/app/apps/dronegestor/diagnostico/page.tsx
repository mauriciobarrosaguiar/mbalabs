import { requireAppAccess } from "@/lib/core-data";
import { AgroDocDiagnostic } from "./AgroDocDiagnostic";
export const dynamic="force-dynamic";
export default async function DroneDiagnosticoPage(){
 await requireAppAccess("dronegestor","/apps/dronegestor/diagnostico");
 return <AgroDocDiagnostic/>;
}
