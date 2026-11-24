import { AgroDocDocuments } from "./AgroDocDocuments";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function DroneDocumentsPage() {
  await requireAppAccess("dronegestor", "/apps/dronegestor/documentos");
  return <AgroDocDocuments/>;
}
