import { requireAppAccess } from "@/lib/core-data";
import { AgroDocReviewCenter } from "./AgroDocReviewCenter";

export const dynamic = "force-dynamic";
export default async function DroneConferenciaPage(){
  await requireAppAccess("dronegestor","/apps/dronegestor/conferencia");
  return <AgroDocReviewCenter/>;
}
