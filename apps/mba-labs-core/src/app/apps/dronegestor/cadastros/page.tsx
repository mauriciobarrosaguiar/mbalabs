import { requireDroneManagementPage } from "@/lib/dronegestor-page-access";
import { AgroDocRegistry } from "./AgroDocRegistry";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireDroneManagementPage( "/apps/dronegestor/cadastros");
  return <AgroDocRegistry />;
}
