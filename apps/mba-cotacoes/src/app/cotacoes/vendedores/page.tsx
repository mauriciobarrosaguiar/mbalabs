import { CotacoesShell, LoginRequired, RowsPreview } from "@/components/CotacoesShell";
import { readCotacoesRows } from "@/lib/cotacoes-data";

export const dynamic = "force-dynamic";

export default async function VendedoresPage() {
  const result = await readCotacoesRows("cot_vendedores", "nome,empresa_vendedora,telefone,email,ativo,created_at");

  return (
    <CotacoesShell>
      {!result.signedIn ? (
        <LoginRequired error={result.error} />
      ) : (
        <RowsPreview
          title="Vendedores"
          description="Fornecedores e vendedores usados nas cotacoes."
          rows={result.rows}
          columns={["nome", "empresa_vendedora", "telefone", "email", "ativo"]}
        />
      )}
    </CotacoesShell>
  );
}
