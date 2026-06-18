import { LexDashboardOverview } from "@/components/lexgestor/LexDashboardOverview";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

type DashboardPageProps = {
  searchParams?: Promise<{ demo?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/dashboard", { demo: params.demo === "1" });

  return (
    <ResponsivePageContainer
      title="Dashboard"
      description="Indicadores do escritório, documentos, prazos e últimas movimentações."
    >
      <LexDashboardOverview data={data} />
    </ResponsivePageContainer>
  );
}
