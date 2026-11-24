import { requireDroneManagementPage } from "@/lib/dronegestor-page-access";
import { AgroDocReviewCenter } from "./AgroDocReviewCenter";

export const dynamic = "force-dynamic";
export default async function DroneConferenciaPage(){
  await requireDroneManagementPage("/apps/dronegestor/conferencia");
  return <AgroDocReviewCenter/>;
}
