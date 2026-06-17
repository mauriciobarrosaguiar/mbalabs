import Link from "next/link";
import { NovoCasoForm } from "@/components/lexgestor/NovoCasoForm";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

type NovoCasoPageProps = {
  searchParams?: Promise<{ cliente?: string; erro?: string }>;
};

export default async function NovoCasoPage({ searchParams }: NovoCasoPageProps) {
  const params = (await searchParams) ?? {};
  const data = await getLexWorkspaceData("/lexgestor/casos/novo");

  return (
    <ResponsivePageContainer
      title="Abrir caso"
      description="Preencha o essencial primeiro. Dados do processo podem ficar em branco."
      action={
        <Link className="button secondary" href="/lexgestor/clientes/novo">
          Cadastrar cliente
        </Link>
      }
    >
      {params.erro ? <p className="notice">Nao foi possivel salvar: {params.erro}</p> : null}
      {data.clientes.length === 0 ? (
        <section className="empty-state">
          <strong>Cadastre um cliente antes de abrir o caso</strong>
          <p>O caso precisa ficar vinculado a um cliente.</p>
          <Link className="button" href="/lexgestor/clientes/novo">
            Novo cliente
          </Link>
        </section>
      ) : (
        <NovoCasoForm
          clientes={data.clientes}
          categorias={data.categorias}
          defaultClienteId={params.cliente ?? ""}
        />
      )}
    </ResponsivePageContainer>
  );
}
