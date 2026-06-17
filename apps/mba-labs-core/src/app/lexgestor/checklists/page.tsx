import { ChecklistCaso } from "@/components/lexgestor/ChecklistCaso";
import { ResponsivePageContainer } from "@/components/lexgestor/ResponsivePageContainer";
import { obterChecklistPorAreaSubarea } from "@/lib/lexgestor/checklist";
import { getLexWorkspaceData } from "@/lib/lexgestor/data";

export default async function ChecklistsPage() {
  const data = await getLexWorkspaceData("/lexgestor/checklists");

  return (
    <ResponsivePageContainer
      title="Checklists"
      description="Documentos sugeridos conforme categoria e subcategoria do caso."
    >
      {data.categorias.map((categoria) => {
        const primeiraSubcategoria = categoria.subcategorias[0]?.nome;
        const items = obterChecklistPorAreaSubarea(categoria.nome, primeiraSubcategoria);

        return (
          <section className="card stack" key={categoria.nome}>
            <div className="section-title">
              <div>
                <h2>{categoria.nome}</h2>
                <p>{categoria.subcategorias.length} subcategorias cadastradas.</p>
              </div>
              <span className="badge">{primeiraSubcategoria ?? "Padrao"}</span>
            </div>
            <ChecklistCaso items={items} />
          </section>
        );
      })}
    </ResponsivePageContainer>
  );
}
