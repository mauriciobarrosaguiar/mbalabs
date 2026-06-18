import { LexDashboardOverview } from "@/components/lexgestor/LexDashboardOverview";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

export default async function LexGestorHomePage() {
  const data = await getLexWorkspaceData("/lexgestor");

  return (
    <ResponsivePageContainer
      title="LexGestor"
      description="Sistema jurídico para organizar clientes, casos, documentos, prazos e dossiês."
    >
      <LexDashboardOverview data={data} />
    </ResponsivePageContainer>
  );
}
