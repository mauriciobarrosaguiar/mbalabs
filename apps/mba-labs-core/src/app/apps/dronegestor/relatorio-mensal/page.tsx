import { AgroDocReports } from "./AgroDocReports";
import { requireAppAccess } from "@/lib/core-data";
import { DroneMonthlyReportProfileBridge } from "./DroneMonthlyReportProfileBridge";

export const dynamic = "force-dynamic";

export default async function DroneMonthlyReportPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/relatorio-mensal");
  return <AgroDocReports><DroneMonthlyReportProfileBridge userName={current.usuario.nome || "Piloto"}/></AgroDocReports>;
}
