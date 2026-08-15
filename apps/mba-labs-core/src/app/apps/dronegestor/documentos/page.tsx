import { requireAppAccess } from "@/lib/core-data";
import { DroneSarpasAgriculturalGuard } from "../DroneSarpasAgriculturalGuard";
import { DroneDocumentsCenter } from "./DroneDocumentsCenter";

export const dynamic = "force-dynamic";

export default async function DroneDocumentsPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/documentos");
  return <>
    <DroneSarpasAgriculturalGuard />
    <DroneDocumentsCenter />
  </>;
}
