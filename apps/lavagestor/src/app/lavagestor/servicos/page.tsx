import { LavaGestorShell, LoginRequired, RowsPreview } from "@/components/LavaGestorShell";
import { readLavaGestorRows } from "@/lib/lavagestor-data";

export const dynamic = "force-dynamic";

export default async function ServicosPage() {
  const result = await readLavaGestorRows("lava_servicos", "nome,descricao,preco,percentual_comissao,ativo");

  return (
    <LavaGestorShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Servicos"
          description="Catalogo de servicos e valores."
          rows={result.rows}
          columns={["nome", "descricao", "preco", "percentual_comissao", "ativo"]}
        />
      )}
    </LavaGestorShell>
  );
}
