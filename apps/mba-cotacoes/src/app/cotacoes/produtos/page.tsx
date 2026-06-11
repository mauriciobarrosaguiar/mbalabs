import { CotacoesShell, LoginRequired, RowsPreview } from "@/components/CotacoesShell";
import { readCotacoesRows } from "@/lib/cotacoes-data";

export const dynamic = "force-dynamic";

export default async function ProdutosPage() {
  const result = await readCotacoesRows("cot_produtos", "ean,nome,laboratorio,apresentacao,ativo,created_at");

  return (
    <CotacoesShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Produtos"
          description="Cadastro de produtos da empresa logada."
          rows={result.rows}
          columns={["ean", "nome", "laboratorio", "apresentacao", "ativo"]}
        />
      )}
    </CotacoesShell>
  );
}
