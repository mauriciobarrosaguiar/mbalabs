import Link from "next/link";
import { Plus } from "lucide-react";
import { ClienteAccordionList } from "@/components/lexgestor/ClienteAccordionList";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

export default async function ClientesPage() {
  const data = await getLexWorkspaceData("/lexgestor/clientes");

  return (
    <ResponsivePageContainer
      title="Clientes"
      description="Clientes aparecem fechados. Expanda apenas quando precisar ver detalhes."
      action={
        <Link className="button" href="/lexgestor/clientes/novo">
          <Plus size={17} aria-hidden />
          Novo cliente
        </Link>
      }
    >
      {data.error ? <p className="notice">Clientes ainda indisponiveis: {data.error}</p> : null}
      <ClienteAccordionList clientes={data.clientes} />
    </ResponsivePageContainer>
  );
}
