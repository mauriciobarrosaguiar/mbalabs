import Link from "next/link";
import { Plus } from "lucide-react";
import { CasoAccordionList } from "@/components/lexgestor/CasoAccordionList";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

export default async function CasosPage() {
  const data = await getLexWorkspaceData("/lexgestor/casos");

  return (
    <ResponsivePageContainer
      title="Casos"
      description="Casos fechados por padrao, com processo, prazo e checklist ao expandir."
      action={
        <Link className="button" href="/lexgestor/casos/novo">
          <Plus size={17} aria-hidden />
          Abrir caso
        </Link>
      }
    >
      {data.error ? <p className="notice">Casos ainda indisponiveis: {data.error}</p> : null}
      <CasoAccordionList casos={data.casos} />
    </ResponsivePageContainer>
  );
}
