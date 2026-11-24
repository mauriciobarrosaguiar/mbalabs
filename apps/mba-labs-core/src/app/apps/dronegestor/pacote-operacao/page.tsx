import { requireAppAccess } from "@/lib/core-data";
import { DroneFinalOsSummary } from "./DroneFinalOsSummary";
import { DroneOperationPackage } from "./DroneOperationPackage";

export const dynamic = "force-dynamic";

export default async function DroneOperationPackagePage({searchParams}:{searchParams:Promise<{osId?:string}>}) {
  await requireAppAccess("dronegestor", "/apps/dronegestor/pacote-operacao");
  const {osId=""}=await searchParams;
  return <><DroneFinalOsSummary key={`summary:${osId}`}/><DroneOperationPackage key={`package:${osId}`}/></>;
}
