import { requireAppAccess } from "@/lib/core-data";
import { DroneMonthlyOfficialReport } from "./DroneMonthlyOfficialReport";

export const dynamic = "force-dynamic";

export default async function DroneMonthlyReportPage() {
  const current = await requireAppAccess("dronegestor", "/apps/dronegestor/relatorio-mensal");
  return <DroneMonthlyOfficialReport userName={current.usuario.nome || "Piloto"}/>;
}
