import { requireAppAccess } from "@/lib/core-data";
import { DroneOperationPackage } from "./DroneOperationPackage";

export const dynamic = "force-dynamic";

export default async function DroneOperationPackagePage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/pacote-operacao");
  return <DroneOperationPackage />;
}
