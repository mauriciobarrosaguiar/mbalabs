import { AgroDocReports } from "./AgroDocReports";
import { requireDroneManagementPage } from "@/lib/dronegestor-page-access";
import { DroneMonthlyReportProfileBridge } from "./DroneMonthlyReportProfileBridge";

export const dynamic = "force-dynamic";

export default async function DroneMonthlyReportPage() {
  const current = await requireDroneManagementPage("/apps/dronegestor/relatorio-mensal");
  return <AgroDocReports><DroneMonthlyReportProfileBridge userName={current.usuario.nome || "Piloto"} showModelManager={false}/></AgroDocReports>;
}
